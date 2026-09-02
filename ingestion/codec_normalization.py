"""
codec_normalization.py
Codec normalization layer for Module 1 (Ingestion).

Takes an audio file in ANY common codec/format -- Opus, AAC, G.711 (mu-law/a-law),
MP3, WAV, etc. -- and converts it into the exact standard format the rest of
the pipeline (resampling -> windowing -> VAD -> model) already expects:
16kHz, mono, float32 numpy array.

Requires: FFmpeg installed and on PATH (confirmed working: `ffmpeg -version`)

This uses FFmpeg directly via subprocess for the core decode -- the same
thing pydub does internally -- keeping the dependency surface small and
the behavior transparent/debuggable.
"""

import subprocess
import numpy as np

TARGET_SAMPLE_RATE = 16000  # confirmed spec from Durva
TARGET_CHANNELS = 1         # mono


def normalize_audio_file(input_path: str) -> np.ndarray:
    """
    Converts an audio file of ANY format/codec FFmpeg supports
    (Opus, AAC, G.711 mu-law/a-law, MP3, WAV, FLAC, etc.) into a
    16kHz, mono, float32 numpy array.

    This is the codec normalization layer: it doesn't care what
    format the audio arrived in -- phone call audio (often G.711
    or AAC), a WhatsApp voice note (Opus), or a plain WAV file all
    come out the other end in exactly the same shape.

    Returns: 1D numpy array, dtype float32, sampled at 16kHz mono.
    """
    command = [
        "ffmpeg",
        "-y",                              # overwrite without asking
        "-i", input_path,                  # input file (any format FFmpeg recognizes)
        "-ar", str(TARGET_SAMPLE_RATE),    # resample to 16kHz
        "-ac", str(TARGET_CHANNELS),       # downmix to mono
        "-f", "f32le",                     # output raw float32 little-endian samples
        "-"                                 # write to stdout instead of a file
    ]

    result = subprocess.run(command, capture_output=True)

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg failed to process {input_path}:\n"
            f"{result.stderr.decode(errors='ignore')}"
        )

    audio = np.frombuffer(result.stdout, dtype=np.float32)
    return audio


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: py codec_normalization.py <path_to_audio_file>")
        print("Example: py codec_normalization.py sample.opus")
        sys.exit(1)

    input_file = sys.argv[1]

    print(f"Normalizing: {input_file}")
    print("-" * 50)

    audio = normalize_audio_file(input_file)

    print(f"Output shape: {audio.shape}")
    print(f"Output dtype: {audio.dtype}")
    print(f"Sample rate: {TARGET_SAMPLE_RATE} Hz")
    print(f"Channels: {TARGET_CHANNELS} (mono)")
    print(f"Duration: {len(audio) / TARGET_SAMPLE_RATE:.2f} seconds")
    print(f"Min value: {audio.min():.4f}, Max value: {audio.max():.4f}")
    print("-" * 50)
    print("Codec normalization successful -- this output is ready to")
    print("feed directly into your resampling/windowing pipeline.")