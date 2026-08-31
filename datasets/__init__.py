"""
VeriVox Datasets & Evaluation Module (Owner: Harsh).

Components:
- Protocols & Manifests (`datasets.protocols`): ASVspoof 2019/2021 LA protocol parsers & manifest builders.
- Codec & Channel Augmentation (`datasets.augmentation`): Offline Opus, G.711, AAC, AMR, packet loss, SNR noise.
- Speaker-Disjoint Partitioning (`datasets.splits`): Zero speaker leakage train/val/test splits & auditor.
- Evaluation & Adversarial Benchmarks (`datasets.evaluation`): EER, min t-DCF, FAR/FRR, robustness stress tests.
"""

from datasets.protocols import (
    ASVSPOOF2019_LA_ATTACKS,
    ASVspoofProtocolParser,
    AudioSampleMeta,
)

__all__ = [
    "ASVspoofProtocolParser",
    "AudioSampleMeta",
    "ASVSPOOF2019_LA_ATTACKS",
]
