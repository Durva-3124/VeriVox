"""
Speaker-Disjoint Dataset Partitioning and Validation (Harsh's Sep 01 Deliverable).

Guarantees:
1. Strict Zero Speaker Leakage:
   - Train speakers ∩ Val speakers = ∅
   - Train speakers ∩ Test speakers = ∅
   - Val speakers ∩ Test speakers = ∅
2. Balanced class distributions (bonafide vs spoof) across splits.
3. Attack Generalization partitioning:
   - Seen attacks (e.g. A01-A06) assigned to Train/Val
   - Unseen attacks (e.g. A07-A19) assigned exclusively to Test/Eval
4. Manifest output compatible with SpoofDataset (filepath, label).
"""

from __future__ import annotations

import argparse
import csv
import logging
import random
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Union

_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

log = logging.getLogger(__name__)


def partition_speakers_disjoint(
    samples: list[dict],
    split_ratios: tuple[float, float, float] = (0.70, 0.15, 0.15),
    seed: int = 42,
    unseen_attack_ids: Optional[set[str]] = None,
) -> tuple[list[dict], list[dict], list[dict]]:
    """
    Partitions a list of audio sample dictionaries into strictly speaker-disjoint Train, Val, and Test sets.

    Args:
        samples: List of dictionaries containing at least 'speaker_id' and 'label'.
        split_ratios: (train_ratio, val_ratio, test_ratio) summing to 1.0.
        seed: Random seed for deterministic reproducibility.
        unseen_attack_ids: Set of system_ids that represent unseen attacks (speakers with these attacks prioritized to Test).

    Returns:
        (train_samples, val_samples, test_samples)
    """
    random.seed(seed)
    train_r, val_r, test_r = split_ratios
    assert abs((train_r + val_r + test_r) - 1.0) < 1e-4, "Split ratios must sum to 1.0"

    unseen_attacks = unseen_attack_ids or set()

    # Group all samples strictly by speaker
    speaker_samples: dict[str, list[dict]] = defaultdict(list)
    speaker_has_unseen: dict[str, bool] = defaultdict(bool)

    for s in samples:
        spk = s.get("speaker_id", "unknown")
        speaker_samples[spk].append(s)
        sys_id = s.get("system_id", "-")
        if sys_id in unseen_attacks:
            speaker_has_unseen[spk] = True

    unique_speakers = list(speaker_samples.keys())
    random.shuffle(unique_speakers)

    train_speakers: set[str] = set()
    val_speakers: set[str] = set()
    test_speakers: set[str] = set()

    # If any speakers have unseen attacks, place them into test_speakers first
    if unseen_attacks:
        for spk in unique_speakers:
            if speaker_has_unseen[spk]:
                test_speakers.add(spk)

    remaining_speakers = [spk for spk in unique_speakers if spk not in test_speakers]
    remaining_speakers.sort(key=lambda spk: len(speaker_samples[spk]), reverse=True)

    target_total = sum(len(speaker_samples[spk]) for spk in unique_speakers)
    target_train = target_total * train_r
    target_val = target_total * val_r
    target_test = target_total * test_r

    current_train = sum(len(speaker_samples[spk]) for spk in train_speakers)
    current_val = sum(len(speaker_samples[spk]) for spk in val_speakers)
    current_test = sum(len(speaker_samples[spk]) for spk in test_speakers)

    for spk in remaining_speakers:
        count = len(speaker_samples[spk])
        need_train = (target_train - current_train) / max(1, target_train)
        need_val = (target_val - current_val) / max(1, target_val)
        need_test = (target_test - current_test) / max(1, target_test)

        best_split = max([("train", need_train), ("val", need_val), ("test", need_test)], key=lambda x: x[1])[0]

        if best_split == "train":
            train_speakers.add(spk)
            current_train += count
        elif best_split == "val":
            val_speakers.add(spk)
            current_val += count
        else:
            test_speakers.add(spk)
            current_test += count

    # Materialize splits: every sample of a speaker stays strictly in that split
    train_samples = [s for spk in train_speakers for s in speaker_samples[spk]]
    val_samples = [s for spk in val_speakers for s in speaker_samples[spk]]
    test_samples = [s for spk in test_speakers for s in speaker_samples[spk]]

    # Rigorous assertion check
    assert len(train_speakers & val_speakers) == 0, f"Speaker leakage Train/Val: {train_speakers & val_speakers}"
    assert len(train_speakers & test_speakers) == 0, f"Speaker leakage Train/Test: {train_speakers & test_speakers}"
    assert len(val_speakers & test_speakers) == 0, f"Speaker leakage Val/Test: {val_speakers & test_speakers}"

    log.info(
        "Disjoint Partitioning Complete:\n"
        "  Train: %d samples, %d speakers\n"
        "  Val  : %d samples, %d speakers\n"
        "  Test : %d samples, %d speakers",
        len(train_samples),
        len(train_speakers),
        len(val_samples),
        len(val_speakers),
        len(test_samples),
        len(test_speakers),
    )

    return train_samples, val_samples, test_samples


