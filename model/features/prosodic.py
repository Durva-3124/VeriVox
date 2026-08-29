"""
Prosodic / behavioural feature extraction for VeriVox anti-spoofing (Module 2).

Uses praat-parselmouth for F0, jitter, and shimmer when available (more
accurate, Praat-grade), with a pure-librosa fallback for environments
where parselmouth is not installed.

Features and their spoof-detection rationale
--------------------------------------------
f0_mean, f0_std, f0_range
    TTS systems often produce unnaturally flat or over-smoothed F0 contours.
    Low std / range indicates robotic prosody.

jitter_local
    Cycle-to-cycle F0 period variation. Natural voices have ~0.5–1.5 %.
    Neural vocoders tend to produce near-zero jitter (too regular).

shimmer_local
    Cycle-to-cycle amplitude variation. Same rationale as jitter.
    Synthesised speech is often too clean (shimmer < 0.5 dB).

pause_count, pause_mean_dur_s, pause_total_ratio
    Genuine speech has natural pause patterns. TTS may produce no pauses
    or unnaturally uniform pauses.

speech_rate_syl_per_s
    Syllable-rate estimate via energy-envelope peak counting.
    TTS systems sometimes produce unnaturally constant speech rate.

Public API
----------
    extract_prosodic_features(waveform, sr) -> dict[str, float]
"""

from __future__ import annotations

import warnings
import numpy as np
import torch
import librosa
from scipy.signal import find_peaks

# ---------------------------------------------------------------------------
# Optional parselmouth import
# ---------------------------------------------------------------------------

try:
    import parselmouth
    from parselmouth.praat import call
    _PARSELMOUTH = True
except ImportError:                          # pragma: no cover
    _PARSELMOUTH = False

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_numpy(waveform: torch.Tensor | np.ndarray) -> np.ndarray:
    if isinstance(waveform, torch.Tensor):
        return waveform.detach().cpu().numpy().astype(np.float64)
    arr = np.asarray(waveform, dtype=np.float64)
    if arr.ndim > 1:
        arr = arr.mean(axis=0)
    return arr


# ---------------------------------------------------------------------------
# F0 contour — parselmouth path
# ---------------------------------------------------------------------------

def _f0_parselmouth(y: np.ndarray, sr: int) -> np.ndarray:
    """Return voiced F0 values (Hz) via Praat autocorrelation."""
    snd = parselmouth.Sound(y, sampling_frequency=sr)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=600.0)
    f0 = pitch.selected_array["frequency"]          # 0 = unvoiced
    return f0[f0 > 0].astype(np.float64)


# ---------------------------------------------------------------------------
# F0 contour — librosa fallback
# ---------------------------------------------------------------------------

def _f0_librosa(y: np.ndarray, sr: int) -> np.ndarray:
    """Return voiced F0 values (Hz) via librosa pyin."""
    f0, voiced_flag, _ = librosa.pyin(
        y.astype(np.float32),
        fmin=75.0,
        fmax=600.0,
        sr=sr,
        frame_length=2048,
        hop_length=256,
    )
    f0 = np.asarray(f0, dtype=np.float64)
    voiced = np.asarray(voiced_flag, dtype=bool)
    return f0[voiced & ~np.isnan(f0)]


# ---------------------------------------------------------------------------
# F0 statistics
# ---------------------------------------------------------------------------

def _f0_stats(f0_voiced: np.ndarray) -> dict[str, float]:
    if len(f0_voiced) < 2:
        return {"f0_mean": 0.0, "f0_std": 0.0, "f0_range": 0.0}
    return {
        "f0_mean":  float(np.mean(f0_voiced)),
        "f0_std":   float(np.std(f0_voiced)),
        "f0_range": float(np.ptp(f0_voiced)),   # max - min
    }


# ---------------------------------------------------------------------------
# Jitter — parselmouth path
# ---------------------------------------------------------------------------

def _jitter_parselmouth(y: np.ndarray, sr: int) -> float:
    """Local jitter (%) via Praat PointProcess."""
    snd   = parselmouth.Sound(y, sampling_frequency=sr)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=600.0)
    pp    = call(snd, "To PointProcess (periodic, cc)", 75.0, 600.0)
    try:
        jitter = call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
        return float(jitter) if np.isfinite(jitter) else 0.0
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Jitter — librosa fallback (period-to-period variation from pyin F0)
# ---------------------------------------------------------------------------

