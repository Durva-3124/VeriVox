"""
Acoustic feature extraction for VeriVox anti-spoofing (Module 2).

Each feature targets a known artefact class:

  spectral_rolloff       — TTS/VC systems often have unnaturally low or
                           high spectral roll-off due to bandwidth limits
                           in vocoders or missing high-frequency energy.

  phase_consistency      — Natural speech has smooth inter-frame phase
                           progression. Vocoders (Griffin-Lim, WaveNet,
                           HiFi-GAN) introduce phase discontinuities that
                           show up as high mean absolute phase deviation
                           across adjacent STFT frames.

  harmonic_structure     — Genuine voiced speech has strong, regular
                           harmonic peaks. Neural vocoders sometimes
                           over-smooth or distort the harmonic series,
                           reducing the harmonic-to-noise ratio.

  vocoder_artifact_2_4khz — The 2–4 kHz band is where many neural vocoders
                            leave spectral flatness artefacts (HiFi-GAN
                            aliasing, WaveGlow noise floor). A high
                            flatness ratio in this band relative to the
                            full spectrum is a spoof indicator.

Public API:
    extract_acoustic_features(waveform, sr) -> dict[str, float]
"""

from __future__ import annotations

import numpy as np
import torch
import librosa


# ---------------------------------------------------------------------------
# STFT helpers
# ---------------------------------------------------------------------------

_N_FFT   = 512
_HOP     = 128
_WIN     = 512


def _stft_magnitude_phase(waveform: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray]:
    """
    Returns:
        mag:   (F, T) magnitude spectrogram
        phase: (F, T) instantaneous phase in radians
    """
    D = librosa.stft(waveform, n_fft=_N_FFT, hop_length=_HOP, win_length=_WIN)
    return np.abs(D), np.angle(D)


def _freqs(sr: int) -> np.ndarray:
    """Frequency bin centres in Hz for the current STFT config."""
    return librosa.fft_frequencies(sr=sr, n_fft=_N_FFT)


def _to_numpy(waveform: torch.Tensor | np.ndarray) -> np.ndarray:
    if isinstance(waveform, torch.Tensor):
        return waveform.detach().cpu().numpy().astype(np.float32)
    return np.asarray(waveform, dtype=np.float32)


# ---------------------------------------------------------------------------
# Feature 1: Spectral roll-off (mean across frames, normalised by Nyquist)
# ---------------------------------------------------------------------------

def spectral_rolloff(waveform: np.ndarray, sr: int, roll_percent: float = 0.85) -> float:
    """
    Mean spectral roll-off frequency, normalised to [0, 1] by Nyquist.

    roll_percent: fraction of total spectral energy below the roll-off bin.
    """
    rolloff = librosa.feature.spectral_rolloff(
        y=waveform, sr=sr, n_fft=_N_FFT, hop_length=_HOP, roll_percent=roll_percent
    )                                          # (1, T)
    nyquist = sr / 2.0
    return float(np.mean(rolloff) / nyquist)  # normalised scalar


# ---------------------------------------------------------------------------
# Feature 2: Phase consistency (mean absolute inter-frame phase deviation)
# ---------------------------------------------------------------------------

def phase_consistency(waveform: np.ndarray, sr: int) -> float:
    """
    Measures smoothness of phase progression across adjacent STFT frames.

    Computes the instantaneous frequency deviation:
        delta_phi[f, t] = phi[f, t] - phi[f, t-1] - 2*pi*f*hop/sr
    (i.e. residual after removing the expected linear phase advance).

    Returns the mean absolute deviation, wrapped to [-pi, pi].
    Lower = more consistent (natural speech).
    Higher = more erratic (vocoder artefacts).
    Result is normalised by pi so the range is [0, 1].
    """
    _, phase = _stft_magnitude_phase(waveform, sr)

    # Expected phase advance per frame for each bin
    freqs = _freqs(sr)                                    # (F,)
    expected_advance = 2.0 * np.pi * freqs * _HOP / sr   # (F,)

    delta = np.diff(phase, axis=1)                        # (F, T-1)
    residual = delta - expected_advance[:, None]

    # Wrap to [-pi, pi]
    residual = (residual + np.pi) % (2 * np.pi) - np.pi

    return float(np.mean(np.abs(residual)) / np.pi)       # normalised [0, 1]


# ---------------------------------------------------------------------------
# Feature 3: Harmonic structure measure (HNR proxy via autocorrelation)
# ---------------------------------------------------------------------------

