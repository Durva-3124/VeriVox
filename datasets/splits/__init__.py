"""
Speaker-disjoint splitting and split verification utilities (Module: Datasets & Evaluation).
"""

from datasets.splits.speaker_disjoint import (
    partition_speakers_disjoint,
    write_split_csvs,
)
from datasets.splits.verify_splits import audit_splits

__all__ = [
    "partition_speakers_disjoint",
    "write_split_csvs",
    "audit_splits",
]
