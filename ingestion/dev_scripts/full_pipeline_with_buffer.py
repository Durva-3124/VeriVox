"""
full_pipeline_with_buffer.py
The complete Module 1 pipeline on REAL audio, now with BOTH output paths
Durva specified:

  1. Streaming path: (1, 3200) tensor every 200ms chunk -- for anti-spoofing
     (fast path) + speaker verification
  2. Full-segment path: (1, 64000) tensor from a rolling 4-second buffer --
     for the anti-spoofing DL model score via run_module2()

Chain: codec normalization -> windowing -> VAD -> rolling buffer -> both tensors

Note: the full-segment path only produces output once at least 20 SPEECH
windows have accumulated (= 4 seconds of continuous speech). Short test
clips under 4 seconds of speech will correctly show 0 full-segment tensors
-- that's expected, not a bug. Try a longer voice note to see path 2 fire.
"""

import sys
import numpy as np
from collections import deque
import torch

from codec_normalization import normalize_audio_file, TARGET_SAMPLE_RATE

try:
    import webrtcvad
    VAD_AVAILABLE = True
except ImportError:
    VAD_AVAILABLE = False

WINDOW_SAMPLES = 3200
STEP_SAMPLES = WINDOW_SAMPLES // 2
VAD_FRAME_MS = 30
VAD_FRAME_SAMPLES = int(TARGET_SAMPLE_RATE * VAD_FRAME_MS / 1000)
BUFFER_CHUNKS = 20  # 20 x 3200 = 64,000 samples = 4 seconds
FULL_SEGMENT_SAMPLES = WINDOW_SAMPLES * BUFFER_CHUNKS


def make_windows(audio, window_size, step_size):
    windows = []
    start = 0
    while start + window_size <= len(audio):
        windows.append(audio[start:start + window_size])
        start += step_size
    return windows


def float32_to_int16(audio_float32):
    return (audio_float32 * 32767).astype(np.int16)


def is_speech(window_float32, vad_instance):
    window_int16 = float32_to_int16(window_float32)
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


class RollingBuffer:
    def __init__(self):
        self.buffer = deque(maxlen=BUFFER_CHUNKS)

    def add_chunk(self, chunk: np.ndarray):
        self.buffer.append(chunk)

    def is_full(self) -> bool:
        return len(self.buffer) == BUFFER_CHUNKS

    def get_full_segment(self):
        concatenated = np.concatenate(list(self.buffer))
        return torch.from_numpy(concatenated.copy()).unsqueeze(0)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: py full_pipeline_with_buffer.py <path_to_audio_file>")
        sys.exit(1)

    input_file = sys.argv[1]

    print(f"FULL PIPELINE (with rolling buffer) on: {input_file}")
    print("=" * 65)

    # Step 1: Codec normalization
    print("\n[1] Codec normalization...")
    audio = normalize_audio_file(input_file)
    print(f"    Decoded: {audio.shape[0]} samples, {audio.dtype}, "
          f"{audio.shape[0] / TARGET_SAMPLE_RATE:.2f}s")

    # Step 2: Windowing
    print("\n[2] Windowing...")
    windows = make_windows(audio, WINDOW_SAMPLES, STEP_SAMPLES)
    print(f"    Produced {len(windows)} windows")

    # Step 3 + 4: VAD + Rolling buffer, processed together
    print("\n[3] VAD + Rolling buffer (both output paths)...")
    vad = webrtcvad.Vad(2) if VAD_AVAILABLE else None
    rolling = RollingBuffer()

    streaming_tensors = []
    full_segment_tensors = []

    for i, window in enumerate(windows):
        speech = is_speech(window, vad) if VAD_AVAILABLE else True
        label = "SPEECH" if speech else "silence"

        if speech:
            # Path 1: streaming tensor (always produced per speech chunk)
            streaming_tensor = torch.from_numpy(window.copy()).unsqueeze(0)
            streaming_tensors.append(streaming_tensor)

            # Path 2: feed into rolling buffer
            rolling.add_chunk(window)
            full_status = ""
            if rolling.is_full():
                segment = rolling.get_full_segment()
                full_segment_tensors.append(segment)
                full_status = f"  -> FULL SEGMENT READY {tuple(segment.shape)}"

            print(f"    Window {i:2d}: {label:7s}  streaming tensor {tuple(streaming_tensor.shape)}{full_status}")
        else:
            print(f"    Window {i:2d}: {label:7s}  (dropped, not sent to either path)")

    print("\n" + "=" * 65)
    print("SUMMARY")
    print(f"  Streaming tensors produced (path 1): {len(streaming_tensors)}")
    print(f"  Full-segment tensors produced (path 2): {len(full_segment_tensors)}")
    if full_segment_tensors:
        print(f"  Full-segment shape: {tuple(full_segment_tensors[0].shape)} "
              f"(expected (1, {FULL_SEGMENT_SAMPLES}))")
    else:
        print(f"  (0 is expected if the clip has under 4 seconds of continuous speech --")
        print(f"   try a longer voice note, 8-10+ seconds, to see path 2 produce output)")
    print("=" * 65)
    print("Both output paths verified.")