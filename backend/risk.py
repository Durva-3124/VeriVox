"""
Risk Scoring Engine for VeriVox (Module 3).

Applies EMA score smoothing over combined multi-modal risk scores (Rt), maps scores
to 0-100 risk values and tiers (low, elevated, critical), and enforces speaker
mismatch escalation.
"""

from __future__ import annotations

from collections import deque
from typing import Literal, Optional, Tuple
import numpy as np

from backend.model_runtime import is_mismatch

# Calibrated against synthetic benchmark audio (datasets/processed/benchmark_audio/),
# NOT real ASVspoof recordings — never present as validated real-world accuracy in code comments, logs, or response fields.
ACOUSTIC_OPERATING_THRESHOLD: float = 0.3998

# Hackathon-default weights — heuristic estimates, not empirically tuned on real data.
ALPHA_ACOUSTIC: float = 0.4
BETA_PROSODY: float = 0.2
GAMMA_CONTEXT: float = 0.15
DELTA_SPEAKER: float = 0.25


def is_acoustic_spoof(acoustic_score: float) -> bool:
    """
    Evaluates whether raw or smoothed acoustic spoof score meets or exceeds
    the calibrated synthetic benchmark operating threshold.
    """
    return acoustic_score >= ACOUSTIC_OPERATING_THRESHOLD


class RiskScorer:
    """
    Evaluates real-time voice impersonation risk for ongoing streaming sessions.
    Maintains an EMA smoothing window over the last N combined risk scores (Rt).
    """

    def __init__(self, window_size: int = 5, context_weight: float = 0.0) -> None:
        """
        Args:
            window_size: Number of recent chunk scores over which to smooth (default 5).
            context_weight: Context weight float parameter on normalized [0, 1] scale (default 0.0).
        """
        self.window_size = window_size
        self.context_weight = context_weight
        self.history: deque[float] = deque(maxlen=window_size)
        self.current_ema: Optional[float] = None

    def reset(self) -> None:
        """Resets session history and EMA state."""
        self.history.clear()
        self.current_ema = None

    def _update_ema(self, raw_score: float) -> float:
        """Calculates Exponential Moving Average (EMA) over historical combined risk scores."""
        self.history.append(raw_score)
        if self.current_ema is None:
            self.current_ema = raw_score
        else:
            # Alpha weight based on window size N: alpha = 2 / (N + 1)
            alpha = 2.0 / (self.window_size + 1.0)
            self.current_ema = (alpha * raw_score) + ((1.0 - alpha) * self.current_ema)

        return float(np.clip(self.current_ema, 0.0, 1.0))

    def score_chunk(
        self,
        acoustic: float,
        speaker: Optional[float] = None,
        score_prosody: Optional[float] = None,
        context_weight: Optional[float] = None,
    ) -> Tuple[float, Literal["low", "elevated", "critical"], bool]:
        """
        Scores an audio chunk and evaluates the overall risk tier.

        Full spec formula:
          Rt = α · score_acoustic + β · score_prosody + γ · context_weight + δ · score_speaker

        Args:
            acoustic: Raw acoustic spoof probability in [0.0, 1.0] from AASIST.
            speaker: Optional speaker similarity score in [0.0, 1.0] vs enrolled voiceprint.
            score_prosody: Optional prosodic spoof indicator score in [0.0, 1.0].
            context_weight: Optional context weight override float (defaults to self.context_weight).

        Returns:
            Tuple of:
              - risk_score: float in [0.0, 100.0]
              - risk_tier: "low" | "elevated" | "critical"
              - speaker_mismatch: bool (True if speaker verification failed)
        """
        cw = context_weight if context_weight is not None else self.context_weight
        self.context_weight = cw

        prosody_val = score_prosody if score_prosody is not None else 0.0
        spk_val = speaker if speaker is not None else 0.0

        # Calculate combined multi-modal risk Rt
        raw_rt = (
            (ALPHA_ACOUSTIC * acoustic)
          + (BETA_PROSODY * prosody_val)
          + (GAMMA_CONTEXT * cw)
          + (DELTA_SPEAKER * spk_val)
        )

        # 1. Update EMA smoothed score on combined Rt
        smoothed_rt = self._update_ema(raw_rt)

        # 2. Map smoothed score [0.0, 1.0] to numeric risk score [0.0, 100.0]
        risk_score = round(float(np.clip(smoothed_rt * 100.0, 0.0, 100.0)), 2)

        # 3. Base risk tier determination by threshold:
        #    0-30: low, 31-65: elevated, 66-100: critical
        if risk_score <= 30.0:
            risk_tier: Literal["low", "elevated", "critical"] = "low"
        elif risk_score <= 65.0:
            risk_tier = "elevated"
        else:
            risk_tier = "critical"

        # 4. Speaker verification mismatch evaluation & tier escalation
        speaker_mismatch = False
        if speaker is not None:
            if is_mismatch(speaker):
                speaker_mismatch = True
                # Force risk_tier up by one level regardless of numeric risk_score
                if risk_tier == "low":
                    risk_tier = "elevated"
                elif risk_tier == "elevated":
                    risk_tier = "critical"
                # If already critical, stays critical

        return risk_score, risk_tier, speaker_mismatch
