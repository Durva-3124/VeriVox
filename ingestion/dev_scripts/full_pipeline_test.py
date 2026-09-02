"""
full_pipeline_test.py
Chains together everything built so far, run on REAL audio (not synthetic):

  1. Codec normalization  -- decode any format (Opus/AAC/WAV/etc.) to 16kHz mono float32
  2. Windowing             -- slice into 3,200-sample (200ms) windows, 50% overlap
  3. VAD                   -- flag each window as speech or silence
  4. Tensor conversion     -- convert final output to torch.Tensor, shape (1, T)
                              (this closes the last open item from Durva's questions)

Note: this script needs the 'torch' library. If it isn't installed yet, run:
    py -m pip install torch
"""

import sys
import time
import numpy as np

from codec_normalization import normalize_audio_file, TARGET_SAMPLE_RATE

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


WINDOW_SAMPLES = 3200          # 200ms at 16kHz -- confirmed by Durva
STEP_SAMPLES = WINDOW_SAMPLES // 2   # 50% overlap
VAD_FRAME_MS = 30
VAD_FRAME_SAMPLES = int(TARGET_SAMPLE_RATE * VAD_FRAME_MS / 1000)


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


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: py full_pipeline_test.py <path_to_audio_file>")
        sys.exit(1)

    input_file = sys.argv[1]

    print(f"FULL PIPELINE TEST on real audio: {input_file}")
    print("=" * 60)

    # ---- Step 1: Codec normalization ----
    print("\n[1] Codec normalization...")
    audio = normalize_audio_file(input_file)
    print(f"    Decoded: {audio.shape[0]} samples, {audio.dtype}, "
          f"{audio.shape[0] / TARGET_SAMPLE_RATE:.2f}s")

    # ---- Step 2: Windowing ----
    print("\n[2] Windowing (200ms / 3200 samples, 50% overlap)...")
    windows = make_windows(audio, WINDOW_SAMPLES, STEP_SAMPLES)
    print(f"    Produced {len(windows)} windows")

    # ---- Step 3: VAD ----
    print("\n[3] Voice Activity Detection...")
    if not VAD_AVAILABLE:
        print("    webrtcvad not installed -- skipping VAD step.")
        print("    Run: py -m pip install webrtcvad")
        speech_windows = windows
    else:
        vad = webrtcvad.Vad(2)
        speech_windows = []
        for i, window in enumerate(windows):
            start_time = time.perf_counter()
            speech = is_speech(window, vad)
            latency_ms = (time.perf_counter() - start_time) * 1000
            label = "SPEECH" if speech else "silence"
            print(f"    Window {i:2d}: {label:7s}  ({latency_ms:.2f}ms)")
            if speech:
                speech_windows.append(window)
        print(f"    Kept {len(speech_windows)} speech windows, "
              f"dropped {len(windows) - len(speech_windows)} silent windows")

    # ---- Step 4: Tensor conversion (Durva's requirement) ----
    print("\n[4] Tensor conversion...")
    if not TORCH_AVAILABLE:
        print("    torch not installed -- skipping tensor conversion.")
        print("    Run: py -m pip install torch")
    else:
        if speech_windows:
            example_window = speech_windows[0]
            tensor = torch.from_numpy(example_window).unsqueeze(0)  # shape (1, T)
            print(f"    Example window converted to tensor:")
            print(f"    Shape: {tuple(tensor.shape)}  (should be (1, {WINDOW_SAMPLES}))")
            print(f"    Dtype: {tensor.dtype}")
            print(f"    This matches Durva's required (1, T) torch.Tensor format.")
        else:
            print("    No speech windows detected -- nothing to convert.")

    print("\n" + "=" * 60)
    print("Full pipeline test complete: codec -> window -> VAD -> tensor")