def _jitter_librosa(y: np.ndarray, sr: int) -> float:
    """
    Approximate local jitter from pyin F0 periods.
    jitter_local = mean(|T[i+1] - T[i]|) / mean(T)
    """
    f0_voiced = _f0_librosa(y, sr)
    if len(f0_voiced) < 3:
        return 0.0
    periods = 1.0 / f0_voiced
    diffs   = np.abs(np.diff(periods))
    return float(np.mean(diffs) / (np.mean(periods) + 1e-10))


# ---------------------------------------------------------------------------
# Shimmer — parselmouth path
# ---------------------------------------------------------------------------

def _shimmer_parselmouth(y: np.ndarray, sr: int) -> float:
    """Local shimmer (dB) via Praat PointProcess + amplitude."""
    snd = parselmouth.Sound(y, sampling_frequency=sr)
    pp  = call(snd, "To PointProcess (periodic, cc)", 75.0, 600.0)
    try:
        shimmer = call([snd, pp], "Get shimmer (local_dB)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        return float(shimmer) if np.isfinite(shimmer) else 0.0
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Shimmer — librosa fallback (RMS amplitude variation at pitch periods)
# ---------------------------------------------------------------------------

def _shimmer_librosa(y: np.ndarray, sr: int) -> float:
    """
    Approximate shimmer from frame-level RMS amplitude variation.
    shimmer_local = mean(|A[i+1] - A[i]|) / mean(A)
    """
    rms = librosa.feature.rms(y=y.astype(np.float32), frame_length=512, hop_length=128)[0]
    rms = rms[rms > 1e-6]
    if len(rms) < 3:
        return 0.0
    diffs = np.abs(np.diff(rms))
    return float(np.mean(diffs) / (np.mean(rms) + 1e-10))


# ---------------------------------------------------------------------------
# Pause statistics
# ---------------------------------------------------------------------------

def _pause_stats(
    y: np.ndarray,
    sr: int,
    energy_threshold_db: float = -40.0,
    min_pause_s: float = 0.1,
) -> dict[str, float]:
    """
    Detect silence segments using short-time RMS energy.

    Returns:
        pause_count          number of pause segments
        pause_mean_dur_s     mean pause duration in seconds
        pause_total_ratio    fraction of total duration that is silence
    """
    hop = 128
    rms = librosa.feature.rms(y=y.astype(np.float32), frame_length=512, hop_length=hop)[0]

    # Convert to dB, silence = below threshold
    rms_db   = librosa.amplitude_to_db(rms + 1e-10)
    is_silent = rms_db < energy_threshold_db

    # Find contiguous silent runs
    min_frames = max(1, int(min_pause_s * sr / hop))
    pauses: list[float] = []
    count = 0
    for val, group in _run_length(is_silent):
        if val and group >= min_frames:
            pauses.append(group * hop / sr)
            count += 1

    total_dur = len(y) / sr
    return {
        "pause_count":        float(count),
        "pause_mean_dur_s":   float(np.mean(pauses)) if pauses else 0.0,
        "pause_total_ratio":  float(sum(pauses) / (total_dur + 1e-10)),
    }


def _run_length(arr: np.ndarray):
    """Yield (value, run_length) pairs for a boolean array."""
    if len(arr) == 0:
        return
    current, count = arr[0], 1
    for v in arr[1:]:
        if v == current:
            count += 1
        else:
            yield current, count
            current, count = v, 1
    yield current, count


# ---------------------------------------------------------------------------
# Speech rate (syllable cadence via energy-envelope peaks)
# ---------------------------------------------------------------------------

def _speech_rate(y: np.ndarray, sr: int) -> float:
    """
    Estimate syllable rate (syllables/second) by counting peaks in the
    smoothed energy envelope of the speech signal.

    Method:
        1. Compute short-time RMS envelope.
        2. Smooth with a 200 ms Hanning window.
        3. Count peaks above a relative threshold.
        4. Divide by voiced duration.

    Typical natural speech: 3–8 syllables/second.
    """
    hop = 128
    rms = librosa.feature.rms(y=y.astype(np.float32), frame_length=512, hop_length=hop)[0]

    # Smooth: 200 ms window in frames
    smooth_frames = max(3, int(0.2 * sr / hop))
    window = np.hanning(smooth_frames)
    window /= window.sum()
    smoothed = np.convolve(rms, window, mode="same")

    # Peak detection: min distance = 80 ms (max ~12 syl/s)
    min_dist = max(1, int(0.08 * sr / hop))
    threshold = 0.1 * smoothed.max()
    peaks, _ = find_peaks(smoothed, height=threshold, distance=min_dist)

    voiced_dur = float(np.sum(rms > threshold) * hop / sr)
    if voiced_dur < 0.1:
        return 0.0
    return float(len(peaks) / voiced_dur)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_prosodic_features(
    waveform: torch.Tensor | np.ndarray,
    sr: int,
) -> dict[str, float]:
    """
    Extract prosodic / behavioural features from a waveform.

    Args:
        waveform: 1-D audio signal — torch.Tensor or np.ndarray, mono.
        sr:       sample rate in Hz (16 000 for VeriVox).

    Returns:
        Flat dict of scalar floats:
            f0_mean              Hz  — mean voiced F0
            f0_std               Hz  — F0 standard deviation
            f0_range             Hz  — F0 max - min
            jitter_local         —   cycle-to-cycle period variation
            shimmer_local        —   cycle-to-cycle amplitude variation
            pause_count          —   number of silence segments
            pause_mean_dur_s     s   — mean pause duration
            pause_total_ratio    —   fraction of signal that is silence
            speech_rate_syl_per_s —  estimated syllables per second

    Backend: parselmouth (Praat) if installed, else librosa fallback.
    """
    y = _to_numpy(waveform)

    if _PARSELMOUTH:
        f0_voiced = _f0_parselmouth(y, sr)
        jitter    = _jitter_parselmouth(y, sr)
        shimmer   = _shimmer_parselmouth(y, sr)
    else:
        warnings.warn(
            "praat-parselmouth not found — using librosa fallback for F0/jitter/shimmer. "
            "Install with: pip install praat-parselmouth",
            RuntimeWarning,
            stacklevel=2,
        )
        f0_voiced = _f0_librosa(y, sr)
        jitter    = _jitter_librosa(y, sr)
        shimmer   = _shimmer_librosa(y, sr)

    features: dict[str, float] = {}
    features.update(_f0_stats(f0_voiced))
    features["jitter_local"]          = jitter
    features["shimmer_local"]         = shimmer
    features.update(_pause_stats(y, sr))
    features["speech_rate_syl_per_s"] = _speech_rate(y, sr)

    return features


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import math

    SR = 16_000
    T  = SR * 4
    t  = np.linspace(0, 4.0, T, endpoint=False)

    backend = "parselmouth (Praat)" if _PARSELMOUTH else "librosa fallback"
    print(f"Backend: {backend}")
    print("=" * 52)

    # Signal 1: voiced harmonic tone — bonafide-like
    print("Signal 1: harmonic tone with natural jitter (bonafide-like)")
    rng = np.random.default_rng(0)
    # Add small random period perturbations to simulate natural jitter
    f0_base = 150.0
    phase = np.cumsum(2 * math.pi * f0_base / SR * (1 + 0.005 * rng.standard_normal(T)))
    tone = (
        0.4 * np.sin(phase)
      + 0.25 * np.sin(2 * phase)
      + 0.15 * np.sin(3 * phase)
      + 0.02 * rng.standard_normal(T)
    ).astype(np.float32)
    # Insert a natural pause in the middle
    tone[SR * 1 : SR * 1 + int(SR * 0.3)] = 0.0

    feats = extract_prosodic_features(tone, SR)
    for k, v in feats.items():
        print(f"  {k:<28s}: {v:.4f}")

    print()
    print("Signal 2: flat-pitch tone, no pauses (TTS-like)")
    flat_tone = (0.4 * np.sin(2 * math.pi * 200 * t)).astype(np.float32)
    feats = extract_prosodic_features(flat_tone, SR)
    for k, v in feats.items():
        print(f"  {k:<28s}: {v:.4f}")

    print()
    print("Signal 3: white noise (unvoiced / spoof-like)")
    noise = (rng.standard_normal(T) * 0.3).astype(np.float32)
    feats = extract_prosodic_features(noise, SR)
    for k, v in feats.items():
        print(f"  {k:<28s}: {v:.4f}")

    print()
    print("Signal 4: torch.Tensor input (API check)")
    feats = extract_prosodic_features(torch.from_numpy(tone), SR)
    for k, v in feats.items():
        print(f"  {k:<28s}: {v:.4f}")
    print("=" * 52)
