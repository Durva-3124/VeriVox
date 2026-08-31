"""
Generates synthetic dummy audio files and CSV manifests for smoke-testing
model/training/train.py without real ASVspoof data.

Creates:
    datasets/processed/dummy_audio/  — 40 tiny .wav files (20 train, 20 val)
    datasets/processed/train.csv
    datasets/processed/val.csv

Run from repo root:
    python datasets/processed/make_dummy_data.py
"""

import csv
import math
import struct
import random
from pathlib import Path

SAMPLE_RATE = 16_000
DURATION_S  = 4
N_SAMPLES   = SAMPLE_RATE * DURATION_S   # 64 000
TRAIN_COUNT = 20   # 10 bonafide + 10 spoof
VAL_COUNT   = 10   #  5 bonafide +  5 spoof


def _write_wav(path: Path, samples: list[float], sr: int = SAMPLE_RATE) -> None:
    """Write a minimal 16-bit mono PCM WAV without any external library."""
    n = len(samples)
    data_bytes = struct.pack(f"<{n}h", *(int(max(-32768, min(32767, s * 32767))) for s in samples))
    with open(path, "wb") as f:
        # RIFF header
        f.write(b"RIFF")
        f.write(struct.pack("<I", 36 + len(data_bytes)))
        f.write(b"WAVE")
        # fmt chunk
        f.write(b"fmt ")
        f.write(struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16))
        # data chunk
        f.write(b"data")
        f.write(struct.pack("<I", len(data_bytes)))
        f.write(data_bytes)


def _sine(freq: float, n: int, sr: int = SAMPLE_RATE) -> list[float]:
    return [0.3 * math.sin(2 * math.pi * freq * i / sr) for i in range(n)]


def _noise(n: int) -> list[float]:
    return [random.uniform(-0.1, 0.1) for _ in range(n)]


def make_split(
    audio_dir: Path,
    csv_path: Path,
    count: int,
    prefix: str,
    repo_root: Path | None = None,
) -> None:
    rows: list[dict] = []
    base_root = repo_root if repo_root is not None else Path(__file__).resolve().parent.parent.parent
    for i in range(count):
        label = i % 2          # alternating bonafide/spoof
        freq  = 220 + i * 30   # different tone per file
        samples = _sine(freq, N_SAMPLES) if label == 0 else _noise(N_SAMPLES)
        fname = audio_dir / f"{prefix}_{i:03d}_{'bonafide' if label==0 else 'spoof'}.wav"
        _write_wav(fname, samples)
        try:
            rel_fname = fname.resolve().relative_to(base_root.resolve()).as_posix()
        except ValueError:
            rel_fname = fname.as_posix()
        rows.append({"filepath": rel_fname, "label": label})

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["filepath", "label"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows -> {csv_path}")


if __name__ == "__main__":
    random.seed(0)
    root      = Path(__file__).resolve().parent
    repo_root = root.parent.parent
    audio_dir = root / "dummy_audio"
    audio_dir.mkdir(exist_ok=True)

    make_split(audio_dir, root / "train.csv", TRAIN_COUNT, "train", repo_root)
    make_split(audio_dir, root / "val.csv",   VAL_COUNT,   "val", repo_root)
    print("Done. Run training with:")
    print("  python model/training/train.py --model rawnet2 "
          "--train_csv datasets/processed/train.csv "
          "--val_csv datasets/processed/val.csv "
          "--epochs 2 --batch_size 4 --num_workers 0")
