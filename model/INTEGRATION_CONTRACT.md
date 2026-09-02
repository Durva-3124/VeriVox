# Module 2 — Integration Contract

**Owner:** Durva | **Status:** Development complete — awaiting confirmation from each section below before integration is load-bearing.

All facts in this document are sourced directly from:
`inference.py`, `speaker_verification.py`, `training/train.py`,
`export/export_onnx.py`, `export/benchmark_latency.py`

---

## For Trisha (ingestion/)

Module 2 requires the following from ingestion's output. Please confirm each point matches what `ingestion/` will produce before the pipeline is wired end-to-end.

**Required input to `run_module2()`** — sourced from `inference.py` docstring:

| Property | Module 2 requires | Please confirm |
|---|---|---|
| Type | `torch.Tensor` | ☐ |
| Shape | `(T,)` or `(1, T)` — 1-D or 2-D with batch dim of 1 | ☐ |
| dtype | `float32` (cast applied internally, but pass float32) | ☐ |
| Channels | Mono only. Multi-channel input is not handled by `run_module2()`. | ☐ |
| Sample rate | **16 000 Hz exactly.** `sr` is passed as a parameter and used directly — no resampling happens inside `run_module2()`. | ☐ |
| Segment length (scoring) | ~64 000 samples (4 s) for anti-spoofing scoring. Shorter segments are zero-padded during training; the inference path does not pad — pass the full segment. | ☐ |

**Streaming window size** — sourced from `benchmark_latency.py` constants:

```python
SAMPLE_RATE    = 16_000
WINDOW_MS      = 200
WINDOW_SAMPLES = 3_200   # int(16_000 * 200 / 1000)
```

