"""
rolling_buffer_test.py
Implements the rolling 4-second buffer Durva specified for the
anti-spoofing full-segment path.

Two outputs now exist side by side:
  1. Streaming path: (1, 3200) tensor every 200ms -- already working
  2. Full-segment path: (1, 64000) tensor when the rolling buffer fills
     -- this is the NEW piece being added here

Uses a collections.deque(maxlen=20) since 20 chunks x 3200 samples
= 64,000 samples = exactly 4 seconds, per Durva's suggested approach.
"""

import numpy as np
from collections import deque
import torch

WINDOW_SAMPLES = 3200      # 200ms chunk, confirmed spec
BUFFER_CHUNKS = 20         # 20 x 3200 = 64,000 samples = 4 seconds
FULL_SEGMENT_SAMPLES = WINDOW_SAMPLES * BUFFER_CHUNKS


class RollingBuffer:
    """
    Maintains a rolling window of the last 4 seconds of audio,
    made of 200ms chunks. When full, produces a single (1, 64000)
    tensor ready to send to run_module2() for anti-spoofing scoring.
    """

    def __init__(self):
        self.buffer = deque(maxlen=BUFFER_CHUNKS)

    def add_chunk(self, chunk: np.ndarray):
        """Add a new 3200-sample chunk to the rolling buffer."""
        assert chunk.shape[0] == WINDOW_SAMPLES, \
            f"Expected {WINDOW_SAMPLES} samples, got {chunk.shape[0]}"
        self.buffer.append(chunk)

    def is_full(self) -> bool:
        """True once we have a full 4 seconds of audio buffered."""
        return len(self.buffer) == BUFFER_CHUNKS

    def get_full_segment(self):
        """
        Returns the full 4-second segment as a (1, 64000) torch.Tensor,
        ready to send to run_module2(). Only call this when is_full()
        is True.
        """
        concatenated = np.concatenate(list(self.buffer))
        tensor = torch.from_numpy(concatenated.copy()).unsqueeze(0)  # shape (1, 64000)
        return tensor


if __name__ == "__main__":
    print("Testing RollingBuffer with fake 200ms chunks...")
    print("-" * 60)

    rolling = RollingBuffer()

    # Simulate 25 incoming chunks (more than needed, to show the
    # buffer correctly stays at a max of 20 -- rolling window behavior)
    for i in range(25):
        fake_chunk = np.random.uniform(-0.5, 0.5, WINDOW_SAMPLES).astype(np.float32)
        rolling.add_chunk(fake_chunk)

        print(f"Chunk {i+1:2d} added. Buffer size: {len(rolling.buffer)}/{BUFFER_CHUNKS}  "
              f"Full: {rolling.is_full()}")

        if rolling.is_full():
            segment = rolling.get_full_segment()
            print(f"    -> Full segment ready! Shape: {tuple(segment.shape)}  "
                  f"Dtype: {segment.dtype}  (expected (1, {FULL_SEGMENT_SAMPLES}))")

    print("-" * 60)
    print("Rolling buffer test complete.")
    print(f"Expected full-segment shape: (1, {FULL_SEGMENT_SAMPLES})")
    print("This tensor is what gets sent to run_module2() for anti-spoofing scoring,")
    print("while the 200ms chunks continue flowing separately for the streaming path.")