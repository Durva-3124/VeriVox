"""
AASIST anti-spoofing model for VeriVox (Module 2).

Architecture:
    SincConv → encoder stack → spectral + temporal graph construction
    → Heterogeneous Stacking Graph Attention (HS-GAL) layers
    → mean+max readout → FC → 2-class logit

Reference:
    Jung et al., "AASIST: Audio Anti-Spoofing using Integrated Spectro-Temporal
    Graph Attention Networks", ICASSP 2022.
    https://arxiv.org/abs/2110.01200

Input:  (B, T) raw waveform, 16 kHz mono, variable length
Output: logits (B, 2),  embedding (B, embedding_dim)

Constructor keyword arguments are intentionally aligned with RawNet2 in
rawnet2.py so both models can be swapped in a training script without
changing call sites.
"""

from __future__ import annotations

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Shared front-end: SincConv (same spec as rawnet2.py)
# ---------------------------------------------------------------------------

class SincConv(nn.Module):
    """Learnable mel-initialised sinc bandpass filter bank."""

    def __init__(
        self,
        out_channels: int = 70,
        kernel_size: int = 128,
        sample_rate: int = 16_000,
    ) -> None:
        super().__init__()
        assert kernel_size % 2 == 0
        self.out_channels = out_channels
        self.kernel_size = kernel_size
        self.sample_rate = sample_rate

        f_low_mel = 80.0
        f_high_mel = 2595.0 * math.log10(1.0 + (sample_rate / 2) / 700.0)
        mel_pts = torch.linspace(f_low_mel, f_high_mel, out_channels + 2)
        hz_pts = 700.0 * (10.0 ** (mel_pts / 2595.0) - 1.0)

        self.f_low = nn.Parameter(hz_pts[:-2].clone())
        self.bandwidth = nn.Parameter((hz_pts[1:-1] - hz_pts[:-2]).clone())

        n = torch.arange(kernel_size // 2, dtype=torch.float32)
        self.register_buffer("window", 0.54 - 0.46 * torch.cos(2 * math.pi * n / kernel_size))
        self.register_buffer("n", n)

    def _sinc(self, x: torch.Tensor) -> torch.Tensor:
        x = torch.where(x == 0, torch.tensor(1e-20, device=x.device), x)
        return torch.sin(math.pi * x) / (math.pi * x)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, 1, T)
        f_low = torch.clamp(torch.abs(self.f_low), 30.0, self.sample_rate / 2 - 30.0)
        f_high = torch.clamp(f_low + torch.abs(self.bandwidth), 30.0, self.sample_rate / 2 - 30.0)
        f_l = f_low / self.sample_rate
        f_h = f_high / self.sample_rate

        n = self.n.unsqueeze(0)
        low = 2 * f_l.unsqueeze(1) * self._sinc(2 * f_l.unsqueeze(1) * n)
        high = 2 * f_h.unsqueeze(1) * self._sinc(2 * f_h.unsqueeze(1) * n)
        band = (high - low) * self.window
        kernel = torch.cat([band.flip(1), band], dim=1).unsqueeze(1)  # (C, 1, K)
        return torch.abs(F.conv1d(x, kernel, padding=self.kernel_size // 2))


# ---------------------------------------------------------------------------
# Encoder: lightweight conv stack that produces spectral & temporal features
# ---------------------------------------------------------------------------

class _EncoderBlock(nn.Module):
    def __init__(self, in_c: int, out_c: int, kernel: int = 3, pool: int = 3) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv1d(in_c, out_c, kernel, padding=kernel // 2, bias=False),
            nn.BatchNorm1d(out_c),
            nn.SELU(),
            nn.MaxPool1d(pool),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class Encoder(nn.Module):
    """
    Reduces (B, sinc_channels, T) → (B, d_model, T_s) for spectral graph
    and (B, d_model, T_t) for temporal graph via two parallel paths.
    """

    def __init__(self, sinc_channels: int, d_model: int) -> None:
        super().__init__()
        # Spectral path: compress time aggressively, keep channel richness
        self.spectral = nn.Sequential(
            _EncoderBlock(sinc_channels, d_model, kernel=3, pool=3),
            _EncoderBlock(d_model, d_model, kernel=3, pool=3),
            _EncoderBlock(d_model, d_model, kernel=3, pool=3),
        )
        # Temporal path: pool=4 per block keeps node count ~30 (memory-safe for GAT)
        self.temporal = nn.Sequential(
            _EncoderBlock(sinc_channels, d_model, kernel=3, pool=4),
            _EncoderBlock(d_model, d_model, kernel=3, pool=4),
            _EncoderBlock(d_model, d_model, kernel=3, pool=4),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        # returns (B, d_model, T_s),  (B, d_model, T_t)
        return self.spectral(x), self.temporal(x)


# ---------------------------------------------------------------------------
# Graph Attention Layer (single-graph)
# ---------------------------------------------------------------------------

class GraphAttentionLayer(nn.Module):
    """
    Single-head graph attention over N nodes of dimension d_in -> d_out.
    Uses scaled dot-product attention (O(N*D) memory) instead of the
    pairwise-concat formulation (O(N^2*D)) to stay memory-feasible on CPU.
    """

    def __init__(self, d_in: int, d_out: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.q = nn.Linear(d_in, d_out, bias=False)
        self.k = nn.Linear(d_in, d_out, bias=False)
        self.v = nn.Linear(d_in, d_out, bias=False)
        self.dropout = nn.Dropout(dropout)
        self.scale = d_out ** -0.5

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, N, d_in)
        Q = self.q(x)                                        # (B, N, d_out)
        K = self.k(x)
        V = self.v(x)
        attn = self.dropout(
            F.softmax(torch.bmm(Q, K.transpose(1, 2)) * self.scale, dim=-1)
        )                                                    # (B, N, N)
        return F.elu(torch.bmm(attn, V))                     # (B, N, d_out)


# ---------------------------------------------------------------------------
# HS-GAL: Heterogeneous Stacking Graph Attention Layer
# ---------------------------------------------------------------------------

class _CrossAttention(nn.Module):
    """
    Single-head cross-attention using only bmm — no internal reshapes,
    fully ONNX-traceable at any sequence length.
    Query from graph A attends to keys/values from graph B.
    """

    def __init__(self, d_model: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.q = nn.Linear(d_model, d_model, bias=False)
        self.k = nn.Linear(d_model, d_model, bias=False)
        self.v = nn.Linear(d_model, d_model, bias=False)
        self.dropout = nn.Dropout(dropout)
        self.scale = d_model ** -0.5

    def forward(self, query: torch.Tensor, context: torch.Tensor) -> torch.Tensor:
        # query:   (B, N_q, d)   context: (B, N_c, d)
        Q = self.q(query)
        K = self.k(context)
        V = self.v(context)
        attn = self.dropout(
            F.softmax(torch.bmm(Q, K.transpose(1, 2)) * self.scale, dim=-1)
        )                                          # (B, N_q, N_c)
        return F.elu(torch.bmm(attn, V))           # (B, N_q, d)


class HSGAL(nn.Module):
    """
    Processes spectral graph (S nodes) and temporal graph (T nodes) with
    separate GAT heads, then fuses via cross-graph attention.

    spectral nodes: (B, N_s, d)  — one node per sinc filter output frame
    temporal nodes: (B, N_t, d)  — one node per time frame
    """

    def __init__(self, d_model: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.gat_s   = GraphAttentionLayer(d_model, d_model, dropout)
        self.gat_t   = GraphAttentionLayer(d_model, d_model, dropout)
        self.cross_s = _CrossAttention(d_model, dropout)  # spectral queries temporal
        self.cross_t = _CrossAttention(d_model, dropout)  # temporal queries spectral
        self.norm_s  = nn.LayerNorm(d_model)
        self.norm_t  = nn.LayerNorm(d_model)

    def forward(
        self, s: torch.Tensor, t: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        s = self.norm_s(s + self.gat_s(s))
        t = self.norm_t(t + self.gat_t(t))
        s = self.norm_s(s + self.cross_s(s, t))
        t = self.norm_t(t + self.cross_t(t, s))
        return s, t


# ---------------------------------------------------------------------------
# AASISTModel
# ---------------------------------------------------------------------------

class AASISTModel(nn.Module):
    """
    AASIST anti-spoofing classifier.

    Args:
        sinc_channels:  SincConv output channels (spectral nodes)
        sinc_kernel:    SincConv kernel size (samples)
        d_model:        internal graph node dimension
        num_hs_layers:  number of stacked HS-GAL layers
        embedding_dim:  penultimate FC output size (returned as embedding)
        num_classes:    output classes (2 for bonafide/spoof)
        sample_rate:    expected input sample rate
    """

    def __init__(
        self,
        sinc_channels: int = 70,
        sinc_kernel: int = 128,
        d_model: int = 64,
        num_hs_layers: int = 2,
        embedding_dim: int = 128,
        num_classes: int = 2,
        sample_rate: int = 16_000,
    ) -> None:
        super().__init__()

        self.sinc = SincConv(sinc_channels, sinc_kernel, sample_rate)
        self.sinc_bn = nn.BatchNorm1d(sinc_channels)

        self.encoder = Encoder(sinc_channels, d_model)

        self.hs_layers = nn.ModuleList(
            [HSGAL(d_model) for _ in range(num_hs_layers)]
        )

        # Readout: mean + max over nodes → concat → FC
        readout_dim = d_model * 4  # (mean_s, max_s, mean_t, max_t)
        self.fc_embed = nn.Linear(readout_dim, embedding_dim)
        self.bn_embed = nn.BatchNorm1d(embedding_dim)
        self.fc_out = nn.Linear(embedding_dim, num_classes)
        self.lrelu = nn.LeakyReLU(0.3)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (B, T) raw waveform at 16 kHz

        Returns:
            logits:    (B, 2)             — bonafide / spoof class scores
            embedding: (B, embedding_dim) — penultimate representation
        """
        if x.dim() == 2:
            x = x.unsqueeze(1)                           # (B, 1, T)

        x = self.lrelu(self.sinc_bn(self.sinc(x)))      # (B, C_sinc, T')

        s_feat, t_feat = self.encoder(x)                 # (B, d, T_s), (B, d, T_t)

        # Treat time axis as graph nodes: (B, N, d)
        s = s_feat.permute(0, 2, 1)
        t = t_feat.permute(0, 2, 1)

        for layer in self.hs_layers:
            s, t = layer(s, t)

        # Mean + max readout over node dimension
        s_pool = torch.cat([s.mean(dim=1), s.max(dim=1).values], dim=-1)  # (B, 2d)
        t_pool = torch.cat([t.mean(dim=1), t.max(dim=1).values], dim=-1)  # (B, 2d)
        pooled = torch.cat([s_pool, t_pool], dim=-1)                       # (B, 4d)

        embedding = self.lrelu(self.bn_embed(self.fc_embed(pooled)))       # (B, embedding_dim)
        logits = self.fc_out(embedding)                                    # (B, 2)

        return logits, embedding


# ---------------------------------------------------------------------------
# Quick smoke-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    torch.manual_seed(42)
    model = AASISTModel()
    model.eval()

    dummy = torch.randn(1, 64_000)  # 1 utterance × 4 s @ 16 kHz
    with torch.no_grad():
        logits, emb = model(dummy)

    total_params = sum(p.numel() for p in model.parameters())

    print(f"Input shape    : {list(dummy.shape)}")
    print(f"Logits shape   : {list(logits.shape)}")
    print(f"Embedding shape: {list(emb.shape)}")
    print(f"Total params   : {total_params:,}")

    assert logits.shape == (1, 2),   f"Unexpected logits shape: {logits.shape}"
    assert emb.shape   == (1, 128),  f"Unexpected embedding shape: {emb.shape}"
    print("Smoke-test passed.")
    sys.exit(0)
