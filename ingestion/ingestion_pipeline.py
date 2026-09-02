"""
ingestion_pipeline.py
Module 1: Ingestion -- consolidated, importable pipeline.

This is the single module other roles (Atharv's backend, Durva's model)
should import and call, replacing the separate test scripts used during
development (record_test.py, synthetic_test.py, codec_normalization.py,
full_pipeline_test.py, rolling_buffer_test.py, full_pipeline_with_buffer.py).

=====================================================================
TWO OUTPUT PATHS (per Durva's confirmed spec)
=====================================================================

  1. STREAMING PATH -- for anti-spoofing (fast path) + speaker verification
     - Shape: (1, 3200) torch.float32 @ 16kHz
     - Produced once per 200ms speech chunk (silence chunks are dropped)
     - Use: streaming_tensors, _ = process_audio_file(path)

  2. FULL-SEGMENT PATH -- for anti-spoofing DL model score via run_module2()
     - Shape: (1, 64000) torch.float32 @ 16kHz (a rolling 4-second window)
     - Fires when EITHER:
         (a) the rolling buffer naturally fills to 4 seconds of speech, OR
         (b) VAD detects the utterance has ended (speech -> silence),
             in which case the partial buffer is padded to a full
             64,000 samples so run_module2() always receives a
             consistently-shaped tensor
     - Use: _, full_segment_tensors = process_audio_file(path)

=====================================================================
KNOWN LIMITATION (as of this PR)
=====================================================================
Live microphone capture (capture_from_microphone()) is implemented and
structurally correct, but has NOT been verified with real hardware --
a Windows audio driver issue on the development machine has prevented
any live mic test so far (mic disappears from Device Manager entirely;
confirmed via Windows Settings, Device Manager, and even the separate
Camera app, so this is a driver/hardware issue, not a permissions or
code issue). Everything else in this module -- codec normalization,
windowing, VAD, and BOTH tensor output paths -- has been verified
against real audio files (not just synthetic test data).

=====================================================================
CONFIRMED SPEC (from Durva, Module 2 / Model)
=====================================================================
    Sample rate:        16,000 Hz
    Channels:            mono
    Dtype:               float32
    Window size:         3,200 samples (200ms)
    Window overlap:      50% (1,600-sample step)
    Streaming tensor:    (1, 3200) torch.float32 @ 16kHz
    Full-segment tensor: (1, 64000) torch.float32 @ 16kHz

Public functions/classes:
    capture_from_microphone(duration_seconds, device=None) -> np.ndarray
    normalize_audio_file(input_path) -> np.ndarray
    make_windows(audio, window_size, step_size) -> list[np.ndarray]
    is_speech(window, vad_instance) -> bool
    RollingBuffer -- maintains the 4-second full-segment buffer
    process_audio_file(input_path) -> (streaming_tensors, full_segment_tensors)
"""

import subprocess
import numpy as np

try:
    import sounddevice as sd
    SOUNDDEVICE_AVAILABLE = True
except (ImportError, OSError):
    # OSError covers "PortAudio library not found" -- happens on machines/
    # servers without audio hardware or drivers installed (e.g. teammates'
    # backend/model machines that never need to record from a mic directly).
    SOUNDDEVICE_AVAILABLE = False

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import webrtcvad
    VAD_AVAILABLE = True
except ImportError:
    VAD_AVAILABLE = False

from collections import deque


# ---------------------------------------------------------------------------
# Confirmed spec constants (Durva, Module 2)
# ---------------------------------------------------------------------------
TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1
WINDOW_MS = 200
WINDOW_SAMPLES = 3200
STEP_SAMPLES = WINDOW_SAMPLES // 2   # 50% overlap
BUFFER_CHUNKS = 20                    # 20 x 3200 = 64,000 samples = 4 seconds
FULL_SEGMENT_SAMPLES = WINDOW_SAMPLES * BUFFER_CHUNKS
VAD_FRAME_MS = 30
VAD_FRAME_SAMPLES = int(TARGET_SAMPLE_RATE * VAD_FRAME_MS / 1000)


