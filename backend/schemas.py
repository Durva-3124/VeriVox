"""
Audio stream and risk update Pydantic schemas for VeriVox (Module 3).
"""

from __future__ import annotations

import base64
from typing import Literal, Optional
import numpy as np
from pydantic import BaseModel, Field


class AudioChunk(BaseModel):
    """
    Incoming 200ms audio stream chunk payload contract from ingestion.
    Contract: 3200 samples @ 16kHz, mono, float32, base64-encoded PCM.
    """
    chunk_id: int
    timestamp_capture_ms: int
    sample_rate: int
    duration_ms: int
    is_speech: bool
    audio_b64: str

    def decode_audio(self) -> np.ndarray:
        """
        Decodes base64-encoded PCM audio into a 1D float32 numpy array [-1.0, 1.0].
        Validates against the confirmed 16 kHz, 3,200 samples (200 ms) contract.
        """
        if self.sample_rate != 16000:
            raise ValueError(f"Invalid sample rate {self.sample_rate} Hz. Contract requires 16000 Hz.")

        if not self.audio_b64:
            return np.zeros(0, dtype=np.float32)

        try:
            raw_bytes = base64.b64decode(self.audio_b64)
        except Exception as e:
            raise ValueError(f"Failed to decode base64 audio payload: {e}") from e

        # Handle raw int16 PCM (2 bytes/sample) or raw float32 PCM (4 bytes/sample)
        num_bytes = len(raw_bytes)
        if num_bytes == 6400:  # 3200 samples * 2 bytes (16-bit PCM)
            int16_samples = np.frombuffer(raw_bytes, dtype=np.int16)
            float_samples = int16_samples.astype(np.float32) / 32768.0
        elif num_bytes == 12800:  # 3200 samples * 4 bytes (float32 PCM)
            float_samples = np.frombuffer(raw_bytes, dtype=np.float32).copy()
        elif num_bytes % 2 == 0 and num_bytes > 0:
            # Fallback for int16 PCM of non-standard byte length
            int16_samples = np.frombuffer(raw_bytes, dtype=np.int16)
            float_samples = int16_samples.astype(np.float32) / 32768.0
        else:
            raise ValueError(f"Invalid audio payload byte length ({num_bytes} bytes).")

        expected_samples = 3200
        if len(float_samples) != expected_samples:
            raise ValueError(
                f"Invalid chunk length {len(float_samples)} samples. "
                f"Contract requires exactly {expected_samples} samples (200ms at 16kHz)."
            )

        return float_samples.astype(np.float32)


class RiskUpdate(BaseModel):
    """
    Outgoing real-time risk assessment response payload per audio chunk.
    """
    chunk_id: int
    score_acoustic: float
    score_speaker: Optional[float] = None
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Risk score from 0 (genuine) to 100 (critical spoof)")
    risk_tier: Literal["low", "elevated", "critical"]
    speaker_mismatch: bool
    latency_ms: float
