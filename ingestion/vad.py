"""
Voice Activity Detection for VeriVox ingestion (Module 1).

Primary backend : WebRTC VAD (webrtcvad, aggressiveness=2)
                  — spec-compliant, frame-accurate, low-latency.
Fallback backend: RMS energy gate (-40 dB threshold)
                  — zero extra dependencies, used when webrtcvad is
                    not installed (e.g. CI environments, Windows without
                    the VC++ build tools required by webrtcvad).

Documented gating thresholds
-----------------------------
WebRTC VAD aggressiveness : 2  (0=least aggressive, 3=most aggressive)
    Level 2 balances sensitivity vs. false-positive silence rejection.
    Suitable for telephony-quality speech (8–16 kHz, SNR > 10 dB).

RMS energy fallback threshold : -40 dB
    Frames whose RMS amplitude is below 10^(-40/20) ≈ 0.01 are silence.
    min_speech_frames=3 suppresses isolated sub-30ms blips.

Public API
----------
    is_speech_webrtc(window, vad_instance) -> bool   # webrtcvad path
    compute_vad_mask(waveform, threshold_db, min_speech_frames) -> np.ndarray
    has_speech(waveform, min_speech_ratio) -> bool   # unified entry point
    make_vad() -> webrtcvad.Vad | None               # returns None if unavailable
"""

from __future__ import annotations
import numpy as np

# ---------------------------------------------------------------------------
# WebRTC VAD — primary backend
# ---------------------------------------------------------------------------

try:
    import webrtcvad as _webrtcvad
    _WEBRTCVAD_AVAILABLE = True
except ImportError:
    _webrtcvad = None  # type: ignore
    _WEBRTCVAD_AVAILABLE = False

# WebRTC VAD requires frames of exactly 10, 20, or 30 ms.
# We use 30 ms frames: 480 samples @ 16 kHz.
_WEBRTC_FRAME_MS      = 30
_WEBRTC_FRAME_SAMPLES = int(16_000 * _WEBRTC_FRAME_MS / 1000)   # 480
_WEBRTC_AGGRESSIVENESS = 2   # documented threshold

# ---------------------------------------------------------------------------
# RMS energy VAD — fallback backend
# ---------------------------------------------------------------------------

_FRAME_LEN        = 160    # 10 ms at 16 kHz
_ENERGY_FLOOR     = 1e-8
_RMS_THRESHOLD_DB = -40.0  # documented threshold


def _rms(frame: np.ndarray) -> float:
    return float(np.sqrt(np.mean(frame ** 2) + _ENERGY_FLOOR))


def _float32_to_int16(audio: np.ndarray) -> np.ndarray:
    """Convert float32 [-1, 1] to int16 for webrtcvad."""
    return np.clip(audio * 32767, -32768, 32767).astype(np.int16)


# ---------------------------------------------------------------------------
# Public: make_vad
# ---------------------------------------------------------------------------

def make_vad():
    """
    Return a configured webrtcvad.Vad(aggressiveness=2) instance,
    or None if webrtcvad is not installed (fallback to RMS energy).
    """
    if _WEBRTCVAD_AVAILABLE:
        return _webrtcvad.Vad(_WEBRTC_AGGRESSIVENESS)
    return None


# ---------------------------------------------------------------------------
# Public: is_speech_webrtc  (webrtcvad path)
# ---------------------------------------------------------------------------

def is_speech_webrtc(window: np.ndarray, vad_instance) -> bool:
    """
    Classify a 200 ms window using WebRTC VAD.

    Splits the window into 30 ms sub-frames and majority-votes.
    Returns True if > 50% of sub-frames are classified as speech.

    Args:
        window:       (3200,) float32 array @ 16 kHz.
        vad_instance: webrtcvad.Vad instance from make_vad().
    """
    window_int16 = _float32_to_int16(window)
    speech_votes = 0
    total_frames = 0
    for start in range(0, len(window_int16) - _WEBRTC_FRAME_SAMPLES + 1,
                       _WEBRTC_FRAME_SAMPLES):
        frame = window_int16[start : start + _WEBRTC_FRAME_SAMPLES]
        total_frames += 1
        if vad_instance.is_speech(frame.tobytes(), 16_000):
            speech_votes += 1
    if total_frames == 0:
        return False
    return (speech_votes / total_frames) > 0.5


# ---------------------------------------------------------------------------
# Public: compute_vad_mask  (RMS energy fallback)
# ---------------------------------------------------------------------------

def compute_vad_mask(
    waveform: np.ndarray,
    threshold_db: float = _RMS_THRESHOLD_DB,
    min_speech_frames: int = 3,
) -> np.ndarray:
    """
    Return a boolean mask (one value per 10 ms frame) — True = speech.
    Used as the fallback when webrtcvad is unavailable.

    Args:
        waveform:           (T,) float32 mono at 16 kHz.
        threshold_db:       Frames below this RMS level (dB) are silence.
                            Default: -40 dB (documented gating threshold).
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

    # Suppress isolated blips shorter than min_speech_frames
    count = 0
    for i in range(n_frames):
        if mask[i]:
            count += 1
        else:
            if count < min_speech_frames:
                mask[i - count : i] = False
            count = 0

    return mask


# ---------------------------------------------------------------------------
# Public: has_speech  (unified entry point used by pipeline.py)
# ---------------------------------------------------------------------------

def has_speech(
    waveform: np.ndarray,
    min_speech_ratio: float = 0.1,
    vad_instance=None,
) -> bool:
    """
    Return True if the waveform contains enough speech to pass the gate.

    Uses WebRTC VAD when available (primary), falls back to RMS energy.

    Args:
        waveform:         (T,) float32 mono at 16 kHz.
        min_speech_ratio: Fraction of frames that must be speech (RMS path).
                          Ignored when WebRTC VAD is used (majority-vote).
        vad_instance:     Optional pre-created webrtcvad.Vad. If None and
                          webrtcvad is available, a fresh instance is created.
    """
    if _WEBRTCVAD_AVAILABLE:
        vad = vad_instance if vad_instance is not None else make_vad()
        # Pad or trim to a multiple of _WEBRTC_FRAME_SAMPLES for clean iteration
        n_frames = len(waveform) // _WEBRTC_FRAME_SAMPLES
        if n_frames == 0:
            return False
        trimmed = waveform[: n_frames * _WEBRTC_FRAME_SAMPLES]
        return is_speech_webrtc(trimmed, vad)

    # Fallback: RMS energy gate
    mask = compute_vad_mask(waveform)
    if len(mask) == 0:
        return False
    return float(mask.mean()) >= min_speech_ratio
