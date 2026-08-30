"""
record_test.py
First test: capture 3 seconds of audio from the microphone and
confirm it comes through as a clean numpy array.
"""

import sounddevice as sd
import numpy as np

print(sd.query_devices())

DEVICE_ID = 9  # Microphone Array, Windows WASAPI
DURATION_SECONDS = 3
SAMPLE_RATE = 16000  # recording directly at the model's target rate

print("Recording will start in 1 second... get ready to speak.")
sd.sleep(1000)

print(f"Recording for {DURATION_SECONDS} seconds...")

audio = sd.rec(
    int(DURATION_SECONDS * SAMPLE_RATE),
    samplerate=SAMPLE_RATE,
    channels=1,
    dtype='float32',
    device=DEVICE_ID
)
sd.wait()

print("Recording finished!")
print("-" * 40)
print(f"Shape of captured audio: {audio.shape}")
print(f"Data type: {audio.dtype}")
print(f"Sample rate used: {SAMPLE_RATE} Hz")
print(f"Min value: {audio.min():.4f}, Max value: {audio.max():.4f}")
print("-" * 40)
print("If you see numbers above (not all zeros), your microphone capture is working!")