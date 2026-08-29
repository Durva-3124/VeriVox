# Module 2 — Development Summary
**Owner:** Durva | **Project:** VeriVox (SIH26104)

---

## What This Module Does

Module 2 is the ML core of VeriVox. It takes a raw 16 kHz mono audio waveform and produces three scores for the backend:

| Output | Range | Meaning |
|---|---|---|
| `score_acoustic` | 0–1 | DL model spoof probability (1 = spoof) |
| `score_prosody` | 0–1 | Heuristic prosodic spoof indicator |
| `score_speaker` | 0–1 or None | Cosine similarity vs enrolled speaker |

Plus a `raw_features` dict of 13 scalar features (4 acoustic + 9 prosodic) for Atharv's backend policy engine.

---

## Directory Layout

```
model/
├── rawnet2.py                  — RawNet2 anti-spoofing model
├── aasist.py                   — AASIST anti-spoofing model
├── speaker_verification.py     — ECAPA-TDNN speaker verification
├── inference.py                — run_module2() public entry point
├── features/
│   ├── acoustic.py             — 4 acoustic spoof-detection features
│   └── prosodic.py             — 9 prosodic / behavioural features
├── training/
│   ├── train.py                — training loop + EER evaluation
│   └── checkpoints/            — saved .pt model weights
│       ├── best_eer_rawnet2.pt
│       ├── best_eer_aasist.pt
│       ├── last_rawnet2.pt
│       └── last_aasist.pt
├── export/
│   ├── export_onnx.py          — ONNX export + verification
│   ├── benchmark_latency.py    — latency benchmark vs 50ms target
│   ├── rawnet2.onnx            — exported RawNet2 (87.8 MB)
│   ├── aasist.onnx             — exported AASIST (0.9 MB) ← production
│   └── aasist_3200.onnx        — intermediate (superseded)
└── .speechbrain_cache/         — ECAPA-TDNN pretrained weights (local)
```

---

## Step-by-Step Development Log

### Step 1 — RawNet2 Architecture (`model/rawnet2.py`)

Built the RawNet2 anti-spoofing model end-to-end from scratch.

**Architecture:**
```
Raw waveform (B, T)
  → SincConv (128 filters, kernel=1024, mel-initialised, learnable f_low + bandwidth)
  → BN + LeakyReLU
  → 6× ResBlock (Conv1d + BN + LeakyReLU + FMS gate + MaxPool1d(3))
      channels: 128→128→256→256→512→512
  → BN → 3-layer GRU (hidden=1024, dropout=0.1)
  → FC(1024→128) + BN + LeakyReLU  ← embedding
  → FC(128→2)                       ← logits
```

**Key design decisions:**
- SincConv uses learnable `(f_low, bandwidth)` pairs per filter, constrained positive with `torch.abs()` and clamped to `[30, Nyquist-30]` Hz. Mel-scale initialisation gives a good starting point.
- FMS (Feature Map Scaling) is a channel-wise sigmoid gate: `out = x * sigmoid(FC(avg_pool(x))) + sigmoid(...)`. Acts as learned channel attention.
- GRU takes the last hidden state of the final layer as the utterance-level representation.
- `forward()` returns both `(logits, embedding)` — the embedding is the penultimate 128-dim vector, used by the inference pipeline.

**Result:** 21,952,898 parameters. Smoke-test passed.

---

### Step 2 — AASIST Architecture (`model/aasist.py`)

Built the AASIST (Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks) model.

**Architecture:**
```
Raw waveform (B, T)
  → SincConv (70 filters, kernel=128, mel-initialised)
  → BN + LeakyReLU
  → Encoder: two parallel paths
      Spectral path: 3× _EncoderBlock(pool=3) → (B, d_model, T_s)
      Temporal path: 3× _EncoderBlock(pool=4) → (B, d_model, T_t)
  → Treat time frames as graph nodes: (B, N, d_model)
  → 2× HSGAL (Heterogeneous Stacking Graph Attention Layer)
      - intra-graph GAT on spectral nodes
      - intra-graph GAT on temporal nodes
      - cross-attention: spectral queries temporal
      - cross-attention: temporal queries spectral
      - LayerNorm residuals
  → mean + max readout over nodes → concat → (B, 4×d_model)
  → FC(256→128) + BN + LeakyReLU  ← embedding
  → FC(128→2)                      ← logits
```