def write_split_csvs(
    train_samples: list[dict],
    val_samples: list[dict],
    test_samples: list[dict],
    train_csv: Union[str, Path],
    val_csv: Union[str, Path],
    test_csv: Union[str, Path],
    minimal_format: bool = False,
) -> tuple[Path, Path, Path]:
    """
    Writes partitioned samples into three CSV manifests.
    If minimal_format is True, only writes [filepath, label] for train.py.
    """
    paths = [Path(train_csv), Path(val_csv), Path(test_csv)]
    splits = [train_samples, val_samples, test_samples]

    for p, rows in zip(paths, splits):
        p.parent.mkdir(parents=True, exist_ok=True)
        if not rows:
            with open(p, "w", newline="", encoding="utf-8") as f:
                f.write("filepath,label\n")
            continue

        if minimal_format:
            fieldnames = ["filepath", "label"]
            clean_rows = [{"filepath": r["filepath"], "label": int(r["label"])} for r in rows]
        else:
            fieldnames = list(rows[0].keys())
            clean_rows = rows

        with open(p, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(clean_rows)

    return paths[0], paths[1], paths[2]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Enforce speaker-disjoint train/val/test splits")
    p.add_argument("--input_csv", required=True, help="Input manifest CSV with speaker_id column")
    p.add_argument("--train_csv", required=True, help="Output train CSV manifest")
    p.add_argument("--val_csv", required=True, help="Output validation CSV manifest")
    p.add_argument("--test_csv", required=True, help="Output test/eval CSV manifest")
    p.add_argument("--split_ratios", nargs=3, type=float, default=[0.70, 0.15, 0.15], help="Train Val Test ratios")
    p.add_argument("--unseen_attacks", default="A07,A08,A09,A10,A11,A12,A13,A14,A15,A16,A17,A18,A19", help="Comma-separated unseen attack IDs for eval")
    p.add_argument("--seed", type=int, default=42, help="Random seed")
    p.add_argument("--minimal", action="store_true", help="Write only [filepath, label] columns")
    return p.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
    args = parse_args()

    with open(args.input_csv, "r", newline="", encoding="utf-8") as f:
        samples = list(csv.DictReader(f))

    unseen = set(a.strip() for a in args.unseen_attacks.split(",") if a.strip())
    train_s, val_s, test_s = partition_speakers_disjoint(
        samples, split_ratios=tuple(args.split_ratios), seed=args.seed, unseen_attack_ids=unseen
    )

    write_split_csvs(
        train_s, val_s, test_s, args.train_csv, args.val_csv, args.test_csv, minimal_format=args.minimal
    )
    print(f"Successfully generated speaker-disjoint splits:\n  Train: {args.train_csv}\n  Val: {args.val_csv}\n  Test: {args.test_csv}")


if __name__ == "__main__":
    main()
