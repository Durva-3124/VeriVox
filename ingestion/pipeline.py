"""
VeriVox Ingestion Pipeline — Module 1

Converts raw audio (file or live stream) into 200 ms chunks of shape
(1, 3200) float32 torch.Tensor at 16 kHz, ready for model/inference.py.

Usage — file mode:
    from ingestion.pipeline import IngestionPipeline
    pipeline = IngestionPipeline()
    for chunk in pipeline.process_file("audio.wav"):
        # chunk: (1, 3200) torch.Tensor
        result = run_module2(chunk, sr=16000)

Usage — streaming mode (feed raw bytes or numpy frames):
    pipeline = IngestionPipeline()
    for chunk in pipeline.process_stream(audio_numpy_array):
        result = run_module2(chunk, sr=16000)
"""

from __future__ import annotations

from collections import deque
from pathlib import Path
from typing import Generator, Iterator

import numpy as np
import torch

try:
    from ingestion.codec_norm import load_and_normalize, normalize_array, TARGET_SR
    from ingestion.vad import has_speech, compute_vad_mask
except ImportError:
    from codec_norm import load_and_normalize, normalize_array, TARGET_SR  # type: ignore
    from vad import has_speech, compute_vad_mask  # type: ignore

# 200 ms window at 16 kHz
CHUNK_SAMPLES = 3_200   # 0.2 s × 16 000 Hz
CHUNK_DURATION_S = CHUNK_SAMPLES / TARGET_SR


class IngestionPipeline:
    """
    Converts audio into a stream of (1, 3200) float32 torch.Tensor chunks.

    Args:
        vad_enabled:        Drop silent chunks when True (default True).
        vad_threshold_db:   RMS threshold for VAD silence gate (default -40 dB).
        min_speech_ratio:   Fraction of VAD frames that must be speech to
                            pass a chunk (default 0.1 = 10%).
    """

    def __init__(
        self,
        vad_enabled: bool = True,
        vad_threshold_db: float = -40.0,
        min_speech_ratio: float = 0.1,
    ) -> None:
        self.vad_enabled      = vad_enabled
        self.vad_threshold_db = vad_threshold_db
        self.min_speech_ratio = min_speech_ratio
        self._buffer          = np.zeros(0, dtype=np.float32)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_file(self, path: str | Path) -> Generator[torch.Tensor, None, None]:
        """
        Load a file, normalize it, and yield (1, 3200) chunks.

        Args:
            path: Path to any audio file (WAV, MP3, FLAC, …).

        Yields:
            (1, 3200) float32 torch.Tensor per 200 ms window.
        """
        wav = load_and_normalize(path)
        yield from self._emit_chunks(wav)

    def process_array(
        self,
        waveform: np.ndarray,
        sr: int,
    ) -> Generator[torch.Tensor, None, None]:
        """
        Normalize a numpy array and yield (1, 3200) chunks.

        Args:
            waveform: (T,) or (C, T) float32 array at `sr` Hz.
            sr:       Source sample rate.

        Yields:
            (1, 3200) float32 torch.Tensor per 200 ms window.
        """
        wav = normalize_array(waveform, sr)
        yield from self._emit_chunks(wav)

    def push(self, frame: np.ndarray, sr: int) -> list[torch.Tensor]:
        """
        Push a raw audio frame into the internal buffer and return any
        complete 200 ms chunks that are ready.

        Designed for live streaming — call once per microphone callback.

        Args:
            frame: (N,) or (N, C) float32 array at `sr` Hz.
            sr:    Source sample rate of the incoming frame.

        Returns:
            List of (1, 3200) float32 torch.Tensor (may be empty).
        """
        wav = normalize_array(frame, sr)
        self._buffer = np.concatenate([self._buffer, wav])

        chunks: list[torch.Tensor] = []
        while len(self._buffer) >= CHUNK_SAMPLES:
            window = self._buffer[:CHUNK_SAMPLES]
            self._buffer = self._buffer[CHUNK_SAMPLES:]
            chunk = self._gate_and_convert(window)
            if chunk is not None:
                chunks.append(chunk)
        return chunks

    def reset(self) -> None:
        """Clear the internal streaming buffer."""
        self._buffer = np.zeros(0, dtype=np.float32)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _emit_chunks(self, wav: np.ndarray) -> Generator[torch.Tensor, None, None]:
        """Slice a full waveform into non-overlapping 200 ms chunks."""
        n_chunks = len(wav) // CHUNK_SAMPLES
        for i in range(n_chunks):
            window = wav[i * CHUNK_SAMPLES : (i + 1) * CHUNK_SAMPLES]
            chunk = self._gate_and_convert(window)
            if chunk is not None:
                yield chunk

    def _gate_and_convert(self, window: np.ndarray) -> torch.Tensor | None:
        """
        Apply VAD gate and convert to (1, 3200) torch.Tensor.
        Returns None if the window is silent and VAD is enabled.
        """
        if self.vad_enabled and not has_speech(
            window,
            min_speech_ratio=self.min_speech_ratio,
        ):
            return None
        return torch.from_numpy(window).unsqueeze(0)  # (1, 3200)
