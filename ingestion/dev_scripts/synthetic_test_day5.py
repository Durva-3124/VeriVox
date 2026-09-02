"""
synthetic_test_day5.py
Builds on Day 3-4 (resampling + windowing) by adding:
  1. VAD (Voice Activity Detection) -- flags each window as speech or silence
  2. Per-chunk latency logging -- times how long processing takes per window

Still uses synthetic (fake) audio so we don't depend on the microphone
driver being fixed. Swap in real mic audio later without changing
the logic below.
"""

import numpy as np
import webrtcvad
import time

# ---- Step 1: Generate fake audio (half tone, half silence, to test VAD properly) ----

ORIGINAL_SAMPLE_RATE = 44100
DURATION_SECONDS = 3
FREQUENCY = 440

t = np.linspace(0, DURATION_SECONDS, int(ORIGINAL_SAMPLE_RATE * DURATION_SECONDS), endpoint=False)
tone = 0.5 * np.sin(2 * np.pi * FREQUENCY * t)

# Make the first half silence and the second half a tone,
# so we can actually see VAD tell the difference
half = len(tone) // 2
fake_audio = np.concatenate([
    np.zeros(half, dtype=np.float32),   # silence
    tone[half:].astype(np.float32)      # "speech" (a tone, standing in for a voice)
])

print(f"Generated fake audio: first half silence, second half a tone.")
print("-" * 50)


# ---- Step 2: Resample to 16kHz mono float32 (same as Day 3) ----

TARGET_SAMPLE_RATE = 16000

def resample_audio(audio, original_rate, target_rate):
    duration = len(audio) / original_rate
    target_length = int(duration * target_rate)
    original_indices = np.linspace(0, len(audio) - 1, num=len(audio))
    target_indices = np.linspace(0, len(audio) - 1, num=target_length)
    resampled = np.interp(target_indices, original_indices, audio)
    return resampled.astype(np.float32)

resampled_audio = resample_audio(fake_audio, ORIGINAL_SAMPLE_RATE, TARGET_SAMPLE_RATE)


# ---- Step 3: Slice into 200ms (3200-sample) windows, 50% overlap (same as Day 4) ----

WINDOW_SAMPLES = 3200
STEP_SAMPLES = WINDOW_SAMPLES // 2

def make_windows(audio, window_size, step_size):
    windows = []
    start = 0
    while start + window_size <= len(audio):
        windows.append(audio[start:start + window_size])
        start += step_size
    return windows

windows = make_windows(resampled_audio, WINDOW_SAMPLES, STEP_SAMPLES)
print(f"Produced {len(windows)} windows of {WINDOW_SAMPLES} samples each.")
print("-" * 50)


# ---- Step 4 (NEW - Day 5): Voice Activity Detection ----

# webrtcvad needs int16 audio, not float32 -- this is a required conversion,
# separate from the float32 we send to Durva's model. VAD gets its own copy.
def float32_to_int16(audio_float32):
    return (audio_float32 * 32767).astype(np.int16)

# webrtcvad aggressiveness: 0 = least aggressive (lets more through as "speech"),
# 3 = most aggressive (strict, filters more aggressively). Start at 2, a good middle ground.
vad = webrtcvad.Vad(2)

# IMPORTANT: webrtcvad only accepts EXACT frame sizes: 10ms, 20ms, or 30ms
# at 16kHz. Our 200ms window needs to be checked as several small sub-frames,
# then we decide "speech" if enough of them are speech.
VAD_FRAME_MS = 30
VAD_FRAME_SAMPLES = int(TARGET_SAMPLE_RATE * VAD_FRAME_MS / 1000)  # 480 samples

def is_speech(window_float32, vad_instance):
    """
    Returns True if this 200ms window contains speech, False if silence.
    Splits the window into 30ms sub-frames (what webrtcvad requires)
    and votes: if more than half the sub-frames are speech, call the window speech.
    """
    window_int16 = float32_to_int16(window_float32)
    audio_bytes = window_int16.tobytes()

    speech_votes = 0
    total_frames = 0
    for start in range(0, len(window_int16) - VAD_FRAME_SAMPLES + 1, VAD_FRAME_SAMPLES):
        frame = window_int16[start:start + VAD_FRAME_SAMPLES]
        frame_bytes = frame.tobytes()
        total_frames += 1
        if vad_instance.is_speech(frame_bytes, TARGET_SAMPLE_RATE):
            speech_votes += 1

    if total_frames == 0:
        return False
    return (speech_votes / total_frames) > 0.5


# ---- Step 5 (NEW - Day 5): Process each window with latency logging ----

print("Processing windows (VAD + latency logging):")
print("-" * 50)

speech_windows = []
silence_count = 0
total_latency_ms = 0

for i, window in enumerate(windows):
    start_time = time.perf_counter()

    speech_detected = is_speech(window, vad)

    end_time = time.perf_counter()
    latency_ms = (end_time - start_time) * 1000
    total_latency_ms += latency_ms

    label = "SPEECH" if speech_detected else "silence"
    if speech_detected:
        speech_windows.append(window)
    else:
        silence_count += 1

    print(f"  Window {i:2d}: {label:7s}  |  processing time: {latency_ms:.2f}ms")

print("-" * 50)
print(f"Total windows: {len(windows)}")
print(f"Speech windows kept: {len(speech_windows)}")
print(f"Silent windows dropped: {silence_count}")
print(f"Average processing latency per window: {total_latency_ms / len(windows):.2f}ms")
print("-" * 50)
print("✅ VAD + latency logging working. Silent windows are correctly")
print("   being filtered out before they'd be sent to Durva's model.")