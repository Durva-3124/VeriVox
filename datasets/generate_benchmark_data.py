"""
Generates realistic multi-speaker benchmark audio and ASVspoof 2019/2021 LA split CSV manifests.

Features:
- Multi-speaker vocal tract simulation (distinct F0 pitch and formant resonances per speaker).
- Diverse spoof attack modeling (Neural TTS, Vocoder phase distortion, VC pitch shift, Replay reverberation).
- Speaker-disjoint Train, Val, and Eval splits.
- Standard CSV manifests matching SpoofDataset [filepath, label] and extended metadata.

Usage:
    python datasets/generate_benchmark_data.py
"""

from __future__ import annotations

import csv
import math
import random
import sys
from pathlib import Path
from typing import List, Tuple

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import scipy.signal as signal
import soundfile as sf

from datasets.protocols import AudioSampleMeta
from datasets.splits.speaker_disjoint import partition_speakers_disjoint

SAMPLE_RATE = 16_000
DURATION_S = 4.0
N_SAMPLES = int(SAMPLE_RATE * DURATION_S)  # 64,000


def _generate_vocal_tract_audio(
    f0: float,
    formants: list[float],
    duration_s: float = 4.0,
    sr: int = 16_000,
    jitter: float = 0.01,
    shimmer: float = 0.05,
    noise_level: float = 0.02,
) -> np.ndarray:
    """
    Vectorized glottal source + formant vocal tract resonances.
    """
    n = int(sr * duration_s)
    t = np.linspace(0, duration_s, n, endpoint=False)

    # Glottal pulse with harmonic series
    harmonics = [1.0, 0.6, 0.4, 0.25, 0.15, 0.1, 0.05]
    glottal = np.zeros(n, dtype=np.float32)
    for h_idx, amp in enumerate(harmonics, start=1):
        freq = f0 * h_idx
        if freq < sr / 2.0:
            glottal += amp * np.sin(2.0 * np.pi * freq * t + random.uniform(0, 2 * np.pi)).astype(np.float32)

    # Resonate through vocal tract formant filters (2-pole resonators)
    filtered = glottal
    for f in formants:
        bw = f / 8.0  # Bandwidth
        r = np.exp(-np.pi * bw / sr)
        theta = 2.0 * np.pi * f / sr
        b = [1.0 - r]
        a = [1.0, -2.0 * r * np.cos(theta), r * r]
        filtered = signal.lfilter(b, a, filtered)

    # Add subtle aspiration noise
    aspiration = np.random.normal(0, noise_level, n).astype(np.float32)
    b_asp, a_asp = signal.butter(2, [300.0 / (sr / 2.0), 3000.0 / (sr / 2.0)], btype="bandpass")
    aspiration_filtered = signal.lfilter(b_asp, a_asp, aspiration)

    combined = filtered + aspiration_filtered
    peak = np.max(np.abs(combined))
    if peak > 0:
        combined = (combined / peak) * 0.6
    return combined.astype(np.float32)


def _generate_synthetic_spoof(
    f0: float,
    attack_type: str,
    duration_s: float = 4.0,
    sr: int = 16_000,
) -> np.ndarray:
    """
    Generates synthetic spoof voice containing typical vocoder / neural TTS / VC / replay artifacts:
    - Neural TTS (A01, A02, A07, A08): Over-smooth F0, flat pitch trajectory, 2-4kHz vocoder buzzy noise.
    - Traditional TTS (A03, A04): Discontinuous concatenation boundaries, robotic pitch.
    - Voice Conversion (A05, A06, A09, A10): Phase smearing, spectral envelope mismatch.
    - Replay (A17-A19): Acoustic room reflections and high-frequency roll-off.
    """
    n = int(sr * duration_s)
    t = np.linspace(0, duration_s, n, endpoint=False)

    if "TTS" in attack_type or "A01" in attack_type or "A02" in attack_type or "A07" in attack_type:
        # Neural TTS: flat F0 + vocoder high frequency buzz at 2-4 kHz
        flat_glottal = (np.sin(2 * np.pi * f0 * t) + 0.5 * np.sin(4 * np.pi * f0 * t)).astype(np.float32)
        b, a = signal.butter(4, [2000.0 / (sr / 2.0), 4000.0 / (sr / 2.0)], btype="bandpass")
        vocoder_buzz = signal.lfilter(b, a, np.random.normal(0, 0.15, n).astype(np.float32))
        audio = flat_glottal * 0.5 + vocoder_buzz * 0.4

    elif "Conversion" in attack_type or "A05" in attack_type or "A06" in attack_type or "A09" in attack_type:
        # Voice conversion: smearing and phase incoherence
        base = _generate_vocal_tract_audio(f0, [700, 1500, 2600], duration_s, sr)
        _, _, Zxx = signal.stft(base, fs=sr, nperseg=512, noverlap=384)
        mag = np.abs(Zxx)
        phase_jitter = np.angle(Zxx) + np.random.uniform(-0.8, 0.8, size=Zxx.shape)
        _, audio = signal.istft(mag * np.exp(1j * phase_jitter), fs=sr, nperseg=512, noverlap=384)
        if len(audio) > n:
            audio = audio[:n]
        else:
            audio = np.pad(audio, (0, n - len(audio)))

    else:
        # Replay / Traditional: bandpass cutoff + room echo
        base = _generate_vocal_tract_audio(f0, [600, 1400, 2400], duration_s, sr)
        delay_samples = int(sr * 0.05)
        echo = np.pad(base, (delay_samples, 0))[:n] * 0.4
        b, a = signal.butter(3, 3400.0 / (sr / 2.0), btype="low")
        audio = signal.lfilter(b, a, base + echo)

    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = (audio / peak) * 0.6
    return audio.astype(np.float32)


