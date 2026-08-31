"""
Offline Codec-Augmentation Pipeline for VeriVox (Harsh's Aug 31 Deliverable).

Provides:
- `CodecAugmentationPipeline`: composable transform pipeline for audio batches and datasets.
- Batch offline audio augmentation CLI.
- Manifest generation for codec-augmented training and benchmark sets.

Usage:
    python -m datasets.augmentation.pipeline \
        --input_csv datasets/manifests/asvspoof2019_la_train.csv \
        --output_dir datasets/processed/augmented_audio \
        --output_csv datasets/manifests/codec_augmented_train.csv \
        --codecs opus,g711_ulaw,aac,amr_nb,packet_loss,noise \
        --augment_prob 0.8
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import random
import sys
from pathlib import Path
from typing import Callable, List, Optional, Sequence, Union

_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import soundfile as sf

from datasets.augmentation.channel_impairments import (
    apply_additive_noise,
    apply_network_jitter,
    apply_packet_loss,
    apply_reverberation_rir,
)
from datasets.augmentation.codecs import (
    apply_aac_mp3_simulation,
    apply_amr_nb_simulation,
    apply_amr_wb_simulation,
    apply_g711_alaw,
    apply_g711_ulaw,
    apply_gsm_simulation,
    apply_opus_simulation,
)

log = logging.getLogger(__name__)


# Registry of available transforms
AVAILABLE_TRANSFORMS = {
    "g711_ulaw": lambda x, sr: apply_g711_ulaw(x, sr=sr, output_sr=sr),
    "g711_alaw": lambda x, sr: apply_g711_alaw(x, sr=sr, output_sr=sr),
    "opus_16k": lambda x, sr: apply_opus_simulation(x, sr=sr, bitrate_kbps=16),
    "opus_8k": lambda x, sr: apply_opus_simulation(x, sr=sr, bitrate_kbps=8),
    "aac_32k": lambda x, sr: apply_aac_mp3_simulation(x, sr=sr, bitrate_kbps=32),
    "amr_nb": lambda x, sr: apply_amr_nb_simulation(x, sr=sr, output_sr=sr),
    "amr_wb": lambda x, sr: apply_amr_wb_simulation(x, sr=sr),
    "gsm": lambda x, sr: apply_gsm_simulation(x, sr=sr, output_sr=sr),
    "packet_loss_10": lambda x, sr: apply_packet_loss(x, sr=sr, packet_loss_rate=0.10),
    "packet_loss_20": lambda x, sr: apply_packet_loss(x, sr=sr, packet_loss_rate=0.20),
    "noise_snr_15": lambda x, sr: apply_additive_noise(x, snr_db=15.0, noise_type="white"),
    "noise_snr_10": lambda x, sr: apply_additive_noise(x, snr_db=10.0, noise_type="babble"),
    "jitter": lambda x, sr: apply_network_jitter(x, sr=sr, max_jitter_ms=5.0),
    "reverb_rir": lambda x, sr: apply_reverberation_rir(x, sr=sr, rt60_s=0.3),
}


class CodecAugmentationPipeline:
    """
    Composable offline codec and channel augmentation pipeline.
    """

    def __init__(
        self,
        transforms: Optional[Sequence[str]] = None,
        sample_rate: int = 16000,
        augment_prob: float = 1.0,
        seed: Optional[int] = 42,
    ) -> None:
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)

        self.sample_rate = sample_rate
        self.augment_prob = augment_prob
        self.transform_names = list(transforms) if transforms else list(AVAILABLE_TRANSFORMS.keys())

        # Validate transform names
        for name in self.transform_names:
            if name not in AVAILABLE_TRANSFORMS:
                raise ValueError(f"Unknown transform '{name}'. Available: {list(AVAILABLE_TRANSFORMS.keys())}")

    def augment_audio(self, audio: np.ndarray, transform_name: Optional[str] = None) -> tuple[np.ndarray, str]:
        """
        Applies a random or specified transform to an audio array.
        Returns: (augmented_audio, transform_used)
        """
        if random.random() > self.augment_prob:
            return audio.copy(), "clean"

        selected = transform_name if transform_name else random.choice(self.transform_names)
        transform_fn = AVAILABLE_TRANSFORMS[selected]
        augmented = transform_fn(audio, self.sample_rate)
        return augmented, selected

    def augment_file(
        self,
        input_path: Union[str, Path],
        output_path: Union[str, Path],
        transform_name: Optional[str] = None,
    ) -> tuple[Path, str]:
        """
        Loads an audio file, applies augmentation, and saves it to output_path.
        """
        in_p = Path(input_path)
        out_p = Path(output_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)

        audio, sr = sf.read(str(in_p), dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        # Resample to pipeline standard rate if needed
        if sr != self.sample_rate:
            from datasets.augmentation.codecs import _resample
            audio = _resample(audio, sr, self.sample_rate)

        augmented, name_used = self.augment_audio(audio, transform_name)
        sf.write(str(out_p), augmented, self.sample_rate)
        return out_p, name_used

    def augment_manifest(
        self,
        input_csv: Union[str, Path],
        output_dir: Union[str, Path],
        output_csv: Union[str, Path],
        mix_clean: bool = True,
        extended_manifest: bool = True,
    ) -> Path:
        """
        Processes all audio in a CSV manifest and produces an augmented dataset + manifest.
        """
        in_csv = Path(input_csv)
        out_dir = Path(output_dir)
        out_csv = Path(output_csv)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_csv.parent.mkdir(parents=True, exist_ok=True)

        with open(in_csv, "r", newline="", encoding="utf-8") as f:
            reader = list(csv.DictReader(f))

        augmented_rows = []
        log.info("Starting offline codec augmentation for %d files in %s", len(reader), in_csv)

        for i, row in enumerate(reader):
            src_file = Path(row["filepath"])
            label = int(row.get("label", 0))
            speaker_id = row.get("speaker_id", "unknown")
            system_id = row.get("system_id", "-")
            attack_type = row.get("attack_type", "bonafide" if label == 0 else "spoof")

            # Preserve clean copy if requested
            if mix_clean and src_file.exists():
                augmented_rows.append(
                    {
                        "filepath": str(src_file.resolve()),
                        "label": label,
                        "speaker_id": speaker_id,
                        "system_id": system_id,
                        "attack_type": attack_type,
                        "codec_aug": "none",
                        "is_augmented": 0,
                    }
                )

            if not src_file.exists():
                continue

            # Pick a codec transform
            trans_name = random.choice(self.transform_names)
            out_filename = f"aug_{i:05d}_{trans_name}_{src_file.name}"
            out_filepath = out_dir / out_filename

            try:
                _, used_name = self.augment_file(src_file, out_filepath, transform_name=trans_name)
                augmented_rows.append(
                    {
                        "filepath": str(out_filepath.resolve()),
                        "label": label,
                        "speaker_id": speaker_id,
                        "system_id": system_id,
                        "attack_type": f"{attack_type}+{used_name}",
                        "codec_aug": used_name,
                        "is_augmented": 1,
                    }
                )
            except Exception as e:
                log.warning("Failed to augment %s: %s", src_file, e)

        # Write output manifest
        with open(out_csv, "w", newline="", encoding="utf-8") as f:
            if extended_manifest:
                fieldnames = ["filepath", "label", "speaker_id", "system_id", "attack_type", "codec_aug", "is_augmented"]
            else:
                fieldnames = ["filepath", "label"]
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(augmented_rows)

        log.info("Augmentation complete: wrote %d records to %s", len(augmented_rows), out_csv)
        return out_csv


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="VeriVox Offline Codec Augmentation Pipeline")
    p.add_argument("--input_csv", required=True, help="Input CSV manifest")
    p.add_argument("--output_dir", required=True, help="Directory to save augmented audio files")
    p.add_argument("--output_csv", required=True, help="Output manifest CSV path")
    p.add_argument("--codecs", default="g711_ulaw,opus_16k,aac_32k,amr_nb,packet_loss_10,noise_snr_15", help="Comma-separated codec names")
    p.add_argument("--augment_prob", type=float, default=1.0, help="Probability of augmenting each sample")
    p.add_argument("--seed", type=int, default=42, help="Random seed")
    return p.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
    args = parse_args()
    transforms = [c.strip() for c in args.codecs.split(",") if c.strip()]
    pipeline = CodecAugmentationPipeline(transforms=transforms, augment_prob=args.augment_prob, seed=args.seed)
    pipeline.augment_manifest(args.input_csv, args.output_dir, args.output_csv)


if __name__ == "__main__":
    main()
