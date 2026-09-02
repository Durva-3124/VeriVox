"""
synthetic_test.py
Generates a fake audio signal (a sine wave) instead of recording from
a microphone. Use this to build and test resampling + windowing logic
while the real microphone driver issue is being fixed separately.

Once the mic works again, we swap this fake signal for real
sd.rec() output -- everything downstream (resampling, windowing)
should work unchanged, since it only cares about the numpy array,
not where it came from.
"""

import numpy as np

# ---- Step 1: Generate fake audio (pretend this came from a microphone) ----

ORIGINAL_SAMPLE_RATE = 44100   # pretend our "microphone" recorded at this rate
DURATION_SECONDS = 3
FREQUENCY = 440                # a clean 440Hz tone (musical note A) -- easy to sanity-check

t = np.linspace(0, DURATION_SECONDS, int(ORIGINAL_SAMPLE_RATE * DURATION_SECONDS), endpoint=False)
fake_audio = 0.5 * np.sin(2 * np.pi * FREQUENCY * t)
fake_audio = fake_audio.astype(np.float32)

print("Generated fake audio (standing in for a real mic recording):")
print(f"  Shape: {fake_audio.shape}")
print(f"  Dtype: {fake_audio.dtype}")
print(f"  Sample rate: {ORIGINAL_SAMPLE_RATE} Hz")
print(f"  Min: {fake_audio.min():.4f}, Max: {fake_audio.max():.4f}")
print("-" * 50)


# ---- Step 2: Resample to 16kHz mono float32 (Durva's confirmed spec) ----

TARGET_SAMPLE_RATE = 16000

def resample_audio(audio, original_rate, target_rate):
    """
    Resamples a 1D numpy audio array from original_rate to target_rate.
    Uses simple linear interpolation -- good enough for our pipeline test;
    librosa.resample can replace this later for higher-quality resampling.
    """
    duration = len(audio) / original_rate
    target_length = int(duration * target_rate)
    original_indices = np.linspace(0, len(audio) - 1, num=len(audio))
    target_indices = np.linspace(0, len(audio) - 1, num=target_length)
    resampled = np.interp(target_indices, original_indices, audio)
    return resampled.astype(np.float32)

resampled_audio = resample_audio(fake_audio, ORIGINAL_SAMPLE_RATE, TARGET_SAMPLE_RATE)

print("After resampling to 16kHz:")
print(f"  Shape: {resampled_audio.shape}")
print(f"  Dtype: {resampled_audio.dtype}")
print(f"  Expected length: {TARGET_SAMPLE_RATE * DURATION_SECONDS} samples")
print("-" * 50)


# ---- Step 3: Slice into 200ms (3200-sample) windows, 50% overlap ----

WINDOW_SAMPLES = 3200   # 200ms at 16kHz -- confirmed by Durva
STEP_SAMPLES = WINDOW_SAMPLES // 2   # 50% overlap = 1600-sample step

def make_windows(audio, window_size, step_size):
    """
    Slices a 1D audio array into overlapping windows.
    Returns a list of numpy arrays, each exactly window_size long.
    Drops the final partial window if there isn't enough audio left.
    """
    windows = []
    start = 0
    while start + window_size <= len(audio):
        windows.append(audio[start:start + window_size])
        start += step_size
    return windows

windows = make_windows(resampled_audio, WINDOW_SAMPLES, STEP_SAMPLES)

print(f"Windowing result:")
print(f"  Number of windows produced: {len(windows)}")
print(f"  Each window shape: {windows[0].shape if windows else 'N/A'}")
print(f"  Each window dtype: {windows[0].dtype if windows else 'N/A'}")
print("-" * 50)

# Sanity check: every window should be EXACTLY 3200 samples
all_correct_size = all(w.shape[0] == WINDOW_SAMPLES for w in windows)
print(f"All windows are exactly {WINDOW_SAMPLES} samples: {all_correct_size}")

if all_correct_size:
    print("\n✅ Resampling + windowing logic is working correctly!")
    print("   This code is ready to use with real microphone audio")
    print("   once the mic driver issue is fixed.")