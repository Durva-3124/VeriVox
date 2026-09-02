"""
Codec normalization for VeriVox ingestion.

Loads any audio file (WAV, MP3, FLAC, OGG, etc.) and returns a
16 kHz mono float32 numpy array.

Uses soundfile for lossless formats and falls back to torchaudio
for compressed formats (MP3, AAC, etc.).
"""

from __future__ import annotations
from pathlib import Path
import numpy as np

TARGET_SR = 16_000


def load_and_normalize(path: str | Path) -> np.ndarray:
    """
    Load an audio file and return a (T,) float32 array at 16 kHz mono.

    Tries soundfile first (fast, lossless), falls back to torchaudio
    for compressed formats.

    Args:
        path: Path to any audio file.

    Returns:
        (T,) float32 numpy array, mono, 16 kHz, values in [-1, 1].
    """
    path = Path(path)
    try:
        return _load_soundfile(path)
    except Exception:
        return _load_torchaudio(path)


def normalize_array(
    waveform: np.ndarray,
    sr: int,
) -> np.ndarray:
    """
    Normalize an already-loaded numpy array to 16 kHz mono float32.

    Args:
        waveform: (T,) or (C, T) float32 array.
        sr:       Source sample rate.

    Returns:
        (T,) float32 array at 16 kHz mono.
    """
    wav = waveform.astype(np.float32)

    # Mix down to mono
    if wav.ndim == 2:
        wav = wav.mean(axis=0)

    # Resample if needed
    if sr != TARGET_SR:
        wav = _resample_numpy(wav, sr, TARGET_SR)

    return wav


# ---------------------------------------------------------------------------
# Internal loaders
# ---------------------------------------------------------------------------

def _load_soundfile(path: Path) -> np.ndarray:
    import soundfile as sf
    wav, sr = sf.read(str(path), dtype="float32", always_2d=False)
    # soundfile returns (T,) for mono, (T, C) for multi-channel
    if wav.ndim == 2:
        wav = wav.mean(axis=1)
    if sr != TARGET_SR:
        wav = _resample_numpy(wav, sr, TARGET_SR)
    return wav


def _load_torchaudio(path: Path) -> np.ndarray:
    import torchaudio
    import torchaudio.functional as F
    wav, sr = torchaudio.load(str(path))  # (C, T)
    wav = wav.mean(dim=0)                 # (T,)
    if sr != TARGET_SR:
        wav = F.resample(wav, sr, TARGET_SR)
    return wav.numpy().astype(np.float32)


def _resample_numpy(wav: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    """Resample using scipy if available, else torchaudio."""
    try:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(orig_sr, target_sr)
        return resample_poly(wav, target_sr // g, orig_sr // g).astype(np.float32)
    except ImportError:
        import torch
        import torchaudio.functional as F
        t = torch.from_numpy(wav)
        return F.resample(t, orig_sr, target_sr).numpy().astype(np.float32)
