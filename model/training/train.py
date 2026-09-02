"""
Anti-spoofing training loop for VeriVox (Module 2).

Usage:
    python model/training/train.py \
        --model    rawnet2 \
        --train_csv datasets/processed/train.csv \
        --val_csv   datasets/processed/val.csv \
        [--epochs 20] [--batch_size 24] [--lr 1e-4] [--seed 42] \
        [--num_workers 4] [--checkpoint_dir model/training/checkpoints]

CSV manifest format (produced by datasets/ — Harsh):
    filepath,label
    /path/to/audio.flac,0
    ...
    label: 0 = bonafide, 1 = spoof

Checkpoints saved to --checkpoint_dir:
    best_eer_<model>.pt   — lowest validation EER seen so far
    last_<model>.pt       — end of every epoch (safe resume point)
"""

from __future__ import annotations

import argparse
import logging
import os
import random
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torch.nn as nn
import torchaudio
from torch.utils.data import DataLoader, Dataset

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SAMPLE_RATE = 16_000
CLIP_SAMPLES = 64_000   # 4 s × 16 kHz


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class SpoofDataset(Dataset):
    """
    Reads a CSV manifest with columns [filepath, label].
    Loads audio with soundfile, resamples to 16 kHz mono,
    then pads or crops to CLIP_SAMPLES.
    Resolves relative filepaths against base_dir (defaults to repository root).
    Also recovers gracefully from foreign absolute paths when files exist relative to base_dir.
    """

    def __init__(self, csv_path: str | Path, base_dir: str | Path | None = None) -> None:
        import csv
        self.base_dir = Path(base_dir) if base_dir is not None else _REPO_ROOT
        self.samples: list[tuple[str, int]] = []
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_fp = row["filepath"]
                p = Path(raw_fp)
                if not p.is_absolute():
                    resolved = self.base_dir / p
                elif p.exists():
                    resolved = p
                else:
                    # Foreign absolute path (e.g. from another user's machine C:\Users\Dell\... or C:\Users\HARSH\...)
                    norm = raw_fp.replace("\\", "/")
                    if "datasets/" in norm:
                        rel_subpath = "datasets/" + norm.split("datasets/", 1)[1]
                        resolved = self.base_dir / rel_subpath
                    elif "model/" in norm:
                        rel_subpath = "model/" + norm.split("model/", 1)[1]
                        resolved = self.base_dir / rel_subpath
                    else:
                        resolved = self.base_dir / p.name

                self.samples.append((str(resolved), int(row["label"])))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        filepath, label = self.samples[idx]
        data, sr = sf.read(filepath, dtype="float32", always_2d=True)  # (T, C)
        waveform = torch.from_numpy(data.T)  # (C, T)

        # Resample if needed
        if sr != SAMPLE_RATE:
            waveform = torchaudio.functional.resample(waveform, sr, SAMPLE_RATE)

        # Mix down to mono
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)

        waveform = waveform.squeeze(0)  # (T,)

        # Pad or crop to fixed length
        T = waveform.shape[0]
        if T < CLIP_SAMPLES:
            waveform = torch.nn.functional.pad(waveform, (0, CLIP_SAMPLES - T))
        elif T > CLIP_SAMPLES:
            start = random.randint(0, T - CLIP_SAMPLES)
            waveform = waveform[start : start + CLIP_SAMPLES]

        return waveform, label   # (CLIP_SAMPLES,), int


# ---------------------------------------------------------------------------
# EER
# ---------------------------------------------------------------------------

def compute_eer(labels: np.ndarray, scores: np.ndarray) -> float:
    """
    Compute Equal Error Rate.

    Args:
        labels: 1-D int array, 0 = bonafide, 1 = spoof
        scores: 1-D float array, higher = more likely spoof

    Returns:
        EER as a fraction in [0, 1].
    """
    # Sort by descending score
    sorted_idx = np.argsort(scores)[::-1]
    labels_sorted = labels[sorted_idx]

    n_spoof = labels.sum()
    n_bonafide = len(labels) - n_spoof

    if n_spoof == 0 or n_bonafide == 0:
        return float("nan")

    # Cumulative FRR and FAR at each threshold
    tp = np.cumsum(labels_sorted)
    fp = np.cumsum(1 - labels_sorted)

    frr = 1.0 - tp / n_spoof        # miss rate (spoof missed)
    far = fp / n_bonafide            # false alarm rate (bonafide rejected)

    # Find crossover
    diff = frr - far
    idx = np.argmin(np.abs(diff))
    eer = (frr[idx] + far[idx]) / 2.0
    return float(eer)


# ---------------------------------------------------------------------------
# Train / validate
# ---------------------------------------------------------------------------