**Problems encountered and fixed:**

1. **OOM on CPU** — Original GAT used pairwise-concat formulation allocating O(N²·D) tensors. With ~8000 temporal nodes this crashed. Fixed by:
   - Replacing pairwise-concat GAT with scaled dot-product attention (`bmm`-based, O(N·D) memory).
   - Increasing temporal encoder pool from `2→4` per block, reducing node count from ~8000 to ~31.

2. **ONNX incompatibility** — `nn.MultiheadAttention` bakes the sequence length into reshape nodes during TorchScript tracing, making the exported model fail at any input length other than the export dummy. Fixed by replacing `nn.MultiheadAttention` with `_CrossAttention` — a minimal Q/K/V linear + `bmm` implementation with no internal reshapes, fully dynamic-axis compatible.

**Result:** 209,306 parameters. Smoke-test passed.

---

### Step 3 — Training Loop (`model/training/train.py`)

Built a config-driven training loop that works for both models.

**Components:**
- `SpoofDataset` — reads CSV manifests (`filepath,label`), loads audio with `soundfile.read()`, resamples to 16 kHz via `torchaudio.functional.resample()`, pads/crops to 64,000 samples (4 s).
- `compute_eer()` — pure NumPy EER computation. Sorts by descending spoof score, computes cumulative FRR and FAR, finds crossover point.
- `train_one_epoch()` / `validate()` — standard CrossEntropyLoss + Adam loop. Spoof score = softmax probability of class 1.
- Dual checkpointing: `best_eer_<model>.pt` (lowest val EER) + `last_<model>.pt` (every epoch, safe resume).
- Full reproducibility: seeds `random`, `numpy`, `torch`, `torch.cuda`, `cudnn.deterministic=True`.

**Critical fix — audio loading:**
`torchaudio.load()` in torchaudio 2.9+ requires `torchcodec` as a hard dependency (not installed). Replaced with `soundfile.read()` + `torchaudio.functional.resample()` which has no such dependency.

**Checkpoint format:**
```python
{
    "epoch": int,
    "model_state": dict,          # best checkpoint only
    "optimizer_state": dict,      # last checkpoint only
    "val_eer": float,
    "args": dict,
}
```

Both models trained successfully on dummy data (2 epochs, val_eer=0.0 on synthetic data).

---

### Step 4 — Acoustic Feature Extraction (`model/features/acoustic.py`)

Four hand-crafted features targeting known vocoder/TTS artefact classes. All use librosa STFT with N_FFT=512, HOP=128.

| Feature | What it measures | Spoof indicator |
|---|---|---|
| `spectral_rolloff` | Mean 85% energy roll-off frequency, normalised by Nyquist | TTS often has unnatural bandwidth limits |
| `phase_consistency` | Mean absolute inter-frame phase deviation after removing expected linear advance | Vocoders (Griffin-Lim, HiFi-GAN) introduce phase discontinuities |
| `harmonic_structure` | HNR proxy via short-time autocorrelation peak ratio | Neural vocoders over-smooth harmonic series |
| `vocoder_artifact_2_4khz` | Spectral flatness ratio: 2–4 kHz band vs full spectrum | HiFi-GAN/WaveGlow leave flat noise-like residual in this band |

All return floats. `spectral_rolloff`, `phase_consistency`, `harmonic_structure` are in [0,1]. `vocoder_artifact_2_4khz` is ≥0 (>1 = more artefact-like than average).

---

### Step 5 — Prosodic Feature Extraction (`model/features/prosodic.py`)

Nine prosodic/behavioural features. Uses `parselmouth` (Praat) as primary backend with a pure-librosa fallback.

