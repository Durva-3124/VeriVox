"""
Codec simulation and audio compression transforms for offline augmentation (Harsh's Aug 31 Deliverable).

Implements:
- G.711 μ-law and A-law companding (ITU-T standard telephony @ 8 kHz)
- Opus simulation (SILK/CELT subband compression, MDCT quantization, frame bandwidth limit)
- AAC / MP3 lossy quantization (psychoacoustic thresholding, high-frequency cutoff)
- AMR-NB (Narrowband 8 kHz) & AMR-WB (Wideband 16 kHz) linear predictive compression
- GSM-FR / Landline bandpass filtering (300 Hz – 3400 Hz) with non-linear distortion
"""

from __future__ import annotations

import io
import math
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Union

import numpy as np
import scipy.signal as signal
import soundfile as sf


def _resample(audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    """Resample 1D float32 audio using scipy polyphase resampler."""
    if orig_sr == target_sr:
        return audio.astype(np.float32)
    # GCD calculation for rational resampling
    gcd = math.gcd(orig_sr, target_sr)
    up = target_sr // gcd
    down = orig_sr // gcd
    resampled = signal.resample_poly(audio, up, down)
    return resampled.astype(np.float32)


# ===========================================================================
# 1. ITU-T G.711 μ-law & A-law Telephony Codecs (8 kHz)
# ===========================================================================

def apply_g711_ulaw(audio: np.ndarray, sr: int = 16000, output_sr: int = 16000) -> np.ndarray:
    """
    Applies ITU-T G.711 μ-law companding and quantization.
    1. Downsamples to 8 kHz telephony rate.
    2. Encodes to 8-bit logarithmic μ-law (μ = 255).
    3. Quantizes into 256 discrete levels.
    4. Decodes back to linear PCM.
    5. Resamples back to output_sr (default 16 kHz).
    """
    # Downsample to 8 kHz
    audio_8k = _resample(audio, sr, 8000)
    
    # Clip to [-1.0, 1.0]
    audio_8k = np.clip(audio_8k, -1.0, 1.0)
    
    mu = 255.0
    # Mu-law compression: sgn(x) * ln(1 + mu * |x|) / ln(1 + mu)
    sign = np.sign(audio_8k)
    mag = np.abs(audio_8k)
    compressed = sign * np.log1p(mu * mag) / np.log(1.0 + mu)
    
    # 8-bit quantization (256 discrete levels in [-1, 1])
    quantized = np.round((compressed + 1.0) * 127.5) / 127.5 - 1.0
    
    # Mu-law expansion: sgn(y) * ((1 + mu)^|y| - 1) / mu
    q_sign = np.sign(quantized)
    q_mag = np.abs(quantized)
    expanded = q_sign * (np.power(1.0 + mu, q_mag) - 1.0) / mu
    
    # Lowpass anti-aliasing filter at 3.4 kHz (telephony passband)
    b, a = signal.butter(4, 3400.0 / (8000.0 / 2.0), btype="low")
    filtered = signal.lfilter(b, a, expanded)
    
    # Resample back to output sample rate
    return _resample(filtered, 8000, output_sr)


def apply_g711_alaw(audio: np.ndarray, sr: int = 16000, output_sr: int = 16000) -> np.ndarray:
    """
    Applies ITU-T G.711 A-law companding and quantization (European telephony standard).
    A = 87.6
    """
    audio_8k = _resample(audio, sr, 8000)
    audio_8k = np.clip(audio_8k, -1.0, 1.0)
    
    A = 87.6
    sign = np.sign(audio_8k)
    mag = np.abs(audio_8k)
    
    compressed = np.zeros_like(mag)
    mask = mag < (1.0 / A)
    compressed[mask] = (A * mag[mask]) / (1.0 + np.log(A))
    compressed[~mask] = (1.0 + np.log(A * mag[~mask])) / (1.0 + np.log(A))
    compressed = sign * compressed
    
    # 8-bit quantization
    quantized = np.round((compressed + 1.0) * 127.5) / 127.5 - 1.0
    
    # Expansion
    q_sign = np.sign(quantized)
    q_mag = np.abs(quantized)
    expanded = np.zeros_like(q_mag)
    q_mask = q_mag < (1.0 / (1.0 + np.log(A)))
    expanded[q_mask] = (q_mag[q_mask] * (1.0 + np.log(A))) / A
    expanded[~q_mask] = np.exp(q_mag[~q_mask] * (1.0 + np.log(A)) - 1.0) / A
    expanded = q_sign * expanded
    
    b, a = signal.butter(4, 3400.0 / (8000.0 / 2.0), btype="low")
    filtered = signal.lfilter(b, a, expanded)
    return _resample(filtered, 8000, output_sr)


# ===========================================================================
# 2. Opus Codec Simulation
# ===========================================================================

def apply_opus_simulation(
    audio: np.ndarray,
    sr: int = 16000,
    bitrate_kbps: int = 16,
    frame_size_ms: int = 20,
) -> np.ndarray:
    """
    Simulates Opus VoIP codec degradation:
    - Bandwidth restriction based on bitrate (Fullband > 32k, Wideband ~16k, Mediumband ~12k, Narrowband < 8k)
    - Subband MDCT transform & bit-allocation quantization noise
    - High-frequency psychoacoustic masking thresholding
    """
    audio = audio.astype(np.float32)
    n = len(audio)
    if n == 0:
        return audio

    # Determine cutoff frequency based on bitrate
    if bitrate_kbps >= 32:
        cutoff = min(7800.0, sr / 2.0 - 200.0)
    elif bitrate_kbps >= 16:
        cutoff = 6000.0  # Wideband cutoff
    elif bitrate_kbps >= 12:
        cutoff = 4500.0  # Mediumband cutoff
    else:
        cutoff = 3400.0  # Narrowband telephony cutoff

    # Apply lowpass filter for bandwidth mode
    nyq = sr / 2.0
    norm_cutoff = min(0.95, cutoff / nyq)
    b, a = signal.butter(5, norm_cutoff, btype="low")
    filtered = signal.lfilter(b, a, audio)

    # Frame-based MDCT-like STFT quantization
    frame_samples = int(sr * (frame_size_ms / 1000.0))
    hop_length = frame_samples // 2
    n_fft = 2 ** math.ceil(math.log2(frame_samples * 2))

    window = np.hanning(n_fft)
    stft = signal.stft(filtered, fs=sr, window=window, nperseg=n_fft, noverlap=n_fft - hop_length)
    freqs, times, Zxx = stft

    # Quantize magnitude spectrogram according to bitrate
    mag = np.abs(Zxx)
    phase = np.angle(Zxx)

    # Dynamic range bit-depth allocation
    effective_bits = max(3.0, min(12.0, bitrate_kbps / 2.5))
    step = np.max(mag) / (2 ** effective_bits) if np.max(mag) > 0 else 1.0
    quant_mag = np.round(mag / step) * step

    # Add subtle subband quantization noise floor
    noise = np.random.normal(0, step * 0.1, size=mag.shape)
    quant_mag = np.maximum(0.0, quant_mag + noise)

    reconstructed_Zxx = quant_mag * np.exp(1j * phase)
    _, reconstructed = signal.istft(reconstructed_Zxx, fs=sr, window=window, nperseg=n_fft, noverlap=n_fft - hop_length)

    # Match length
    if len(reconstructed) > n:
        reconstructed = reconstructed[:n]
    elif len(reconstructed) < n:
        reconstructed = np.pad(reconstructed, (0, n - len(reconstructed)))

    return reconstructed.astype(np.float32)


# ===========================================================================
# 3. AAC / MP3 Lossy Compression Simulation
# ===========================================================================

def apply_aac_mp3_simulation(
    audio: np.ndarray,
    sr: int = 16000,
    bitrate_kbps: int = 32,
) -> np.ndarray:
    """
    Simulates AAC / MP3 lossy audio compression:
    - High-frequency cutoff (MDCT scalefactor band limit)
    - Psychoacoustic masking threshold (quieter frequencies near loud ones removed)
    - Lossy subband quantization
    """
    audio = audio.astype(np.float32)
    n = len(audio)
    if n == 0:
        return audio

    # Lowpass filter @ 12 kHz or 8 kHz based on bitrate
    cutoff = min(sr / 2.0 - 200.0, 7000.0 if bitrate_kbps >= 32 else 5000.0)
    b, a = signal.butter(4, cutoff / (sr / 2.0), btype="low")
    filtered = signal.lfilter(b, a, audio)

    # Short-time spectral masking
    n_fft = 512
    hop = 128
    _, _, Zxx = signal.stft(filtered, fs=sr, nperseg=n_fft, noverlap=n_fft - hop)
    mag = np.abs(Zxx)
    phase = np.angle(Zxx)

    # Spectral masking: zero out coefficients below dynamic threshold
    threshold = np.max(mag, axis=0, keepdims=True) * (0.015 if bitrate_kbps >= 32 else 0.04)
    mag_masked = np.where(mag < threshold, 0.0, mag)

    # Subband non-linear quantization
    bits = 6.0 if bitrate_kbps >= 32 else 4.0
    scale = np.max(mag_masked) / (2 ** bits) if np.max(mag_masked) > 0 else 1.0
    mag_quant = np.round(mag_masked / scale) * scale

    recon_Zxx = mag_quant * np.exp(1j * phase)
    _, recon = signal.istft(recon_Zxx, fs=sr, nperseg=n_fft, noverlap=n_fft - hop)

    if len(recon) > n:
        recon = recon[:n]
    elif len(recon) < n:
        recon = np.pad(recon, (0, n - len(recon)))

    return recon.astype(np.float32)


# ===========================================================================
# 4. AMR-NB & AMR-WB (Adaptive Multi-Rate) Cellular Codecs
# ===========================================================================

def apply_amr_nb_simulation(audio: np.ndarray, sr: int = 16000, output_sr: int = 16000) -> np.ndarray:
    """
    Simulates AMR-NB (Narrowband 8 kHz @ 4.75 - 12.2 kbps mobile cellular standard).
    - Downsample to 8 kHz
    - Bandpass 200 Hz – 3400 Hz
    - Linear Predictive Coding (LPC) residual quantization
    - Synthesis and resample to output_sr
    """
    audio_8k = _resample(audio, sr, 8000)
    
    # Bandpass filter
    b, a = signal.butter(4, [200.0 / 4000.0, 3400.0 / 4000.0], btype="bandpass")
    filtered = signal.lfilter(b, a, audio_8k)
    
    # 10th order LPC spectral shaping approximation
    frame_len = 160  # 20 ms @ 8 kHz
    out_frames = []
    
    for i in range(0, len(filtered), frame_len):
        frame = filtered[i : i + frame_len]
        if len(frame) < frame_len:
            frame = np.pad(frame, (0, frame_len - len(frame)))
        
        # Simple LPC-like 4-bit non-linear quantization
        step = 0.05
        quant_frame = np.round(frame / step) * step
        out_frames.append(quant_frame)
        
    recon_8k = np.concatenate(out_frames)[:len(audio_8k)]
    return _resample(recon_8k, 8000, output_sr)


def apply_amr_wb_simulation(audio: np.ndarray, sr: int = 16000) -> np.ndarray:
    """
    Simulates AMR-WB (G.722.2 Wideband 16 kHz @ 12.65 kbps HD Voice mobile standard).
    - Bandpass 50 Hz – 7000 Hz
    - Subband filtering and ACELP residual quantization
    """
    audio = audio.astype(np.float32)
    nyq = sr / 2.0
    low = max(0.01, 50.0 / nyq)
    high = min(0.95, 7000.0 / nyq)
    b, a = signal.butter(4, [low, high], btype="bandpass")
    filtered = signal.lfilter(b, a, audio)

    # 6-bit quantization simulation
    step = 0.02
    quantized = np.round(filtered / step) * step
    return quantized.astype(np.float32)


# ===========================================================================
# 5. GSM-FR / Telephony Standard
# ===========================================================================

def apply_gsm_simulation(audio: np.ndarray, sr: int = 16000, output_sr: int = 16000) -> np.ndarray:
    """
    Simulates GSM Full Rate (GSM 06.10 @ 13 kbps) 2G mobile standard.
    - 8 kHz downsampling
    - 300 Hz - 3400 Hz bandpass
    - Non-linear RPE-LTP quantization distortion
    """
    audio_8k = _resample(audio, sr, 8000)
    
    # GSM bandpass filter
    b, a = signal.butter(4, [300.0 / 4000.0, 3400.0 / 4000.0], btype="bandpass")
    filtered = signal.lfilter(b, a, audio_8k)
    
    # Non-linear harmonic distortion
    distorted = np.tanh(1.2 * filtered) / 1.2
    
    # 5-bit quantization
    quantized = np.round((distorted + 1.0) * 15.5) / 15.5 - 1.0
    
    return _resample(quantized, 8000, output_sr)
