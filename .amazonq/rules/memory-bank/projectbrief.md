# Project Brief — VeriVox (SIH26104)

## What is VeriVox?
Real-time voice-impersonation defense system. Detects synthetic or replayed speech and scores trust in real-time audio workflows.

**Tagline:** Voice anti-spoofing + speaker verification platform.

## Team & Module Map
| Directory | Owner | Module | Responsibility |
|---|---|---|---|
| `ingestion/` | Trisha | Module 1 | Windowing, VAD, codec normalization |
| `datasets/` | Harsh | — | ASVspoof/In-the-Wild, codec augmentation, splits |
| `model/` | **Durva** | **Module 2** | RawNet2/AASIST + speaker-verification embeddings |
| `backend/` | Atharv | — | FastAPI risk-scoring, policy, API, SDK |
| `frontend/` | Shweta | — | React SOC console, demo scenarios |
| `docs/` | Rutuja | — | Architecture, pitch, evaluation |
| `deployment/` | Atharv | — | docker-compose, env templates |

## Module 2 Scope (this repo owner)
- Anti-spoofing model: RawNet2 / AASIST architecture
- Speaker verification: ECAPA-TDNN embeddings (SpeechBrain / resemblyzer)
- Training and inference workflows
- ONNX export for backend consumption
- Evaluation and checkpoint management

## Interfaces
- **Consumes from:** `ingestion/` (normalized audio frames) and `datasets/` (train/val/test splits)
- **Produces for:** `backend/` (ONNX model artifacts + inference API)