# ---------------------------------------------------------------------------
# 1. Microphone capture
# ---------------------------------------------------------------------------
def capture_from_microphone(duration_seconds: float, device=None) -> np.ndarray:
    """
    Records audio directly from a microphone at the target spec
    (16kHz, mono, float32).

    device=None uses the SYSTEM DEFAULT input device -- no hardcoded
    device index. Pass a specific device number only if you've
    confirmed it's correct for the machine you're running on
    (use sounddevice.query_devices() to check).
    """
    if not SOUNDDEVICE_AVAILABLE:
        raise RuntimeError("sounddevice not installed -- run: py -m pip install sounddevice")

    audio = sd.rec(
        int(duration_seconds * TARGET_SAMPLE_RATE),
        samplerate=TARGET_SAMPLE_RATE,
        channels=TARGET_CHANNELS,
        dtype='float32',
        device=device  # None = system default, avoids hardcoding a laptop-specific ID
    )
    sd.wait()
    return audio.flatten()


# ---------------------------------------------------------------------------
# 2. Codec normalization (any format -> 16kHz mono float32)
# ---------------------------------------------------------------------------
def normalize_audio_file(input_path: str) -> np.ndarray:
    """
    Converts an audio file of ANY format/codec FFmpeg supports
    (Opus, AAC, G.711 mu-law/a-law, MP3, WAV, FLAC, etc.) into a
    16kHz, mono, float32 numpy array.
    """
    command = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ar", str(TARGET_SAMPLE_RATE),
        "-ac", str(TARGET_CHANNELS),
        "-f", "f32le",
        "-"
    ]
    result = subprocess.run(command, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg failed to process {input_path}:\n"
            f"{result.stderr.decode(errors='ignore')}"
        )
    return np.frombuffer(result.stdout, dtype=np.float32)


# ---------------------------------------------------------------------------
# 3. Windowing
# ---------------------------------------------------------------------------
def make_windows(audio: np.ndarray, window_size: int = WINDOW_SAMPLES,
                  step_size: int = STEP_SAMPLES) -> list:
    """Slices audio into overlapping fixed-size windows."""
    windows = []
    start = 0
    while start + window_size <= len(audio):
        windows.append(audio[start:start + window_size])
        start += step_size
    return windows


# ---------------------------------------------------------------------------
# 4. VAD (Voice Activity Detection)
# ---------------------------------------------------------------------------
def _float32_to_int16(audio_float32: np.ndarray) -> np.ndarray:
    return (audio_float32 * 32767).astype(np.int16)


def is_speech(window: np.ndarray, vad_instance) -> bool:
    """
    Returns True if the window contains speech, False if silence.
    Splits into 30ms sub-frames (webrtcvad's requirement) and votes.
    """
    window_int16 = _float32_to_int16(window)
    speech_votes = 0
    total_frames = 0
    for start in range(0, len(window_int16) - VAD_FRAME_SAMPLES + 1, VAD_FRAME_SAMPLES):
        frame = window_int16[start:start + VAD_FRAME_SAMPLES]
        total_frames += 1
        if vad_instance.is_speech(frame.tobytes(), TARGET_SAMPLE_RATE):
            speech_votes += 1
    if total_frames == 0:
        return False
    return (speech_votes / total_frames) > 0.5


def make_vad():
    """Returns a configured webrtcvad.Vad instance (aggressiveness=2)."""
    if not VAD_AVAILABLE:
        raise RuntimeError("webrtcvad not installed -- run: py -m pip install webrtcvad")
    return webrtcvad.Vad(2)


