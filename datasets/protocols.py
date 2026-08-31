"""
Protocols and Manifest parsers for ASVspoof and In-the-Wild datasets (VeriVox Module: Datasets & Evaluation).

Supports:
- ASVspoof 2019 LA (Logical Access: Train, Dev, Eval)
- ASVspoof 2021 LA (Logical Access) & DF (Deepfake)
- Custom In-the-Wild corpora & metadata manifests

Manifest CSV format for model training (compatible with model/training/train.py):
    filepath,label

Extended manifest CSV format for evaluation & auditing:
    filepath,label,speaker_id,system_id,attack_type,subset,duration_s,key
"""

from __future__ import annotations

import csv
import logging
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterator, List, Optional, Union

import soundfile as sf

log = logging.getLogger(__name__)

# Known ASVspoof 2019 LA attack systems
ASVSPOOF2019_LA_ATTACKS = {
    # Seen in Train & Dev (A01 - A06)
    "A01": "Neural TTS (Tacotron + WaveNet)",
    "A02": "Neural TTS (Tacotron2 + WaveRNN)",
    "A03": "Traditional TTS (Statistical Parametric / STRAIGHT)",
    "A04": "Traditional TTS (Unit Selection / Waveform Concatenation)",
    "A05": "Voice Conversion (VCC2018 non-parallel VAE)",
    "A06": "Voice Conversion (VCC2018 parallel spectral transfer)",
    # Unseen in Train (A07 - A19 in Eval)
    "A07": "Neural TTS (FastSpeech + HiFi-GAN)",
    "A08": "Neural TTS (Transformer TTS + WaveGlow)",
    "A09": "Voice Conversion (StarGAN-VC)",
    "A10": "Voice Conversion (CycleGAN-VC)",
    "A11": "Voice Conversion (Blow Flow-based VC)",
    "A12": "Neural TTS (Tacotron2 + LPCNet)",
    "A13": "Neural TTS (FastSpeech2 + VocGAN)",
    "A14": "Voice Conversion (AdaIN-VC)",
    "A15": "Voice Conversion (VQMIVC)",
    "A16": "Neural TTS (VITS end-to-end)",
    "A17": "Voice Conversion (AutoVC)",
    "A18": "Neural TTS (YourTTS multi-speaker)",
    "A19": "Voice Conversion (FreeVC zero-shot)",
    "-": "bonafide",
}


@dataclass
class AudioSampleMeta:
    filepath: str
    label: int  # 0 = bonafide, 1 = spoof
    speaker_id: str = "unknown"
    system_id: str = "-"
    attack_type: str = "bonafide"
    subset: str = "train"  # train, dev, eval, test
    duration_s: float = 0.0
    sample_rate: int = 16000
    key: str = "bonafide"  # "bonafide" or "spoof"

    def to_minimal_dict(self) -> dict[str, Union[str, int]]:
        """Format required by model/training/train.py."""
        return {"filepath": self.filepath, "label": self.label}

    def to_extended_dict(self) -> dict[str, Union[str, int, float]]:
        """Extended format with all diagnostic metadata."""
        return asdict(self)