def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> tuple[float, float]:
    """Returns (avg_loss, eer)."""
    model.train()
    total_loss = 0.0
    all_labels: list[np.ndarray] = []
    all_scores: list[np.ndarray] = []

    for waveforms, labels in loader:
        waveforms = waveforms.to(device)          # (B, T)
        labels = labels.to(device)                # (B,)

        optimizer.zero_grad()
        logits, _ = model(waveforms)              # (B, 2)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * len(labels)

        # Spoof score = softmax prob of class 1
        with torch.no_grad():
            scores = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy()
        all_scores.append(scores)
        all_labels.append(labels.cpu().numpy())

    avg_loss = total_loss / len(loader.dataset)
    eer = compute_eer(
        np.concatenate(all_labels),
        np.concatenate(all_scores),
    )
    return avg_loss, eer


@torch.no_grad()
def validate(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> tuple[float, float]:
    """Returns (avg_loss, eer)."""
    model.eval()
    total_loss = 0.0
    all_labels: list[np.ndarray] = []
    all_scores: list[np.ndarray] = []

    for waveforms, labels in loader:
        waveforms = waveforms.to(device)
        labels = labels.to(device)

        logits, _ = model(waveforms)
        loss = criterion(logits, labels)
        total_loss += loss.item() * len(labels)

        scores = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy()
        all_scores.append(scores)
        all_labels.append(labels.cpu().numpy())

    avg_loss = total_loss / len(loader.dataset)
    eer = compute_eer(
        np.concatenate(all_labels),
        np.concatenate(all_scores),
    )
    return avg_loss, eer


# ---------------------------------------------------------------------------
# Model factory
# ---------------------------------------------------------------------------

def build_model(name: str) -> nn.Module:
    # Resolve paths relative to this file so the script works from any cwd
    model_dir = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(model_dir))

    if name == "rawnet2":
        from rawnet2 import RawNet2
        return RawNet2()
    elif name == "aasist":
        from aasist import AASISTModel
        return AASISTModel()
    else:
        raise ValueError(f"Unknown model '{name}'. Choose: rawnet2 | aasist")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="VeriVox anti-spoofing training")
    p.add_argument("--model",          required=True, choices=["rawnet2", "aasist"])
    p.add_argument("--train_csv",      required=True)
    p.add_argument("--val_csv",        required=True)
    p.add_argument("--epochs",         type=int,   default=20)
    p.add_argument("--batch_size",     type=int,   default=24)
    p.add_argument("--lr",             type=float, default=1e-4)
    p.add_argument("--seed",           type=int,   default=42)
    p.add_argument("--num_workers",    type=int,   default=0)  # 0 = main process only (required on Windows)
    p.add_argument(
        "--checkpoint_dir",
        default=str(Path(__file__).resolve().parent / "checkpoints"),
    )
    return p.parse_args()


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def main() -> None:
    args = parse_args()
    seed_everything(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log.info("Device: %s", device)

    # Data
    train_ds = SpoofDataset(args.train_csv)
    val_ds   = SpoofDataset(args.val_csv)
    log.info("Train: %d  |  Val: %d", len(train_ds), len(val_ds))

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=device.type == "cuda",
        drop_last=True,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=device.type == "cuda",
    )

    # Model
    model = build_model(args.model).to(device)
    total_params = sum(p.numel() for p in model.parameters())
    log.info("Model: %s  |  Params: %s", args.model, f"{total_params:,}")

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    best_eer_path = ckpt_dir / f"best_eer_{args.model}.pt"
    last_path     = ckpt_dir / f"last_{args.model}.pt"

    best_val_eer = float("inf")

    for epoch in range(1, args.epochs + 1):
        train_loss, train_eer = train_one_epoch(
            model, train_loader, criterion, optimizer, device
        )
        val_loss, val_eer = validate(model, val_loader, criterion, device)

        log.info(
            "Epoch %02d/%02d  "
            "train_loss=%.4f  train_eer=%.4f  "
            "val_loss=%.4f  val_eer=%.4f",
            epoch, args.epochs,
            train_loss, train_eer,
            val_loss, val_eer,
        )

        # Save last checkpoint every epoch
        torch.save(
            {
                "epoch": epoch,
                "model_state": model.state_dict(),
                "optimizer_state": optimizer.state_dict(),
                "val_eer": val_eer,
                "args": vars(args),
            },
            last_path,
        )

        # Save best-EER checkpoint
        if val_eer < best_val_eer:
            best_val_eer = val_eer
            torch.save(
                {
                    "epoch": epoch,
                    "model_state": model.state_dict(),
                    "val_eer": val_eer,
                    "args": vars(args),
                },
                best_eer_path,
            )
            log.info("  ↳ New best EER %.4f — saved to %s", best_val_eer, best_eer_path)

    log.info("Training complete. Best val EER: %.4f", best_val_eer)


if __name__ == "__main__":
    main()
