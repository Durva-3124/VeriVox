# VeriVox

[Durva-3124](https://github.com/Durva-3124) / [VeriVox](https://github.com/Durva-3124/VeriVox)

VeriVox is a voice anti-spoofing and speaker verification platform designed to detect synthetic or replayed speech and score trust in real-time audio workflows.

## Repository navigation

- [Code](https://github.com/Durva-3124/VeriVox)
- [Issues](https://github.com/Durva-3124/VeriVox/issues)
- [Pull requests](https://github.com/Durva-3124/VeriVox/pulls)
- [Agents](https://github.com/Durva-3124/VeriVox/agents?author=Durva-3124)
- [Actions](https://github.com/Durva-3124/VeriVox/actions)
- [Projects](https://github.com/Durva-3124/VeriVox/projects)
- [Wiki](https://github.com/Durva-3124/VeriVox/wiki)
- [Security and quality](https://github.com/Durva-3124/VeriVox/security)
- [Insights](https://github.com/Durva-3124/VeriVox/pulse)
- [Settings](https://github.com/Durva-3124/VeriVox/settings)

## Repository layout

```text
VeriVox/
├── README.md, .gitignore, .nvmrc
├── ingestion/     — Trisha  (Module 1: windowing, VAD, codec normalization)
├── datasets/      — Harsh   (ASVspoof/In-the-Wild, codec augmentation, splits)
├── model/         — Durva   (RawNet2/AASIST + speaker-verification embeddings)
├── backend/       — Atharv  (FastAPI risk-scoring, policy, API, SDK)
├── frontend/      — Shweta  (React SOC console, demo scenarios)
├── docs/          — Rutuja  (architecture, pitch, evaluation)
├── deployment/    — Atharv  (docker-compose, env templates)
└── .gitignore, .nvmrc, README.md
```

## Module responsibilities

- `ingestion/` — audio ingestion, framing, VAD, normalization, codec handling
- `datasets/` — dataset ingestion, augmentation, train/val/test splits
- `model/` — anti-spoofing and verification model architecture and checkpoints
- `backend/` — API, scoring logic, policy engine, risk evaluation, SDK exposure
- `frontend/` — SOC UI and operational scenarios for demo and evaluation
- `docs/` — architecture, pitch, evaluation summaries, and technical docs
- `deployment/` — deployment assets, Docker config, and environment templates

## Getting started

1. Use the project Node version from `.nvmrc`.
2. Set up the Python environment for ingestion and model work.
3. Run the backend and frontend apps from their respective directories.
4. Keep the repo modular so ML, API, UI, and deployment concerns remain independent.

## Notes

This repository is intentionally organized by responsibility so the ML pipeline, API layer, and operator interface remain easy to develop and extend independently.

Public repository: [VeriVox](https://github.com/Durva-3124/VeriVox)
