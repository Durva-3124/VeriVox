"""
RawNet2 anti-spoofing model for VeriVox (Module 2).

Architecture:
    SincConv → ResBlock stack (with FMS) → GRU → FC → 2-class logit

Reference:
    Tak et al., "End-to-End anti-spoofing with RawNet2", ICASSP 2021.
    https://arxiv.org/abs/2011.01108

Input:  (B, T) raw waveform, 16 kHz mono, variable length
Output: logits (B, 2),  embedding (B, 128)
"""

from __future__ import annotations

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# SincConv
# ---------------------------------------------------------------------------

class SincConv(nn.Module):
    """
    Learnable sinc-function bandpass filter bank applied to raw waveform.
    Each filter is parameterised by (f_low, bandwidth) and constrained to
    stay positive and ordered.
    """

    def __init__(
        self,
        out_channels: int = 128,
        kernel_size: int = 1024,
        sample_rate: int = 16_000,
        stride: int = 1,
    ) -> None:
        super().__init__()
        assert kernel_size % 2 == 0, "kernel_size must be even"
        self.out_channels = out_channels
        self.kernel_size = kernel_size
        self.sample_rate = sample_rate
        self.stride = stride

        # Initialise from mel-scale centre frequencies
        f_low_mel = 80.0
        f_high_mel = 2595.0 * math.log10(1.0 + (sample_rate / 2) / 700.0)
        mel_points = torch.linspace(f_low_mel, f_high_mel, out_channels + 2)
        hz_points = 700.0 * (10.0 ** (mel_points / 2595.0) - 1.0)

        # f_low and bandwidth are the two learnable parameters per filter
        self.f_low = nn.Parameter(hz_points[:-2].clone())
        self.bandwidth = nn.Parameter((hz_points[1:-1] - hz_points[:-2]).clone())

        # Fixed Hamming window (not learned)
        n = torch.arange(kernel_size // 2, dtype=torch.float32)
        self.register_buffer("window", 0.54 - 0.46 * torch.cos(2 * math.pi * n / kernel_size))
        self.register_buffer("n", n)

    def _sinc(self, x: torch.Tensor) -> torch.Tensor:
        # Numerically safe sinc
        x = torch.where(x == 0, torch.tensor(1e-20, device=x.device), x)
        return torch.sin(math.pi * x) / (math.pi * x)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, 1, T)
        f_low = torch.abs(self.f_low)                          # keep positive
        f_high = f_low + torch.abs(self.bandwidth)             # f_high > f_low
        f_low = torch.clamp(f_low, 30.0, self.sample_rate / 2 - 30.0)
        f_high = torch.clamp(f_high, 30.0, self.sample_rate / 2 - 30.0)

        f_low_norm = f_low / self.sample_rate                  # (C,)
        f_high_norm = f_high / self.sample_rate

        n = self.n.unsqueeze(0)                                # (1, K/2)
        low = 2 * f_low_norm.unsqueeze(1) * self._sinc(2 * f_low_norm.unsqueeze(1) * n)
        high = 2 * f_high_norm.unsqueeze(1) * self._sinc(2 * f_high_norm.unsqueeze(1) * n)

        band = (high - low) * self.window                      # (C, K/2)
        # Build symmetric kernel: [flipped_half, 0, half]
        kernel = torch.cat([band.flip(1), band], dim=1).unsqueeze(1)  # (C, 1, K)

        out = F.conv1d(x, kernel, stride=self.stride, padding=self.kernel_size // 2)
        return torch.abs(out)                                  # (B, C, T')


# ---------------------------------------------------------------------------
# FMS — Feature Map Scaling
# ---------------------------------------------------------------------------

class FMS(nn.Module):
    """
    Channel-wise sigmoid gate + learned scalar bias.
    s = sigmoid(FC(avg_pool(x)))
    out = x * s + s
    """

    def __init__(self, channels: int) -> None:
        super().__init__()
        self.fc = nn.Linear(channels, channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, C, T)
        s = torch.sigmoid(self.fc(x.mean(dim=-1)))  # (B, C)
        s = s.unsqueeze(-1)                          # (B, C, 1)
        return x * s + s


# ---------------------------------------------------------------------------
# Residual Block
# ---------------------------------------------------------------------------

class ResBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int) -> None:
        super().__init__()
        self.conv1 = nn.Conv1d(in_channels, out_channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm1d(out_channels)
        self.conv2 = nn.Conv1d(out_channels, out_channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm1d(out_channels)
        self.fms = FMS(out_channels)
        self.lrelu = nn.LeakyReLU(0.3)
        self.pool = nn.MaxPool1d(3)

        self.skip = (
            nn.Sequential(
                nn.Conv1d(in_channels, out_channels, kernel_size=1, bias=False),
                nn.BatchNorm1d(out_channels),
            )
            if in_channels != out_channels
            else nn.Identity()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = self.skip(x)
        out = self.lrelu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = self.fms(out + residual)
        return self.pool(self.lrelu(out))


# ---------------------------------------------------------------------------
# RawNet2
# ---------------------------------------------------------------------------

class RawNet2(nn.Module):
    """
    RawNet2 anti-spoofing classifier.

    Args:
        sinc_channels:  number of SincConv filter banks
        sinc_kernel:    SincConv kernel size (samples)
        res_channels:   list of (in, out) channel pairs for residual blocks
        gru_hidden:     GRU hidden size
        embedding_dim:  penultimate FC output size (returned as embedding)
        num_classes:    output classes (2 for bonafide/spoof)
        sample_rate:    expected input sample rate
    """

    def __init__(
        self,
        sinc_channels: int = 128,
        sinc_kernel: int = 1024,
        res_channels: list[tuple[int, int]] | None = None,
        gru_hidden: int = 1024,
        embedding_dim: int = 128,
        num_classes: int = 2,
        sample_rate: int = 16_000,
    ) -> None:
        super().__init__()

        if res_channels is None:
            res_channels = [
                (sinc_channels, 128),
                (128, 128),
                (128, 256),
                (256, 256),
                (256, 512),
                (512, 512),
            ]

        self.sinc = SincConv(sinc_channels, sinc_kernel, sample_rate)
        self.sinc_bn = nn.BatchNorm1d(sinc_channels)
        self.lrelu = nn.LeakyReLU(0.3)

        blocks: list[nn.Module] = []
        for in_c, out_c in res_channels:
            blocks.append(ResBlock(in_c, out_c))
        self.res_blocks = nn.Sequential(*blocks)

        final_channels = res_channels[-1][1]
        self.bn_before_gru = nn.BatchNorm1d(final_channels)
        self.gru = nn.GRU(
            input_size=final_channels,
            hidden_size=gru_hidden,
            num_layers=3,
            batch_first=True,
            dropout=0.1,
        )

        self.fc_embed = nn.Linear(gru_hidden, embedding_dim)
        self.bn_embed = nn.BatchNorm1d(embedding_dim)
        self.fc_out = nn.Linear(embedding_dim, num_classes)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (B, T) raw waveform at 16 kHz

        Returns:
            logits:    (B, 2)   — bonafide / spoof class scores
            embedding: (B, 128) — penultimate representation
        """
        # (B, T) → (B, 1, T)
        if x.dim() == 2:
            x = x.unsqueeze(1)

        x = self.sinc(x)                          # (B, C_sinc, T')
        x = self.lrelu(self.sinc_bn(x))

        x = self.res_blocks(x)                    # (B, C_last, T'')

        x = self.bn_before_gru(x)
        x = x.permute(0, 2, 1)                   # (B, T'', C_last)
        _, h_n = self.gru(x)                      # h_n: (3, B, gru_hidden)
        x = h_n[-1]                               # (B, gru_hidden) — last layer

        embedding = self.lrelu(self.bn_embed(self.fc_embed(x)))  # (B, embedding_dim)
        logits = self.fc_out(embedding)                          # (B, 2)

        return logits, embedding


# ---------------------------------------------------------------------------
# Quick smoke-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    torch.manual_seed(42)
    model = RawNet2()
    model.eval()

    dummy = torch.randn(1, 64_000)  # 1 utterance × 4 s @ 16 kHz
    with torch.no_grad():
        logits, emb = model(dummy)

    total_params = sum(p.numel() for p in model.parameters())

    print(f"Input shape   : {list(dummy.shape)}")
    print(f"Logits shape  : {list(logits.shape)}")
    print(f"Embedding shape: {list(emb.shape)}")
    print(f"Total params  : {total_params:,}")

    assert logits.shape == (1, 2),   f"Unexpected logits shape: {logits.shape}"
    assert emb.shape   == (1, 128),  f"Unexpected embedding shape: {emb.shape}"
    print("Smoke-test passed.")
    sys.exit(0)