def harmonic_structure(waveform: np.ndarray, sr: int) -> float:
    """
    Harmonic-to-noise ratio proxy using short-time autocorrelation.

    For each frame, the ratio of the peak autocorrelation value (at the
    estimated pitch lag) to the zero-lag value approximates HNR.

    Returns the mean ratio across voiced frames (frames where a clear
    pitch peak exists above a threshold).
    Range: [0, 1] — higher = more harmonic (natural speech).
    """
    frame_len = _WIN
    hop       = _HOP
    n_frames  = 1 + (len(waveform) - frame_len) // hop

    ratios: list[float] = []
    for i in range(n_frames):
        frame = waveform[i * hop : i * hop + frame_len]
        if len(frame) < frame_len:
            break

        # Normalised autocorrelation
        ac = np.correlate(frame, frame, mode="full")
        ac = ac[len(ac) // 2:]                 # keep non-negative lags
        ac_norm = ac / (ac[0] + 1e-8)

        # Pitch search range: 50–500 Hz
        lag_min = int(sr / 500)
        lag_max = int(sr / 50)
        lag_max = min(lag_max, len(ac_norm) - 1)

        if lag_min >= lag_max:
            continue

        peak = np.max(ac_norm[lag_min:lag_max])
        if peak > 0.3:                         # voiced frame threshold
            ratios.append(float(peak))

    return float(np.mean(ratios)) if ratios else 0.0


# ---------------------------------------------------------------------------
# Feature 4: Vocoder artefact indicator in 2–4 kHz band
# ---------------------------------------------------------------------------

def vocoder_artifact_2_4khz(waveform: np.ndarray, sr: int) -> float:
    """
    Spectral flatness ratio: flatness in the 2–4 kHz band divided by
    flatness across the full spectrum.

    Neural vocoders (HiFi-GAN, WaveGlow, Griffin-Lim) tend to leave a
    flatter, more noise-like residual in the 2–4 kHz region compared to
    natural speech, which has structured formant energy there.

    Returns ratio >= 0.
      ~1.0  → band flatness matches full-spectrum flatness (neutral)
      > 1.0 → band is flatter than average (vocoder artefact indicator)
      < 1.0 → band is more tonal than average (natural speech indicator)
    """
    mag, _ = _stft_magnitude_phase(waveform, sr)   # (F, T)
    freqs  = _freqs(sr)                             # (F,)

    # Band mask: 2–4 kHz
    band_mask = (freqs >= 2000) & (freqs <= 4000)

    eps = 1e-10

    def _flatness(power: np.ndarray) -> float:
        # Spectral flatness = geometric mean / arithmetic mean (per frame, then averaged)
        geo  = np.exp(np.mean(np.log(power + eps), axis=0))   # (T,)
        arith = np.mean(power, axis=0)                         # (T,)
        return float(np.mean(geo / (arith + eps)))

    power      = mag ** 2
    flat_full  = _flatness(power)
    flat_band  = _flatness(power[band_mask])

    return float(flat_band / (flat_full + eps))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_acoustic_features(
    waveform: torch.Tensor | np.ndarray,
    sr: int,
) -> dict[str, float]:
    """
    Compute four spoof-discriminative acoustic features from a waveform.

    Args:
        waveform: 1-D audio signal — torch.Tensor or np.ndarray, mono, any length.
        sr:       sample rate in Hz (should be 16 000 for VeriVox).

    Returns:
        dict with keys:
            spectral_rolloff        float in [0, 1]
            phase_consistency       float in [0, 1]  (lower = more natural)
            harmonic_structure      float in [0, 1]  (higher = more harmonic)
            vocoder_artifact_2_4khz float >= 0       (higher = more artefact-like)
    """
    y = _to_numpy(waveform)
    if y.ndim > 1:
        y = y.mean(axis=0)   # mix to mono if needed

    return {
        "spectral_rolloff":        spectral_rolloff(y, sr),
        "phase_consistency":       phase_consistency(y, sr),
        "harmonic_structure":      harmonic_structure(y, sr),
        "vocoder_artifact_2_4khz": vocoder_artifact_2_4khz(y, sr),
    }


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import math

    SR = 16_000
    T  = SR * 4   # 4 seconds

    print("=" * 52)
    print("Signal 1: clean harmonic tone (bonafide-like)")
    t = np.linspace(0, 4.0, T, endpoint=False)
    # Voiced-speech-like: fundamental + harmonics + small noise
    tone = (
        0.4 * np.sin(2 * math.pi * 150 * t)   # F0 = 150 Hz
      + 0.3 * np.sin(2 * math.pi * 300 * t)
      + 0.2 * np.sin(2 * math.pi * 450 * t)
      + 0.1 * np.sin(2 * math.pi * 600 * t)
      + 0.02 * np.random.randn(T)
    ).astype(np.float32)
    feats = extract_acoustic_features(tone, SR)
    for k, v in feats.items():
        print(f"  {k:<30s}: {v:.6f}")

    print()
    print("Signal 2: white noise (spoof-like / unvoiced)")
    noise = np.random.randn(T).astype(np.float32) * 0.3
    feats = extract_acoustic_features(noise, SR)
    for k, v in feats.items():
        print(f"  {k:<30s}: {v:.6f}")

    print()
    print("Signal 3: torch.Tensor input (API check)")
    tensor_input = torch.from_numpy(tone)
    feats = extract_acoustic_features(tensor_input, SR)
    for k, v in feats.items():
        print(f"  {k:<30s}: {v:.6f}")
    print("=" * 52)