| Feature | Unit | Spoof rationale |
|---|---|---|
| `f0_mean` | Hz | — |
| `f0_std` | Hz | TTS produces unnaturally flat F0 (low std) |
| `f0_range` | Hz | TTS has compressed pitch range |
| `jitter_local` | — | Natural voices ~0.5–1.5%; neural vocoders ~0% |
| `shimmer_local` | — | Natural voices ~5–15%; synthesised speech too clean |
| `pause_count` | — | TTS may produce no pauses or uniform pauses |
| `pause_mean_dur_s` | s | — |
| `pause_total_ratio` | — | Fraction of signal that is silence |
| `speech_rate_syl_per_s` | syl/s | TTS sometimes unnaturally fast/constant |

**Implementation details:**
- F0/jitter/shimmer via Praat `PointProcess` when parselmouth is available; librosa `pyin` fallback otherwise.
- Pause detection via short-time RMS energy thresholding at −40 dB, minimum pause 100 ms.
- Speech rate via energy-envelope peak counting on a 200 ms Hanning-smoothed RMS curve.

---

### Step 6 — Speaker Verification (`model/speaker_verification.py`)

ECAPA-TDNN speaker embeddings via SpeechBrain's pretrained `spkrec-ecapa-voxceleb` model.

**Public API:**
- `enroll_speaker(list[Tensor])` → (192,) — averages per-utterance embeddings, re-normalises. Standard multi-utterance enrollment.
- `score_speaker(live_emb, enrolled_emb)` → float — `(cosine + 1) / 2`, maps [-1,1] to [0,1].
- `is_mismatch(score)` → bool — returns True if score < `SIMILARITY_THRESHOLD` (0.75).

**Problems encountered and fixed:**

1. **speechbrain 0.5.16 incompatible** — called `torchaudio.set_audio_backend()` which was removed in torchaudio 2.x. Upgraded to speechbrain 1.1.1.

2. **Windows symlink error** — HuggingFace Hub uses symlinks by default for model caching. On Windows without Developer Mode, symlink creation requires elevated privileges and fails silently. Fixed by passing `local_strategy=LocalStrategy.COPY` to `EncoderClassifier.from_hparams()`.

Model is loaded once per process via `@lru_cache(maxsize=1)` — no reload cost on repeated calls.

---

### Step 7 — Inference Pipeline (`model/inference.py`)

Single public function `run_module2()` that fuses all components into the exact dict contract Atharv's backend expects.

**Pipeline:**
```
waveform (B, T) @ 16 kHz
  ├─ DL model (RawNet2 or AASIST) → spoof_prob via softmax[:, 1]
  ├─ extract_acoustic_features()  → 4 acoustic scalars
  ├─ extract_prosodic_features()  → 9 prosodic scalars
  └─ _embed() + score_speaker()   → cosine similarity (if enrolled)
         ↓
  {
    "score_acoustic": float,
    "score_prosody":  float,   ← _prosodic_spoof_score() heuristic fusion
    "score_speaker":  float | None,
    "raw_features":   dict,    ← 13 flat scalars
  }
```

**Prosodic score fusion heuristic** (weights sum to 1.0):
```
score = 0.35 × jitter_score + 0.35 × shimmer_score + 0.20 × f0_std_score + 0.10 × rate_score
```
Each sub-score maps the feature to [0,1] where 1 = more spoof-like. Marked TODO to replace with a logistic regression head once Harsh's labelled splits are available.

Model selection via `MODULE2_MODEL` env var (`rawnet2` default, `aasist` for streaming). Model loaded lazily via `@lru_cache(maxsize=2)`.

---

### Step 8 — ONNX Export (`model/export/export_onnx.py`)

Exports trained checkpoints to ONNX opset 17 with dynamic batch and time axes, then verifies numerical correctness with onnxruntime.

**Export settings:**
- `dynamo=False` — uses legacy TorchScript-based exporter. The new dynamo exporter (default in torch 2.9+) requires the `dynamic_shapes` API and fails on GRU + SincConv tracing. Legacy path is stable for opset 17.
- Dynamic axes: `waveform {0: "batch", 1: "time"}`, `logits {0: "batch"}`, `embedding {0: "batch"}`.
- `do_constant_folding=True` — folds constants at export time for faster inference.