The latency benchmark (and the ONNX model's dynamic time axis) is built around **200 ms = 3 200 samples per chunk**. The ONNX model accepts any time length due to dynamic axes, but 3 200 samples is the window size Module 2 was benchmarked against. Module 2 requires confirmation that ingestion will emit chunks of this size.

**Latency target** — sourced from `benchmark_latency.py`:

```python
LATENCY_TARGET_MS = 50.0   # from project proposal
```

Module 2's AASIST ONNX model was benchmarked at p50 = 14 ms and p95 = 18 ms on a single-threaded CPU session against 3 200-sample chunks. This leaves headroom for ingestion + backend overhead within the 50 ms budget.

---

## For Harsh (datasets/)

Module 2's `SpoofDataset` in `training/train.py` reads CSV manifests directly. The format is fixed — the loader uses `csv.DictReader` with hardcoded column names.

**Required CSV format** — sourced from `train.py` docstring and `SpoofDataset.__init__`:

```
filepath,label
/absolute/path/to/utterance.flac,0
/absolute/path/to/utterance.flac,1
```

| Property | Requirement |
|---|---|
| Column names | Exactly `filepath` and `label` — `DictReader` will silently return `None` for any other name |
| `filepath` | Absolute path. The loader calls `sf.read(filepath, ...)` directly with no path joining. |
| `label` encoding | `0` = bonafide, `1` = spoof — cast via `int(row["label"])` |
| Audio format | Any format readable by `soundfile` (WAV, FLAC, OGG). Not pre-resampled — `SpoofDataset` resamples to 16 000 Hz internally via `torchaudio.functional.resample()` if `sr != 16_000`. |
| Channels | Any — mixed down to mono inside `SpoofDataset.__getitem__` via `.mean(dim=0)`. |
| Segment length | Any — padded to 64 000 samples if shorter, randomly cropped if longer. |
| Header row | Required — `DictReader` treats the first row as column names. |

**Training command** (for reference when handing over split CSVs):

```bash
python model/training/train.py \
    --model     aasist \
    --train_csv datasets/processed/train.csv \
    --val_csv   datasets/processed/val.csv \
    --epochs    20 \
    --batch_size 24 \
    --lr        1e-4 \
    --seed      42
```

Default `--checkpoint_dir` is `model/training/checkpoints/`. Checkpoints written:
- `best_eer_<model>.pt` — lowest validation EER seen across all epochs
- `last_<model>.pt` — end of every epoch (safe resume point)

**Note on current checkpoint state:** Both checkpoints in the repo were trained on synthetic dummy data (sine tones + white noise). `val_eer = 0.0` on that data is meaningless — it reflects trivial separation of synthetic signals, not real spoof detection performance. Real training requires Harsh's ASVspoof 2019/2021 LA split CSVs.

---

## For Atharv (backend/)

### `run_module2()` return contract

Sourced from `inference.py` — key names are fixed, do not rename:

```python
from model.inference import run_module2, assemble_segment

result = run_module2(
    waveform,                        # torch.Tensor, (T,) or (1,T), float32, 16kHz
    sr=16_000,                       # int
    enrolled_speaker_embedding=None, # Optional[torch.Tensor] shape (192,)
    model_name="aasist",             # str, overrides MODULE2_MODEL env var
)
```

Return type is `dict` with exactly these keys:

| Key | Type | Range | Meaning |
|---|---|---|---|
| `"score_acoustic"` | `float` | [0, 1] | Softmax probability of class 1 (spoof). `1.0` = definitely spoof. Sourced from `F.softmax(logits, dim=-1)[0, 1]`. |
| `"score_prosody"` | `float` | [0, 1] | Heuristic prosodic spoof indicator. See fusion weights below. |
| `"score_speaker"` | `float` **or** `None` | [0, 1] or None | `(cosine_similarity + 1) / 2` vs enrolled embedding. **`None` when `enrolled_speaker_embedding` is not passed** — backend must handle this case explicitly. |
| `"raw_features"` | `dict[str, float]` | — | 13 flat scalar features (see keys below). |

`raw_features` keys — sourced from `inference.py` docstring:

```
acoustic (4):  spectral_rolloff, phase_consistency,
               harmonic_structure, vocoder_artifact_2_4khz

prosodic (9):  f0_mean, f0_std, f0_range,
               jitter_local, shimmer_local,
               pause_count, pause_mean_dur_s, pause_total_ratio,
               speech_rate_syl_per_s
```

**Prosodic score fusion weights** — sourced from `_prosodic_spoof_score()` in `inference.py`:

```python
score = 0.35 * jitter_score + 0.35 * shimmer_score + 0.20 * f0_std_score + 0.10 * rate_score
```

These weights are hand-tuned heuristics, not trained. See Rutuja's section for the implications.

### ONNX model — node names and shapes

Sourced from `export_onnx.py` (`input_names`, `output_names`, `dynamic_axes`) and the `_verify()` print statements:

| Node | Name | Shape | dtype |
|---|---|---|---|
| Input | `"waveform"` | `(batch, time)` — both axes dynamic | `float32` |
| Output 0 | `"logits"` | `(batch, 2)` — batch dynamic | `float32` |
| Output 1 | `"embedding"` | `(batch, 128)` — batch dynamic, emb_dim=128 for both AASIST and RawNet2 | `float32` |

`logits[:, 1]` after softmax = spoof probability. `logits[:, 0]` = bonafide probability.

Minimal ORT call:

```python
import onnxruntime as ort
import numpy as np

sess = ort.InferenceSession("model/export/aasist.onnx",
                            providers=["CPUExecutionProvider"])
chunk = np.zeros((1, 3200), dtype=np.float32)   # (batch=1, time=3200)
logits, embedding = sess.run(None, {"waveform": chunk})
# stable softmax — avoid np.exp() directly on raw logits (overflow risk)
from scipy.special import softmax
spoof_prob = float(softmax(logits[0])[1])  # class 1 = spoof
```

### Model selection

Sourced from `inference.py` (`_DEFAULT_MODEL`, `_load_model`) and `benchmark_latency.py`:

```python
# env var controls which PyTorch checkpoint is loaded at runtime
# default is "rawnet2" if MODULE2_MODEL is not set
_DEFAULT_MODEL = os.environ.get("MODULE2_MODEL", "rawnet2").lower()
```

| Model | File | Size | p50 latency | p95 latency | Target (50 ms) |
|---|---|---|---|---|---|
| `aasist` | `model/export/aasist.onnx` | 0.9 MB | 14 ms | 18 ms | **PASS** |
| `rawnet2` | `model/export/rawnet2.onnx` | 87.8 MB | 77 ms | — | **FAIL** |

Benchmark conditions (from `benchmark_latency.py`): single-threaded ORT session (`intra_op_num_threads=1`, `inter_op_num_threads=1`), 200 runs, 10 warmup discarded, input shape `(1, 3200)`.

**Recommendation: set `MODULE2_MODEL=aasist` in the backend service environment.** RawNet2 is available for offline/batch use only.

### `SIMILARITY_THRESHOLD` — ⚠️ UNCONFIRMED, needs Atharv's sign-off

Sourced from `speaker_verification.py`:

```python
# TODO: confirm with Atharv (backend) and Harsh (datasets) once real
#       speaker-verification EER results are available on ASVspoof/VoxCeleb.
#       0.75 is a conservative starting point — lower = stricter.
SIMILARITY_THRESHOLD: float = 0.75
```

`is_mismatch(score)` returns `True` (reject) when `score_speaker < 0.75`. This threshold gates the speaker-match decision in the risk formula. **It has not been validated against real speaker data — it is a placeholder.** Before `score_speaker` is used as a load-bearing signal in the risk policy, Atharv and Harsh need to agree on a threshold derived from real EER measurements on VoxCeleb or ASVspoof speaker trials.

---

## For Rutuja (docs/pitch)

Two components of Module 2 need to be labeled carefully in any pitch deck or architecture document. Both are real, working implementations — the caveat is about what has and has not been measured on real data.

### What is validated

| Claim | Evidence |
|---|---|
| AASIST ONNX inference runs in < 50 ms per 200 ms chunk on CPU | Benchmarked: p50 = 14 ms, p95 = 18 ms (`benchmark_latency.py`, single-threaded ORT, input shape `(1, 3200)`) |
| AASIST ONNX output numerically matches PyTorch within atol=1e-4 | Verified by `_verify()` in `export_onnx.py` using `np.testing.assert_allclose` |
| Both models train to convergence and checkpoint correctly | Confirmed on synthetic dummy data — training loop, EER computation, and checkpointing all function correctly |

### What is designed but not yet measured on real data

**1. AASIST chosen over RawNet2 for streaming — latency decision only**

The current checkpoint selection (`best_eer_aasist.pt`) was trained on synthetic data (sine tones for bonafide, white noise for spoof). The reported `val_eer = 0.0` reflects trivial separation of those signals — it is not a meaningful anti-spoofing EER. The choice of AASIST over RawNet2 for the production path is currently justified solely by latency (14 ms vs 77 ms). Whether AASIST achieves better or worse EER than RawNet2 on real ASVspoof data has not been measured.

If the pitch deck references EER or detection accuracy, label it: **"architecture validated; EER pending real ASVspoof training run."**

**2. Prosodic fusion score — hand-weighted heuristic, not a trained classifier**

The `score_prosody` output is computed by `_prosodic_spoof_score()` in `inference.py` using fixed weights:

```python
score = 0.35 * jitter_score + 0.35 * shimmer_score + 0.20 * f0_std_score + 0.10 * rate_score
```

The weights and the normalisation thresholds (e.g. jitter normalised by `0.02`, shimmer by `0.15`, f0_std by `30.0`) are manually chosen based on known natural-speech ranges. The code itself marks this with:

```python
# TODO: replace with a logistic regression head trained on
#       ASVspoof prosodic features once Harsh's splits are ready.
```

This is not a trained classifier. It has not been evaluated against labelled spoof/bonafide prosodic data. If the pitch deck references prosodic analysis as a detection signal, label it: **"feature extraction implemented; fusion weights are heuristic, not trained."**
