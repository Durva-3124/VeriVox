# Progress — VeriVox / model/

## Done
- [x] `model/README.md` — scope defined
- [x] Memory Bank initialized at `.amazonq/rules/memory-bank/`
- [x] Stack pinned (Python 3.10.13, torch 2.2.1, torchaudio 2.2.1, speechbrain 0.5.16, onnxruntime 1.17.x)

## In Progress
- [x] Directory scaffold: `model/training/`, `model/training/checkpoints/`

## Pending — Module 2 Milestones
- [x] `model/rawnet2.py` — RawNet2 model definition (SincConv + FMS ResBlocks + GRU + dual-output forward)
- [x] `model/aasist.py` — AASIST model definition (SincConv + encoder + HS-GAL + mean/max readout + dual-output forward)
- [x] `model/speaker_verification.py` — ECAPA-TDNN enrollment + cosine scoring + threshold gate (speechbrain 1.1.1, LocalStrategy.COPY for Windows)
- [ ] `configs/` — training hyperparameter configs
- [x] `model/training/train.py` — training loop (SpoofDataset, EER, Adam, best-EER + last checkpointing)
- [ ] `eval/eer.py` — EER + t-DCF scoring utilities
- [x] `inference/export_onnx.py` — ONNX export + verification
- [x] `model/inference.py` — run_module2() pipeline (DL score + acoustic + prosodic + speaker, exact backend contract)
- [ ] `requirements.txt` — pinned dependencies

## Blockers
- Waiting on `ingestion/` audio tensor format spec (Trisha)
- Waiting on `datasets/` split manifests (Harsh)

## Known Issues
- AASIST `nn.MultiheadAttention` replaced with `_CrossAttention` (bmm-only) for ONNX dynamic-axis compatibility
- RawNet2 ONNX export: p50=77ms on CPU (FAIL vs 50ms target) — use AASIST for streaming deployment
- AASIST ONNX export: p50=14ms, p95=18ms on CPU (PASS)
