"""
Network channel impairments and acoustic environment augmentation (Harsh's Aug 31 Deliverable).

Implements:
- Packet loss simulation using Gilbert-Elliott 2-state Markov model (burst drops + PLC)
- Micro-jitter timing offsets & sample slippage
- Controlled SNR additive acoustic noise (White, Pink, Babble, Street, Office, Line hiss)
- Synthetic Room Impulse Response (RIR) acoustic reverberation for replay attack simulation
"""

from __future__ import annotations

import math
import random
from typing import Optional, Union

import numpy as np
import scipy.signal as signal


# ===========================================================================
# 1. Gilbert-Elliott Burst Packet Loss Model
# ===========================================================================

def apply_packet_loss(
    audio: np.ndarray,
    sr: int = 16000,
    packet_loss_rate: float = 0.10,
    packet_size_ms: int = 20,
    burst_length: float = 2.5,
    plc_mode: str = "zero",  # "zero" (zero-fill) or "interp" (linear interpolation)
) -> np.ndarray:
    """
    Simulates VoIP / RTP network packet loss using a 2-state Gilbert-Elliott Markov chain:
    - State 0: Good state (low loss probability)
    - State 1: Bad/Loss state (high loss probability, simulating burst drops)

    Args:
        audio: 1D float32 audio waveform.
        sr: Sample rate in Hz.
        packet_loss_rate: Average overall packet loss probability [0.0, 1.0].
        packet_size_ms: Packet duration in milliseconds (typically 20ms in WebRTC/VoIP).
        burst_length: Average duration of loss bursts in packets.
        plc_mode: Packet Loss Concealment strategy ("zero" or "interp").
    """
    audio = audio.copy().astype(np.float32)
    n = len(audio)
    packet_samples = int(sr * (packet_size_ms / 1000.0))
    if packet_samples <= 0 or n == 0 or packet_loss_rate <= 0.0:
        return audio

    num_packets = math.ceil(n / packet_samples)

    # Gilbert-Elliott transition probabilities
    # p = transition from Good -> Bad
    # q = transition from Bad -> Good
    # Average loss rate P_L = p / (p + q) => p = P_L * q / (1 - P_L)
    # Average burst length = 1 / q => q = 1 / burst_length
    q = 1.0 / max(1.0, burst_length)
    p = (packet_loss_rate * q) / max(0.001, (1.0 - packet_loss_rate))
    p = min(0.99, max(0.01, p))

    state = 0  # Start in Good state
    loss_mask = np.ones(num_packets, dtype=bool)

    for i in range(num_packets):
        if state == 0:  # Good
            if random.random() < p:
                state = 1
                loss_mask[i] = False
        else:  # Bad
            loss_mask[i] = False
            if random.random() < q:
                state = 0

    # Apply loss mask to packets
    for i in range(num_packets):
        if not loss_mask[i]:
            start = i * packet_samples
            end = min(n, (i + 1) * packet_samples)
            if plc_mode == "zero":
                audio[start:end] = 0.0
            elif plc_mode == "interp":
                # Linear interpolation concealment
                prev_val = audio[start - 1] if start > 0 else 0.0
                next_val = audio[end] if end < n else 0.0
                audio[start:end] = np.linspace(prev_val, next_val, end - start, dtype=np.float32)

    return audio


# ===========================================================================
# 2. Network Jitter & Micro-Timing Drift
# ===========================================================================

def apply_network_jitter(
    audio: np.ndarray,
    sr: int = 16000,
    max_jitter_ms: float = 5.0,
    jitter_prob: float = 0.05,
) -> np.ndarray:
    """
    Simulates RTP packet arrival jitter and jitter-buffer sample slips/resynchronizations.
    """
    audio = audio.copy().astype(np.float32)
    n = len(audio)
    max_jitter_samples = int(sr * (max_jitter_ms / 1000.0))
    if max_jitter_samples <= 0 or n == 0:
        return audio

    chunk_size = int(sr * 0.1)  # 100ms chunks
    out = []
    
    for i in range(0, n, chunk_size):
        chunk = audio[i : i + chunk_size]
        if random.random() < jitter_prob:
            shift = random.randint(-max_jitter_samples, max_jitter_samples)
            if shift > 0:
                # Duplicate initial samples (buffer wait)
                chunk = np.pad(chunk, (shift, 0), mode="edge")[:len(chunk)]
            elif shift < 0:
                # Drop initial samples (buffer catch-up)
                chunk = np.pad(chunk[-shift:], (0, -shift), mode="edge")
        out.append(chunk)

    res = np.concatenate(out)[:n]
    if len(res) < n:
        res = np.pad(res, (0, n - len(res)))
    return res.astype(np.float32)


# ===========================================================================
# 3. Controlled SNR Additive Noise
# ===========================================================================

