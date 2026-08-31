# model/ — Module 2: Anti-Spoofing & Speaker Verification

**Owner:** Durva | **Status:** Development complete — integration/handoff phase

---

## What this module produces

`run_module2(waveform, sr, enrolled_speaker_embedding?)` → dict

```python
{
    "score_acoustic":  float,        # DL spoof probability [0,1]  — 1.0 = spoof
    "score_prosody":   float,        # prosodic spoof indicator [0,1]
    "score_speaker":   float | None, # cosine similarity vs enrolled speaker [0,1]
    "raw_features":    dict,         # 13 flat scalars (see below)
}
```

`raw_features` keys: `spectral_rolloff`, `phase_consistency`, `harmonic_structure`,
`vocoder_artifact_2_4khz`, `f0_mean`, `f0_std`, `f0_range`, `jitter_local`,
`shimmer_local`, `pause_count`, `pause_mean_dur_s`, `pause_total_ratio`,
`speech_rate_syl_per_s`

---

## Files

```
model/
├── rawnet2.py                  RawNet2 — 21.9M params, SincConv+GRU
├── aasist.py                   AASIST  — 209K params, graph-attention (use for streaming)
├── speaker_verification.py     ECAPA-TDNN enrollment + cosine scoring
├── inference.py                run_module2() — public entry point for backend
├── features/
│   ├── acoustic.py             4 vocoder-targeting acoustic features (librosa)
│   └── prosodic.py             9 prosodic features (parselmouth/librosa fallback)
├── training/
│   ├── train.py                training loop — SpoofDataset, EER, Adam, checkpointing
│   └── checkpoints/            *.pt files (gitignored — not committed)
│       ├── best_eer_aasist.pt
│       ├── best_eer_rawnet2.pt
│       ├── last_aasist.pt
│       └── last_rawnet2.pt
├── export/
│   ├── export_onnx.py          ONNX export (opset 17, dynamic batch+time axes)
│   ├── benchmark_latency.py    latency benchmark vs 50 ms/chunk target
│   ├── aasist.onnx             production model — 0.9 MB (gitignored)
│   └── rawnet2.onnx            offline/batch model — 87.8 MB (gitignored)
└── MODULE_SUMMARY.md           full development log with all decisions and fixes
```

---

## For Atharv (backend/)

### Calling the inference pipeline

```python
import sys
sys.path.insert(0, "model/")          # or set PYTHONPATH
from inference import run_module2
import torch

waveform = torch.zeros(64_000)        # (T,) float32, 16 kHz mono, ~4 s
result = run_module2(waveform, sr=16_000)

# With speaker verification:
from speaker_verification import enroll_speaker
enrolled = enroll_speaker([enroll_wav1, enroll_wav2])   # list of (T,) tensors
result = run_module2(waveform, sr=16_000, enrolled_speaker_embedding=enrolled)
```

### Using the ONNX model directly (recommended for production)

```python
import onnxruntime as ort
import numpy as np

sess = ort.InferenceSession("model/export/aasist.onnx",
                            providers=["CPUExecutionProvider"])
chunk = np.random.randn(1, 3200).astype(np.float32)   # (batch, time)
logits, embedding = sess.run(None, {"waveform": chunk})
# logits:    (1, 2)   — softmax[:,1] = spoof probability
# embedding: (1, 128) — penultimate representation
```

**ONNX node names:**
- Input:  `"waveform"` — shape `(batch, time)` — `float32`
- Output: `"logits"` — shape `(batch, 2)` — `float32`
- Output: `"embedding"` — shape `(batch, 128)` — `float32`

### Model selection

| Model | ONNX size | p50 latency | Use for |
|---|---|---|---|
| `aasist.onnx` | 0.9 MB | **14 ms** ✅ | Streaming / real-time (recommended) |
| `rawnet2.onnx` | 87.8 MB | 77 ms ❌ | Offline / batch only |

Set `MODULE2_MODEL=aasist` env var to switch the PyTorch inference path.
Latency target: < 50 ms/chunk on CPU (200 ms window = 3 200 samples @ 16 kHz).

---

## For Trisha (ingestion/)

### Expected input format

- `torch.Tensor` of shape `(T,)` or `(1, T)` — **float32**
- Sample rate: **16 000 Hz**, mono
- Segment length: **64 000 samples (4 s)** for anti-spoofing scoring
  - Shorter segments are zero-padded internally; longer are randomly cropped during training
- The ONNX model also accepts **3 200 samples (200 ms)** for streaming — dynamic time axis

---

## For Harsh (datasets/)

### Training CSV format

```
filepath,label
/abs/path/to/audio.flac,0
/abs/path/to/audio.flac,1
```

`label`: `0` = bonafide, `1` = spoof. Absolute paths, any sample rate (resampled to 16 kHz internally).

### Running training

```bash
python model/training/train.py \
    --model    aasist \
    --train_csv datasets/processed/train.csv \
    --val_csv   datasets/processed/val.csv \
    --epochs    20 \
    --batch_size 24 \
    --lr        1e-4
```

Checkpoints saved to `model/training/checkpoints/best_eer_<model>.pt` and `last_<model>.pt`.

### Re-exporting after real training

```bash
python model/export/export_onnx.py --model aasist
python model/export/benchmark_latency.py --onnx model/export/aasist.onnx
```

---

## Known issues / gotchas

| Issue | Fix applied |
|---|---|
| `torchaudio.load()` requires `torchcodec` in 2.9+ | Using `soundfile.read()` + `torchaudio.functional.resample()` |
| speechbrain 0.5.16 calls removed `set_audio_backend()` | Pinned to speechbrain==1.1.1 |
| Windows HuggingFace Hub symlink failure | `LocalStrategy.COPY` in `speaker_verification.py` |
| `nn.MultiheadAttention` bakes sequence length into ONNX reshape nodes | Replaced with `_CrossAttention` (bmm-only) in `aasist.py` |
| `torch.onnx.export` dynamo=True fails on GRU+SincConv | `dynamo=False` in `export_onnx.py` |

---

## Open items (blocked on other modules)

- **Trisha** — confirm 200 ms window and 16 kHz mono as the ingestion output spec
- **Harsh** — provide ASVspoof 2019/2021 LA split CSVs for real training run
- **Atharv** — confirm `SIMILARITY_THRESHOLD=0.75` once real VoxCeleb EER is measured
- **Atharv** — confirm whether ONNX or PyTorch path is preferred in the FastAPI service
