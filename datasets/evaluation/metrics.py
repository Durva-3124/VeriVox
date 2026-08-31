"""
Anti-Spoofing and Speaker Verification Evaluation Metrics (Harsh's Sep 02 Deliverable).

Implements:
- Equal Error Rate (EER) with optimal threshold calibration
- False Alarm Rate (FAR / False Rejection of Bonafide) & False Acceptance of Spoofs (Miss Rate)
- Official ASVspoof 2019/2021 normalized minimum tandem Detection Cost Function (min t-DCF)
- Area Under ROC Curve (AUC-ROC) and Detection Error Tradeoff (DET) points
- Standard operational threshold calibration (e.g. Threshold @ FAR=1.0%, FAR=0.1%)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

log = logging.getLogger(__name__)


# ===========================================================================
# 1. Equal Error Rate (EER)
# ===========================================================================

def compute_eer(
    labels: np.ndarray | list[int],
    scores: np.ndarray | list[float],
) -> tuple[float, float]:
    """
    Computes Equal Error Rate (EER) and the operating threshold where FAR == FRR.

    Args:
        labels: 1D array of ground truth labels (0 = bonafide, 1 = spoof).
        scores: 1D array of countermeasure scores (higher = more likely spoof).

    Returns:
        (eer_fraction, optimal_threshold)
    """
    labels = np.asarray(labels, dtype=np.int32)
    scores = np.asarray(scores, dtype=np.float64)

    n_spoof = int(np.sum(labels == 1))
    n_bonafide = int(np.sum(labels == 0))

    if n_spoof == 0 or n_bonafide == 0:
        log.warning("Cannot compute EER: missing bonafide or spoof samples")
        return float("nan"), 0.5

    # Sort descending by score
    sorted_indices = np.argsort(scores)[::-1]
    sorted_labels = labels[sorted_indices]
    sorted_scores = scores[sorted_indices]

    # Cumulative false alarms (bonafide classified as spoof) and misses (spoof missed)
    # At threshold theta: predicted spoof if score >= theta
    is_spoof = (sorted_labels == 1)
    is_bonafide = (sorted_labels == 0)

    cum_spoof_detected = np.cumsum(is_spoof)
    cum_bonafide_rejected = np.cumsum(is_bonafide)

    # FRR = (total spoof - detected spoof) / total spoof
    frr = (n_spoof - cum_spoof_detected) / float(n_spoof)
    # FAR = (bonafide rejected as spoof) / total bonafide
    far = cum_bonafide_rejected / float(n_bonafide)

    # Find crossover point where |FAR - FRR| is minimal
    diff = np.abs(far - frr)
    idx = int(np.argmin(diff))

    eer = float((far[idx] + frr[idx]) / 2.0)
    opt_threshold = float(sorted_scores[idx])

    return eer, opt_threshold


# ===========================================================================
# 2. ASVspoof min t-DCF (Tandem Detection Cost Function)
# ===========================================================================

def compute_min_tdcf(
    labels: np.ndarray | list[int],
    cm_scores: np.ndarray | list[float],
    p_tar: float = 0.9405,
    p_non: float = 0.0095,
    p_spoof: float = 0.05,
    c_miss: float = 1.0,
    c_fa: float = 10.0,
    p_miss_asv: float = 0.01,
    p_fa_asv: float = 0.01,
    p_fa_spoof_asv: float = 0.05,
) -> tuple[float, float]:
    """
    Computes the normalized minimum tandem Detection Cost Function (min t-DCF)
    according to ASVspoof 2019 / 2021 specification.

    Returns:
        (min_tdcf_value, optimal_threshold)
    """
    labels = np.asarray(labels, dtype=np.int32)
    scores = np.asarray(cm_scores, dtype=np.float64)

    n_spoof = int(np.sum(labels == 1))
    n_bonafide = int(np.sum(labels == 0))

    if n_spoof == 0 or n_bonafide == 0:
        return float("nan"), 0.5

    # Cost weights
    C1 = c_miss * p_tar * p_miss_asv + c_fa * p_non * p_fa_asv
    C2 = c_fa * p_spoof * p_fa_spoof_asv
    default_cost = min(c_miss * p_tar, c_fa * (p_non + p_spoof))

    sorted_indices = np.argsort(scores)[::-1]
    sorted_labels = labels[sorted_indices]
    sorted_scores = scores[sorted_indices]

    cum_spoof_detected = np.cumsum(sorted_labels == 1)
    cum_bonafide_rejected = np.cumsum(sorted_labels == 0)

    # CM Miss probability (P_miss_cm: spoof predicted bonafide)
    p_miss_cm = (n_spoof - cum_spoof_detected) / float(n_spoof)
    # CM False alarm probability (P_fa_cm: bonafide predicted spoof)
    p_fa_cm = cum_bonafide_rejected / float(n_bonafide)

    # Total tandem cost curve
    t_dcf_curve = C1 * p_fa_cm + C2 * p_miss_cm
    norm_tdcf_curve = t_dcf_curve / default_cost

    min_idx = int(np.argmin(norm_tdcf_curve))
    min_tdcf = float(norm_tdcf_curve[min_idx])
    opt_threshold = float(sorted_scores[min_idx])

    return min_tdcf, opt_threshold


# ===========================================================================
# 3. Comprehensive Anti-Spoofing Metrics Suite
# ===========================================================================

def compute_metrics_summary(
    labels: np.ndarray | list[int],
    scores: np.ndarray | list[float],
    threshold: Optional[float] = None,
) -> dict[str, Any]:
    """
    Computes a comprehensive evaluation metrics summary.

    Returns:
        dict with keys:
            - eer: Equal Error Rate [0, 1]
            - eer_pct: EER as percentage
            - min_tdcf: Normalized min t-DCF
            - eer_threshold: Threshold at EER crossover
            - operating_threshold: Specified or calibrated threshold
            - accuracy: Binary classification accuracy
            - precision: Precision for spoof detection
            - recall: Recall / True Positive Rate for spoof detection
            - f1_score: F1 score
            - auc_roc: Area under the ROC curve
            - far_at_1pct_frr: FAR when FRR is fixed at 1%
            - frr_at_1pct_far: FRR when FAR is fixed at 1%
            - total_samples: Total sample count
            - bonafide_count: Bonafide sample count
            - spoof_count: Spoof sample count
    """
    labels = np.asarray(labels, dtype=np.int32)
    scores = np.asarray(scores, dtype=np.float64)

    eer, opt_thresh = compute_eer(labels, scores)
    min_tdcf, tdcf_thresh = compute_min_tdcf(labels, scores)

    eval_thresh = threshold if threshold is not None else opt_thresh
    preds = (scores >= eval_thresh).astype(np.int32)

    tp = int(np.sum((preds == 1) & (labels == 1)))
    fp = int(np.sum((preds == 1) & (labels == 0)))
    tn = int(np.sum((preds == 0) & (labels == 0)))
    fn = int(np.sum((preds == 0) & (labels == 1)))

    n_total = len(labels)
    n_bonafide = tn + fp
    n_spoof = tp + fn

    accuracy = float((tp + tn) / max(1, n_total))
    precision = float(tp / max(1, (tp + fp)))
    recall = float(tp / max(1, n_spoof))
    f1 = float(2 * precision * recall / max(1e-6, (precision + recall)))

    # Compute AUC-ROC via trapezoidal integration
    try:
        from sklearn.metrics import roc_auc_score
        auc_roc = float(roc_auc_score(labels, scores))
    except Exception:
        # Fallback rank-sum calculation for AUC
        ranks = np.argsort(np.argsort(scores))
        sum_ranks_spoof = np.sum(ranks[labels == 1])
        auc_roc = float((sum_ranks_spoof - n_spoof * (n_spoof + 1) / 2.0) / max(1, (n_spoof * n_bonafide)))

    # Compute operational operating points: FAR @ FRR=1% and FRR @ FAR=1%
    sorted_idx = np.argsort(scores)[::-1]
    s_labels = labels[sorted_idx]
    cum_tp = np.cumsum(s_labels == 1)
    cum_fp = np.cumsum(s_labels == 0)

    cur_frr = (n_spoof - cum_tp) / float(max(1, n_spoof))
    cur_far = cum_fp / float(max(1, n_bonafide))

    # FAR @ FRR ~= 1% (0.01)
    frr_target_idx = np.argmin(np.abs(cur_frr - 0.01))
    far_at_1pct_frr = float(cur_far[frr_target_idx])

    # FRR @ FAR ~= 1% (0.01)
    far_target_idx = np.argmin(np.abs(cur_far - 0.01))
    frr_at_1pct_far = float(cur_frr[far_target_idx])

    return {
        "eer": round(eer, 4),
        "eer_pct": round(eer * 100.0, 2),
        "min_tdcf": round(min_tdcf, 4),
        "eer_threshold": round(opt_thresh, 4),
        "operating_threshold": round(eval_thresh, 4),
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "auc_roc": round(auc_roc, 4),
        "far_at_1pct_frr": round(far_at_1pct_frr, 4),
        "frr_at_1pct_far": round(frr_at_1pct_far, 4),
        "total_samples": n_total,
        "bonafide_count": n_bonafide,
        "spoof_count": n_spoof,
    }
