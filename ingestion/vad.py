"""
Energy-based Voice Activity Detection.

Operates on 16 kHz mono float32 waveforms.
No external ML dependencies — uses RMS energy per frame.
"""

from __future__ import annotations
import numpy as np


_FRAME_LEN   = 160   # 10 ms at 16 kHz
_ENERGY_FLOOR = 1e-8


def _rms(frame: np.ndarray) -> float:
    return float(np.sqrt(np.mean(frame ** 2) + _ENERGY_FLOOR))


def compute_vad_mask(
    waveform: np.ndarray,
    threshold_db: float = -40.0,
    min_speech_frames: int = 3,
) -> np.ndarray:
    """
    Return a boolean mask (one value per 10 ms frame) — True = speech.

    Args:
        waveform:           (T,) float32 mono at 16 kHz.
        threshold_db:       Frames below this RMS level (dB) are silence.
        min_speech_frames:  Minimum consecutive speech frames to keep a region.

    Returns:
        mask: (N,) bool array, N = len(waveform) // _FRAME_LEN
    """
    n_frames = len(waveform) // _FRAME_LEN
    mask = np.zeros(n_frames, dtype=bool)
    threshold_linear = 10 ** (threshold_db / 20.0)

    for i in range(n_frames):
        frame = waveform[i * _FRAME_LEN : (i + 1) * _FRAME_LEN]
        mask[i] = _rms(frame) >= threshold_linear

    # Remove isolated speech blips shorter than min_speech_frames
    count = 0
    for i in range(n_frames):
        if mask[i]:
            count += 1
        else:
            if count < min_speech_frames:
                mask[i - count : i] = False
            count = 0

    return mask


def has_speech(waveform: np.ndarray, min_speech_ratio: float = 0.1) -> bool:
    """
    Return True if at least `min_speech_ratio` of frames are speech.
    Quick gate before sending a chunk to the model.
    """
    mask = compute_vad_mask(waveform)
    return mask.mean() >= min_speech_ratio
