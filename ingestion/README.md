# ingestion/ — Module 1: Audio Ingestion Pipeline

Converts raw audio (file or live stream) into **200 ms chunks of shape `(1, 3200)` float32 `torch.Tensor` at 16 kHz** — the exact format consumed by `model/inference.py`.

## Files

| File | Purpose |
|---|---|
| `pipeline.py` | Main `IngestionPipeline` class — windowing, VAD gate, chunk emission |
| `vad.py` | Energy-based VAD — RMS per 10 ms frame, no ML dependencies |
| `codec_norm.py` | Load any audio format → 16 kHz mono float32 numpy array |
| `record_test.py` | Microphone capture smoke test (sounddevice) |

## Output Contract

Every chunk emitted by `IngestionPipeline` is:
- Shape: `(1, 3200)` — 1 channel × 3200 samples
- Sample rate: 16 000 Hz
- Duration: 200 ms
- dtype: `torch.float32`
- Values: `[-1.0, 1.0]`

## Usage

### File mode
```python
from ingestion.pipeline import IngestionPipeline

pipeline = IngestionPipeline()
for chunk in pipeline.process_file("audio.wav"):
    # chunk: (1, 3200) torch.Tensor
    pass
```

### Live streaming (microphone callback)
```python
pipeline = IngestionPipeline()

def audio_callback(indata, frames, time, status):
    chunks = pipeline.push(indata, sr=16000)
    for chunk in chunks:
        # chunk: (1, 3200) torch.Tensor
        pass
```

### Assemble into 4-second segment for model
```python
from collections import deque
from model.inference import assemble_segment, run_module2

buffer = deque(maxlen=20)  # 20 × 200 ms = 4 s

for chunk in pipeline.process_file("audio.wav"):
    buffer.append(chunk)
    if len(buffer) == 20:
        segment = assemble_segment(list(buffer))  # (1, 64000)
        result = run_module2(segment, sr=16000)
```

## VAD

VAD is energy-based (RMS per 10 ms frame). Silent chunks are dropped by default.

- `vad_enabled=True` (default) — drops chunks where < 10% of frames are speech
- `vad_threshold_db=-40.0` — RMS threshold in dB
- Disable: `IngestionPipeline(vad_enabled=False)`

## Dependencies

All already in the root `requirements.txt`:
- `torch` / `torchaudio` — tensor ops, resampling fallback
- `soundfile` — fast WAV/FLAC loading
- `scipy` — resampling (optional, falls back to torchaudio)
- `sounddevice` — live microphone capture (record_test.py only)