def apply_additive_noise(
    audio: np.ndarray,
    snr_db: float = 15.0,
    noise_type: str = "white",  # "white", "pink", "babble", "street", "office"
) -> np.ndarray:
    """
    Adds noise at a calibrated Signal-to-Noise Ratio (SNR in dB):
        SNR_dB = 10 * log10(Power_signal / Power_noise)
    """
    audio = audio.astype(np.float32)
    n = len(audio)
    if n == 0:
        return audio

    signal_power = np.mean(audio ** 2)
    if signal_power < 1e-10:
        signal_power = 1e-6

    # Target noise power
    snr_linear = 10.0 ** (snr_db / 10.0)
    noise_power = signal_power / snr_linear

    if noise_type == "white":
        raw_noise = np.random.normal(0.0, 1.0, size=n).astype(np.float32)
    elif noise_type == "pink":
        # 1/f noise generation via spectral filtering
        white = np.random.normal(0.0, 1.0, size=n)
        fft_white = np.fft.rfft(white)
        freqs = np.fft.rfftfreq(n)
        freqs[0] = freqs[1] if len(freqs) > 1 else 1.0
        pink_filter = 1.0 / np.sqrt(freqs)
        fft_pink = fft_white * pink_filter
        raw_noise = np.fft.irfft(fft_pink, n=n).astype(np.float32)
    elif noise_type in ("babble", "office"):
        # Multi-harmonic chatter / hum noise
        t = np.linspace(0, n / 16000.0, n, endpoint=False)
        hum = 0.4 * np.sin(2 * np.pi * 50.0 * t) + 0.2 * np.sin(2 * np.pi * 100.0 * t)
        chatter = np.sum([0.15 * np.sin(2 * np.pi * f * t + np.random.rand()) for f in np.random.uniform(200, 3000, 8)], axis=0)
        raw_noise = (hum + chatter + np.random.normal(0, 0.3, n)).astype(np.float32)
    else:  # "street" / default
        # Low-frequency rumble + white noise
        b, a = signal.butter(3, 400.0 / 8000.0, btype="low")
        rumble = signal.lfilter(b, a, np.random.normal(0, 1.0, n))
        raw_noise = (rumble * 1.5 + np.random.normal(0, 0.4, n)).astype(np.float32)

    # Scale noise to achieve target SNR
    raw_noise_power = np.mean(raw_noise ** 2)
    if raw_noise_power > 0:
        scaled_noise = raw_noise * np.sqrt(noise_power / raw_noise_power)
    else:
        scaled_noise = np.zeros_like(audio)

    mixed = audio + scaled_noise
    return np.clip(mixed, -1.0, 1.0).astype(np.float32)


# ===========================================================================
# 4. Room Impulse Response (RIR) Acoustic Reverberation
# ===========================================================================

def apply_reverberation_rir(
    audio: np.ndarray,
    sr: int = 16000,
    rt60_s: float = 0.3,
    room_dim: tuple[float, float, float] = (5.0, 4.0, 3.0),
) -> np.ndarray:
    """
    Simulates physical room acoustic reverberation (simulating physical replay attack channels).
    Uses synthetic exponential decay impulse response with modal density.
    """
    audio = audio.astype(np.float32)
    n = len(audio)
    if n == 0 or rt60_s <= 0.01:
        return audio

    # Synthetic RIR generation
    rir_len = int(sr * rt60_s)
    t = np.linspace(0, rt60_s, rir_len, endpoint=False)
    
    # Exponential energy decay: -60 dB at t = rt60_s => exp(-6.91 * t / rt60_s)
    decay = np.exp(-3.0 * np.log(10.0) * t / rt60_s)
    
    # Early reflections + late diffuse tail
    num_early = min(12, rir_len // 10)
    rir = np.zeros(rir_len, dtype=np.float32)
    rir[0] = 1.0  # Direct path
    
    for _ in range(num_early):
        idx = random.randint(1, max(2, rir_len // 4))
        rir[idx] += random.uniform(-0.5, 0.5) * decay[idx]
        
    # Diffuse tail (filtered noise)
    noise_tail = np.random.normal(0, 0.1, rir_len).astype(np.float32)
    b, a = signal.butter(2, 4000.0 / (sr / 2.0), btype="low")
    filtered_tail = signal.lfilter(b, a, noise_tail)
    
    rir += filtered_tail * decay
    # Normalize RIR energy
    rir = rir / (np.linalg.norm(rir) + 1e-8)

    # Convolve audio with RIR
    reverbed = signal.fftconvolve(audio, rir, mode="full")[:n]
    
    # Mix direct (dry) and wet signal: 70% dry + 30% wet
    dry_wet = 0.75 * audio + 0.25 * reverbed
    return np.clip(dry_wet, -1.0, 1.0).astype(np.float32)