def generate_benchmark_corpus(
    output_audio_dir: Path,
    num_speakers: int = 14,
    samples_per_speaker: int = 10,
) -> list[AudioSampleMeta]:
    """
    Generates a realistic multi-speaker benchmark corpus.
    """
    output_audio_dir.mkdir(parents=True, exist_ok=True)
    all_samples: list[AudioSampleMeta] = []

    seen_attacks = [
        ("A01", "Neural TTS (Tacotron + WaveNet)"),
        ("A02", "Neural TTS (Tacotron2 + WaveRNN)"),
        ("A03", "Traditional TTS (STRAIGHT)"),
        ("A04", "Traditional TTS (Unit Selection)"),
        ("A05", "Voice Conversion (VCC2018 VAE)"),
        ("A06", "Voice Conversion (Spectral Transfer)"),
    ]

    unseen_attacks = [
        ("A07", "Neural TTS (FastSpeech + HiFi-GAN)"),
        ("A08", "Neural TTS (WaveGlow)"),
        ("A09", "Voice Conversion (StarGAN-VC)"),
    ]

    for spk_idx in range(num_speakers):
        speaker_id = f"LA_{spk_idx + 1:04d}"
        base_f0 = 120.0 + (spk_idx * 12.0)  # Pitch from 120 Hz to 276 Hz across speakers
        formants = [500.0 + (spk_idx * 20.0), 1400.0 + (spk_idx * 30.0), 2500.0 + (spk_idx * 40.0)]

        # Determine speaker pool: last 3 speakers are eval speakers with unseen attacks
        is_eval_speaker = spk_idx >= (num_speakers - 3)

        for sample_idx in range(samples_per_speaker):
            is_bonafide = (sample_idx % 2 == 0)
            if is_bonafide:
                label = 0
                key = "bonafide"
                system_id = "-"
                attack_desc = "bonafide"
                audio = _generate_vocal_tract_audio(base_f0, formants, DURATION_S, SAMPLE_RATE)
            else:
                label = 1
                key = "spoof"
                if is_eval_speaker and (sample_idx % 4 == 1):
                    att_id, att_desc = unseen_attacks[sample_idx % len(unseen_attacks)]
                else:
                    att_id, att_desc = seen_attacks[sample_idx % len(seen_attacks)]
                system_id = att_id
                attack_desc = att_desc
                audio = _generate_synthetic_spoof(base_f0, att_desc, DURATION_S, SAMPLE_RATE)

            filename = f"{speaker_id}_{sample_idx:03d}_{key}.wav"
            filepath = output_audio_dir / filename
            sf.write(str(filepath), audio, SAMPLE_RATE)

            all_samples.append(
                AudioSampleMeta(
                    filepath=str(filepath.resolve()),
                    label=label,
                    speaker_id=speaker_id,
                    system_id=system_id,
                    attack_type=attack_desc,
                    subset="benchmark",
                    duration_s=DURATION_S,
                    sample_rate=SAMPLE_RATE,
                    key=key,
                )
            )

    return all_samples


def main() -> None:
    random.seed(42)
    np.random.seed(42)

    root_dir = Path(__file__).resolve().parent.parent
    audio_dir = root_dir / "datasets" / "processed" / "benchmark_audio"
    manifest_dir = root_dir / "datasets" / "manifests"
    processed_dir = root_dir / "datasets" / "processed"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)

    print("1. Generating realistic multi-speaker benchmark corpus...")
    samples = generate_benchmark_corpus(audio_dir, num_speakers=14, samples_per_speaker=10)
    print(f"Generated {len(samples)} total audio clips in {audio_dir}")

    # 2. Partition into Speaker-Disjoint splits
    raw_dicts = [s.to_extended_dict() for s in samples]
    train_s, val_s, eval_s = partition_speakers_disjoint(
        raw_dicts, split_ratios=(0.60, 0.20, 0.20), seed=42, unseen_attack_ids={"A07", "A08", "A09"}
    )

    # 3. Write ASVspoof 2019 LA split manifests
    def write_csv(p: Path, rows: list[dict], minimal: bool = False) -> None:
        p.parent.mkdir(parents=True, exist_ok=True)
        if minimal:
            fieldnames = ["filepath", "label"]
            data = [{"filepath": r["filepath"], "label": int(r["label"])} for r in rows]
        else:
            fieldnames = ["filepath", "label", "speaker_id", "system_id", "attack_type", "subset", "duration_s", "key"]
            data = rows

        with open(p, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(data)
        print(f"Wrote {len(data)} rows -> {p}")

    print("\n2. Writing ASVspoof LA manifests...")
    write_csv(manifest_dir / "asvspoof2019_la_train.csv", train_s)
    write_csv(manifest_dir / "asvspoof2019_la_val.csv", val_s)
    write_csv(manifest_dir / "asvspoof2019_la_eval.csv", eval_s)
    write_csv(manifest_dir / "asvspoof2021_la_eval.csv", eval_s)

    # 4. Write datasets/processed/train.csv and val.csv (with exact minimal format for SpoofDataset)
    print("\n3. Updating datasets/processed/train.csv and val.csv for Durva's model/training/train.py...")
    write_csv(processed_dir / "train.csv", train_s, minimal=True)
    write_csv(processed_dir / "val.csv", val_s, minimal=True)

    print("\n=== Benchmark data generation complete! ===")
    print("Durva can now run model training immediately:")
    print("  python model/training/train.py --model aasist "
          "--train_csv datasets/manifests/asvspoof2019_la_train.csv "
          "--val_csv datasets/manifests/asvspoof2019_la_val.csv "
          "--epochs 2 --batch_size 4 --num_workers 0")


if __name__ == "__main__":
    main()
