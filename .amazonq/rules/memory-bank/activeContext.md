# Active Context — VeriVox / model/

## Current State
- `model/` contains only `README.md` — no implementation yet
- Memory Bank initialized
- Stack pinned and documented

## Immediate Focus
Module 2 implementation in `model/`:
1. Directory scaffold (`architectures/`, `train/`, `inference/`, `eval/`, `configs/`)
2. RawNet2 or AASIST architecture definition
3. ECAPA-TDNN integration via SpeechBrain
4. Training loop with EER evaluation
5. ONNX export pipeline

## Dependencies on Other Modules
- Blocked on `ingestion/` (Trisha) for normalized audio tensor format spec
- Blocked on `datasets/` (Harsh) for ASVspoof split manifests
- `backend/` (Atharv) needs ONNX artifacts + input/output node name docs

## Open Questions
- Anti-spoofing model choice: RawNet2 vs AASIST (or ensemble)?
- Single ONNX file or separate files per head?
- Streaming inference segment length agreed with ingestion/?
