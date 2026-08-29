# VeriVox

VeriVox is a voice anti-spoofing and speaker verification platform designed to detect synthetic or replayed speech and score trust in real-time audio workflows.

## Repository layout

- `ingestion/` — windowing, VAD, codec normalization
- `datasets/` — ASVspoof / in-the-wild datasets, augmentation, splits
- `model/` — RawNet2 / AASIST and speaker embedding models
- `backend/` — FastAPI risk scoring, policy, API, SDK
- `frontend/` — React SOC console and demo scenarios
- `docs/` — architecture, pitch, evaluation docs
- `deployment/` — Docker and environment deployment assets

## Getting started

1. Use the project Node version from `.nvmrc`.
2. Set up the Python environment for ingestion/model tasks.
3. Run the backend and frontend apps from their respective folders.

## Notes

This repository is intentionally organized by responsibility so the ML pipeline, API layer, and operator interface remain modular and easy to develop independently.

VeriVox/
├── README.md, .gitignore, .nvmrc
├── ingestion/     — Trisha  (Module 1: windowing, VAD, codec normalization)
├── datasets/      — Harsh   (ASVspoof/In-the-Wild, codec augmentation, splits)
├── model/         — Durva   (RawNet2/AASIST + speaker-verification embeddings)
├── backend/       — Atharv  (FastAPI risk-scoring, policy, API, SDK)
├── frontend/      — Shweta  (React SOC console, demo scenarios)
├── docs/          — Rutuja  (architecture, pitch, evaluation)
└── deployment/    — Atharv  (docker-compose, env templates)
