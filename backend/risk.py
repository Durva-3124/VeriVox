"""
Risk Scoring Engine for VeriVox (Module 3).

Applies EMA score smoothing over recent acoustic scores, maps confidence scores
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


def is_acoustic_spoof(acoustic_score: float) -> bool:
    """
    Evaluates whether raw or smoothed acoustic spoof score meets or exceeds
    the calibrated synthetic benchmark operating threshold.
    """
    return acoustic_score >= ACOUSTIC_OPERATING_THRESHOLD



class RiskScorer:
    """
    Evaluates real-time voice impersonation risk for ongoing streaming sessions.
    Maintains an EMA smoothing window over the last N acoustic spoof scores.
    """

    def __init__(self, window_size: int = 5, context_weight: float = 1.0) -> None:
        """
        Args:
            window_size: Number of recent chunk scores over which to smooth (default 5).
            context_weight: Stub weight float parameter for future context signals (default 1.0).
        """
        self.window_size = window_size
        self.context_weight = context_weight  # Stub parameter for future dataset signals
        self.history: deque[float] = deque(maxlen=window_size)
        self.current_ema: Optional[float] = None

    def reset(self) -> None:
        """Resets session history and EMA state."""
        self.history.clear()
        self.current_ema = None

    def _update_ema(self, raw_acoustic: float) -> float:
        """Calculates Exponential Moving Average (EMA) over historical acoustic scores."""
        self.history.append(raw_acoustic)
        if self.current_ema is None:
            self.current_ema = raw_acoustic
        else:
            # Alpha weight based on window size N: alpha = 2 / (N + 1)
            alpha = 2.0 / (self.window_size + 1.0)
            self.current_ema = (alpha * raw_acoustic) + ((1.0 - alpha) * self.current_ema)

        return float(np.clip(self.current_ema, 0.0, 1.0))

    def score_chunk(
        self,
        acoustic: float,
        speaker: Optional[float] = None
    ) -> Tuple[float, Literal["low", "elevated", "critical"], bool]:
        """
        Scores an audio chunk and evaluates the overall risk tier.

        Args:
            acoustic: Raw acoustic spoof probability in [0.0, 1.0] from AASIST.
            speaker: Optional speaker similarity score in [0.0, 1.0] vs enrolled voiceprint.

        Returns:
            Tuple of:
              - risk_score: float in [0.0, 100.0]
              - risk_tier: "low" | "elevated" | "critical"
              - speaker_mismatch: bool (True if speaker verification failed)
        """
        # 1. Update EMA smoothed acoustic score
        smoothed_acoustic = self._update_ema(acoustic)

        # 2. Map smoothed score [0.0, 1.0] to numeric risk score [0.0, 100.0]
        risk_score = round(float(np.clip(smoothed_acoustic * 100.0, 0.0, 100.0)), 2)

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