**Verification:** Loads exported model with onnxruntime, runs same dummy input, asserts `np.testing.assert_allclose(atol=1e-4)` on both logits and embeddings.

**ONNX node contract (for Atharv's backend):**
```
Input  : "waveform"   shape (batch, time)   float32
Output : "logits"     shape (batch, 2)       float32
         "embedding"  shape (batch, emb_dim) float32
```

---

### Step 9 — Latency Benchmarking (`model/export/benchmark_latency.py`)

Benchmarks ONNX inference latency against the project's 50 ms/chunk real-time target.

**Setup:**
- Window: 200 ms = 3,200 samples @ 16 kHz (matches Trisha's Module 1 windowing spec)
- 200 total runs, first 10 discarded as warmup
- Single-threaded ORT session (`intra_op_num_threads=1`) — matches edge deployment

**Results:**

| Model | Size | p50 | p95 | Target | Result |
|---|---|---|---|---|---|
| RawNet2 | 87.8 MB | 77 ms | — | < 50 ms | **FAIL** |
| AASIST | 0.9 MB | 14 ms | 18 ms | < 50 ms | **PASS** |

**Root cause of RawNet2 FAIL:** 21.9M parameters, 3-layer GRU with hidden=1024 is too heavy for 200 ms chunks on CPU.

**Root cause of first AASIST benchmark FAIL:** The initial AASIST export used `nn.MultiheadAttention` which baked the export dummy's sequence length (64,000 samples → ~118 nodes) into reshape nodes. Running the benchmark with 3,200-sample input (→ ~2 nodes) caused an ORT reshape error. Fixed by replacing `nn.MultiheadAttention` with `_CrossAttention` (see Step 2), retraining, and re-exporting.

---

## Deployment Recommendation

| Use case | Model | Reason |
|---|---|---|
| Streaming / real-time | **AASIST** | 0.9 MB, p50=14 ms (3.5× headroom vs 50 ms target) |
| Offline / batch analysis | RawNet2 | Higher capacity (22M params), better on seen attacks |

---

## Tech Stack

| Package | Version | Role |
|---|---|---|
| Python | 3.13 | — |
| torch | 2.12.1 | Model definition, training |
| torchaudio | 2.11.0 | Resampling (`functional.resample`) |
| soundfile | 0.14.0 | Audio loading (replaces `torchaudio.load`) |
| speechbrain | 1.1.1 | ECAPA-TDNN pretrained model |
| librosa | 1.0.0 | Acoustic + prosodic feature extraction |
| parselmouth | 0.4.7 | Praat-grade F0/jitter/shimmer |
| onnxruntime | 1.29.0 | ONNX inference + verification |
| onnxscript | 0.7.1 | ONNX export support |

---

## Known Issues & Workarounds

| Issue | Workaround |
|---|---|
| `torchaudio.load()` requires `torchcodec` in 2.9+ | Use `soundfile.read()` + `torchaudio.functional.resample()` |
| speechbrain 0.5.16 calls removed `set_audio_backend()` | Upgrade to speechbrain ≥ 1.0.0 |
| Windows HuggingFace Hub symlink failure | Pass `local_strategy=LocalStrategy.COPY` |
| `nn.MultiheadAttention` bakes sequence length into ONNX reshape nodes | Replace with `_CrossAttention` (Q/K/V linears + `bmm`) |
| RawNet2 ONNX p50=77 ms (FAIL vs 50 ms target) | Use AASIST for streaming deployment |
| `torch.onnx.export` dynamo=True fails on GRU + SincConv | Use `dynamo=False` (legacy TorchScript exporter) |

---

## Open Items (Pending Other Modules)

- Waiting on `ingestion/` (Trisha) — normalized audio tensor format spec and confirmed segment length
- Waiting on `datasets/` (Harsh) — ASVspoof 2019/2021 LA split manifests for real training
- Confirm `SIMILARITY_THRESHOLD=0.75` with Atharv (backend) and Harsh (datasets) once real VoxCeleb EER results are available
- Replace `_prosodic_spoof_score()` heuristic with a logistic regression head trained on labelled prosodic features