class ASVspoofProtocolParser:
    """
    Parser for ASVspoof 2019 / 2021 protocols and manifest generation.
    """

    @staticmethod
    def parse_asvspoof2019_protocol(
        protocol_file: Union[str, Path],
        audio_dir: Union[str, Path],
        subset: str = "train",
        audio_ext: str = ".flac",
        compute_duration: bool = False,
    ) -> list[AudioSampleMeta]:
        """
        Parses ASVspoof 2019 LA protocol text files.
        Protocol line format:
            SPEAKER_ID AUDIO_FILE_NAME - SYSTEM_ID KEY
        Example:
            LA_0079 LA_T_1138215 - - bonafide
            LA_0079 LA_T_1271820 - A01 spoof
        """
        protocol_path = Path(protocol_file)
        audio_path = Path(audio_dir)
        samples: list[AudioSampleMeta] = []

        if not protocol_path.exists():
            raise FileNotFoundError(f"Protocol file not found: {protocol_path}")

        with open(protocol_path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) < 5:
                    continue

                speaker_id = parts[0]
                audio_name = parts[1]
                system_id = parts[3]
                key_str = parts[4].lower()

                label = 0 if key_str == "bonafide" else 1
                attack_desc = ASVSPOOF2019_LA_ATTACKS.get(system_id, system_id if label == 1 else "bonafide")

                # Resolve file path
                if not audio_name.endswith(audio_ext):
                    audio_filename = f"{audio_name}{audio_ext}"
                else:
                    audio_filename = audio_name
                full_audio_path = audio_path / audio_filename

                duration = 0.0
                sr = 16000
                if compute_duration and full_audio_path.exists():
                    try:
                        info = sf.info(str(full_audio_path))
                        duration = info.duration
                        sr = info.samplerate
                    except Exception:
                        pass

                samples.append(
                    AudioSampleMeta(
                        filepath=str(full_audio_path.resolve()),
                        label=label,
                        speaker_id=speaker_id,
                        system_id=system_id,
                        attack_type=attack_desc,
                        subset=subset,
                        duration_s=round(duration, 3),
                        sample_rate=sr,
                        key=key_str,
                    )
                )

        log.info(
            "Parsed ASVspoof2019 %s: %d total samples (%d bonafide, %d spoof)",
            subset,
            len(samples),
            sum(1 for s in samples if s.label == 0),
            sum(1 for s in samples if s.label == 1),
        )
        return samples

    @staticmethod
    def parse_asvspoof2021_protocol(
        protocol_file: Union[str, Path],
        audio_dir: Union[str, Path],
        track: str = "LA",
        audio_ext: str = ".flac",
        compute_duration: bool = False,
    ) -> list[AudioSampleMeta]:
        """
        Parses ASVspoof 2021 LA / DF eval protocol keys.
        Protocol line format:
            SPEAKER_ID AUDIO_FILE_NAME SOURCE_CODE VOC_CODE SYSTEM_ID KEY COMP_STATUS
        """
        protocol_path = Path(protocol_file)
        audio_path = Path(audio_dir)
        samples: list[AudioSampleMeta] = []

        if not protocol_path.exists():
            raise FileNotFoundError(f"Protocol file not found: {protocol_path}")

        with open(protocol_path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) < 6:
                    continue

                speaker_id = parts[0]
                audio_name = parts[1]
                system_id = parts[4] if len(parts) >= 6 else "-"
                key_str = parts[5].lower() if len(parts) >= 6 else parts[-1].lower()

                label = 0 if key_str == "bonafide" else 1
                attack_desc = ASVSPOOF2019_LA_ATTACKS.get(system_id, f"ASV2021-{track}-{system_id}" if label == 1 else "bonafide")

                if not audio_name.endswith(audio_ext):
                    audio_filename = f"{audio_name}{audio_ext}"
                else:
                    audio_filename = audio_name
                full_audio_path = audio_path / audio_filename

                duration = 0.0
                sr = 16000
                if compute_duration and full_audio_path.exists():
                    try:
                        info = sf.info(str(full_audio_path))
                        duration = info.duration
                        sr = info.samplerate
                    except Exception:
                        pass

                samples.append(
                    AudioSampleMeta(
                        filepath=str(full_audio_path.resolve()),
                        label=label,
                        speaker_id=speaker_id,
                        system_id=system_id,
                        attack_type=attack_desc,
                        subset="eval_2021",
                        duration_s=round(duration, 3),
                        sample_rate=sr,
                        key=key_str,
                    )
                )

        log.info("Parsed ASVspoof2021 %s: %d total samples", track, len(samples))
        return samples

    @staticmethod
    def write_csv_manifest(
        samples: list[AudioSampleMeta],
        output_csv: Union[str, Path],
        extended: bool = False,
    ) -> Path:
        """
        Writes sample metadata to a CSV manifest.
        If extended is False, writes minimal [filepath, label] required by train.py.
        """
        out_path = Path(output_csv)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        if not samples:
            log.warning("Writing empty manifest to %s", out_path)
            with open(out_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["filepath", "label"] if not extended else list(AudioSampleMeta.__dataclass_fields__.keys()))
            return out_path

        if extended:
            fieldnames = list(asdict(samples[0]).keys())
            rows = [s.to_extended_dict() for s in samples]
        else:
            fieldnames = ["filepath", "label"]
            rows = [s.to_minimal_dict() for s in samples]

        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        log.info("Wrote %d rows to %s", len(rows), out_path)
        return out_path

    @staticmethod
    def read_csv_manifest(csv_path: Union[str, Path]) -> list[dict]:
        """Reads a CSV manifest into a list of dicts."""
        path = Path(csv_path)
        if not path.exists():
            raise FileNotFoundError(f"Manifest not found: {path}")

        with open(path, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return list(reader)
