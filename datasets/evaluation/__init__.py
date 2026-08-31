"""
Evaluation, Metrics, and Adversarial Testing Package for VeriVox (Module: Datasets & Evaluation).
"""

from datasets.evaluation.adversarial import (
    STRESS_CONDITIONS,
    AdversarialTester,
    ModelRunner,
)
from datasets.evaluation.metrics import (
    compute_eer,
    compute_metrics_summary,
    compute_min_tdcf,
)
from datasets.evaluation.report_generator import generate_benchmark_report

__all__ = [
    "compute_eer",
    "compute_min_tdcf",
    "compute_metrics_summary",
    "AdversarialTester",
    "ModelRunner",
    "STRESS_CONDITIONS",
    "generate_benchmark_report",
]