# ---------------------------------------------------------------------------
# 5. Rolling 4-second buffer (full-segment path for anti-spoofing)
# ---------------------------------------------------------------------------
class RollingBuffer:
    """
    Maintains a rolling window of the last 4 seconds of speech audio.

    Fires (is_full() becomes True) in TWO cases, per Durva's spec:
      (a) the buffer naturally fills to 20 chunks (4 seconds), OR
      (b) VAD detects the utterance has ended (silence after speech) --
          in this case we pad the remaining slots by repeating the
          last chunk, so run_module2() always receives a full,
          consistently-shaped (1, 64000) tensor even for short utterances.
    """

    def __init__(self):
        self.buffer = deque(maxlen=BUFFER_CHUNKS)
        self._had_speech = False

    def add_chunk(self, chunk: np.ndarray):
        assert chunk.shape[0] == WINDOW_SAMPLES, \
            f"Expected {WINDOW_SAMPLES} samples, got {chunk.shape[0]}"
        self.buffer.append(chunk)
        self._had_speech = True

    def is_full(self) -> bool:
        return len(self.buffer) == BUFFER_CHUNKS

    def notify_utterance_end(self) -> bool:
        """
        Call this when VAD detects speech has just ended (a speech
        window followed by a silence window). If we have SOME speech
        buffered but not a full 4 seconds yet, pad it up to 64,000
        samples so run_module2() still gets a consistent shape.
        Returns True if a segment was produced as a result.
        """
        if not self._had_speech or len(self.buffer) == 0:
            return False
        if self.is_full():
            return False  # already fires naturally via is_full()
        while len(self.buffer) < BUFFER_CHUNKS:
            self.buffer.append(self.buffer[-1])  # pad with last chunk
        return True

    def get_full_segment(self):
        """Returns the buffered 4 seconds as a (1, 64000) torch.Tensor."""
        if not TORCH_AVAILABLE:
            raise RuntimeError("torch not installed -- run: py -m pip install torch")
        concatenated = np.concatenate(list(self.buffer))
        return torch.from_numpy(concatenated.copy()).unsqueeze(0)

    def reset(self):
        """Clears the buffer -- call after sending a segment on utterance-end."""
        self.buffer.clear()
        self._had_speech = False


# ---------------------------------------------------------------------------
# 6. High-level pipeline: process a file through every stage
# ---------------------------------------------------------------------------
def process_audio_file(input_path: str):
    """
    Runs a full audio file through the entire Module 1 pipeline:
    normalize -> window -> VAD -> streaming tensors + full-segment tensors.

    Returns (streaming_tensors, full_segment_tensors) -- both lists of
    torch.Tensor, ready to hand to Durva's run_module2() or Atharv's
    backend API once the hand-off interface is confirmed.
    """
    audio = normalize_audio_file(input_path)
    windows = make_windows(audio)
    vad = make_vad()
    rolling = RollingBuffer()

    streaming_tensors = []
    full_segment_tensors = []
    previous_was_speech = False

    for window in windows:
        speech = is_speech(window, vad)

        if speech:
            streaming_tensors.append(torch.from_numpy(window.copy()).unsqueeze(0))
            rolling.add_chunk(window)
            if rolling.is_full():
                full_segment_tensors.append(rolling.get_full_segment())
        else:
            if previous_was_speech:
                # Utterance just ended -- fire a padded segment if we
                # have partial speech buffered (Durva's "or utterance
                # end" trigger condition).
                if rolling.notify_utterance_end():
                    full_segment_tensors.append(rolling.get_full_segment())
                    rolling.reset()

        previous_was_speech = speech

    return streaming_tensors, full_segment_tensors


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: py ingestion_pipeline.py <path_to_audio_file>")
        sys.exit(1)

    streaming, full_segments = process_audio_file(sys.argv[1])
    print(f"Streaming tensors: {len(streaming)}  (each shape: {tuple(streaming[0].shape) if streaming else 'N/A'})")
    print(f"Full-segment tensors: {len(full_segments)}  (each shape: {tuple(full_segments[0].shape) if full_segments else 'N/A'})")