"""
datasets/calibrate_speaker_threshold.py
Speaker Verification EER Calibration (Harsh's deliverable)

Measures Equal Error Rate (EER) for the ECAPA-TDNN speaker verification
module across the available audio manifests and outputs the optimal
SIMILARITY_THRESHOLD to use in model/speaker_verification.py.

How it works
------------
For each speaker in the manifest:
  - First sample  → enrollment embedding (enroll_speaker)
  - Remaining     → live embeddings (score_speaker)

Genuine pairs  : same speaker, score vs enrolled embedding
Impostor pairs : different speaker, score vs enrolled embedding

EER is computed over all genuine + impostor scores.
The optimal threshold is the score at the EER crossover point.

Usage
-----
    # On dummy/benchmark audio (available now):
    python datasets/calibrate_speaker_threshold.py \
        --manifest datasets/processed/train.csv

    # On real ASVspoof data (once Harsh provides splits):
    python datasets/calibrate_speaker_threshold.py \
        --manifest datasets/manifests/asvspoof2019_la_eval.csv \
        --output   datasets/speaker_eer_report.json

Output
------
    datasets/speaker_eer_report.json  — EER, optimal threshold, FAR/FRR curve
    Prints recommended SIMILARITY_THRESHOLD to stdout.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Audio loader
# ---------------------------------------------------------------------------

def _load_wav(path: Path) -> "torch.Tensor":
    """Load a WAV file and return a (T,) float32 torch.Tensor at 16 kHz."""
    import torch
    try:
        import soundfile as sf
        wav, sr = sf.read(str(path), dtype="float32", always_2d=False)
        if wav.ndim == 2:
            wav = wav.mean(axis=1)
        wav_t = torch.from_numpy(wav)
    except Exception:
        import torchaudio
        wav_t, sr = torchaudio.load(str(path))
        wav_t = wav_t.mean(dim=0)

    if sr != 16_000:
        import torchaudio.functional as F
        wav_t = F.resample(wav_t, sr, 16_000)

    return wav_t.float()


# ---------------------------------------------------------------------------
# EER computation (reuses datasets/evaluation/metrics.py)
# ---------------------------------------------------------------------------

def _compute_eer(labels: list[int], scores: list[float]) -> tuple[float, float]:
    from datasets.evaluation.metrics import compute_eer
    return compute_eer(labels, scores)


# ---------------------------------------------------------------------------
# Main calibration logic
# ---------------------------------------------------------------------------

def calibrate(
    manifest_path: Path,
    max_impostors_per_speaker: int = 5,
) -> dict:
    """
    Run speaker-verification EER calibration on a manifest CSV.

    Returns a dict with keys: eer, eer_pct, optimal_threshold,
    n_genuine, n_impostor, far_frr_curve.
    """
    import torch
    from model.speaker_verification import enroll_speaker, score_speaker

    # Load manifest
    with open(manifest_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        raise ValueError(f"Manifest is empty: {manifest_path}")

    # Group bonafide samples by speaker
    speaker_files: dict[str, list[Path]] = defaultdict(list)
    for row in rows:
        if int(row.get("label", 0)) == 0:   # bonafide only
            fp = Path(row["filepath"])
            if not fp.is_absolute():
                fp = _ROOT / fp
            if fp.exists():
                spk = row.get("speaker_id", "unknown")
                speaker_files[spk].append(fp)

    speakers = [s for s, files in speaker_files.items() if len(files) >= 2]
    if len(speakers) < 2:
        raise ValueError(
            f"Need at least 2 speakers with ≥2 bonafide samples each. "
            f"Found {len(speakers)} qualifying speakers in {manifest_path}."
        )

    log.info("Calibrating on %d speakers from %s", len(speakers), manifest_path.name)

    # Build enrollment embeddings
    enrolled: dict[str, "torch.Tensor"] = {}
    for spk in speakers:
        enroll_wav = _load_wav(speaker_files[spk][0])
        enrolled[spk] = enroll_speaker([enroll_wav])

    labels: list[int] = []
    scores: list[float] = []

    for i, spk in enumerate(speakers):
        # Genuine pairs: remaining samples of same speaker
        for wav_path in speaker_files[spk][1:]:
            wav = _load_wav(wav_path)
            from model.speaker_verification import _embed
            live_emb = _embed(wav)
            s = score_speaker(live_emb, enrolled[spk])
            labels.append(0)   # 0 = genuine (same speaker)
            scores.append(float(s))

        # Impostor pairs: first sample of other speakers
        impostor_count = 0
        for j, other_spk in enumerate(speakers):
            if other_spk == spk:
                continue
            if impostor_count >= max_impostors_per_speaker:
                break
            wav = _load_wav(speaker_files[other_spk][0])
            from model.speaker_verification import _embed
            live_emb = _embed(wav)
            s = score_speaker(live_emb, enrolled[spk])
            labels.append(1)   # 1 = impostor (different speaker)
            scores.append(float(s))
            impostor_count += 1

    if not labels:
        raise ValueError("No score pairs generated — check manifest audio paths.")

    eer, opt_thresh = _compute_eer(labels, scores)

    n_genuine  = labels.count(0)
    n_impostor = labels.count(1)

    log.info(
        "EER=%.4f (%.2f%%)  optimal_threshold=%.4f  "
        "genuine=%d  impostor=%d",
        eer, eer * 100, opt_thresh, n_genuine, n_impostor,
    )

    return {
        "eer":                eer,
        "eer_pct":            round(eer * 100, 4),
        "optimal_threshold":  round(opt_thresh, 4),
        "n_genuine":          n_genuine,
        "n_impostor":         n_impostor,
        "manifest":           str(manifest_path),
        "note": (
            "Threshold calibrated on dummy/benchmark audio. "
            "Re-run on real ASVspoof/VoxCeleb data for production use."
            if "dummy" in str(manifest_path) or "benchmark" in str(manifest_path)
            else "Threshold calibrated on provided manifest."
        ),
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Calibrate ECAPA-TDNN speaker verification EER threshold"
    )
    p.add_argument(
        "--manifest",
        type=Path,
        default=_ROOT / "datasets" / "processed" / "train.csv",
        help="CSV manifest with filepath, label, speaker_id columns",
    )
    p.add_argument(
        "--output",
        type=Path,
        default=_ROOT / "datasets" / "speaker_eer_report.json",
        help="Output JSON report path",
    )
    p.add_argument(
        "--max_impostors",
        type=int,
        default=5,
        help="Max impostor pairs per speaker (default 5)",
    )
    return p.parse_args()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    args = parse_args()

    try:
        result = calibrate(args.manifest, args.max_impostors)
    except Exception as e:
        log.error("Calibration failed: %s", e)
        sys.exit(1)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print("\n" + "=" * 56)
    print("Speaker Verification EER Calibration Result")
    print("=" * 56)
    print(f"  Manifest          : {result['manifest']}")
    print(f"  Genuine pairs     : {result['n_genuine']}")
    print(f"  Impostor pairs    : {result['n_impostor']}")
    print(f"  EER               : {result['eer_pct']:.2f}%")
    print(f"  Optimal threshold : {result['optimal_threshold']:.4f}")
    print(f"  Report saved to   : {args.output}")
    print("=" * 56)
    print(f"\n  ➜  Set SIMILARITY_THRESHOLD = {result['optimal_threshold']:.4f}")
    print(f"     in model/speaker_verification.py\n")
    print(f"  NOTE: {result['note']}")


if __name__ == "__main__":
    main()
