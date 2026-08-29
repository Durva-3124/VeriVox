# Product Context — VeriVox

## Problem
Voice impersonation (TTS synthesis, voice conversion, replay attacks) can bypass voice-based authentication and trust systems. VeriVox defends against this in real time.

## Two-Head Defense Architecture
```
Audio Input (from ingestion/)
        ↓
┌───────────────────────────────────┐
│         model/  (Module 2)        │
│                                   │
│  Head 1: Anti-Spoofing            │
│    RawNet2 or AASIST              │
│    → spoof score (0–1)            │
│                                   │
│  Head 2: Speaker Verification     │
│    ECAPA-TDNN (SpeechBrain)       │
│    → speaker embedding (d-vector) │
│    → cosine similarity score      │
└───────────────────────────────────┘
        ↓
backend/ (FastAPI) — fuses scores into trust verdict
```

## Why These Models?
- **RawNet2** — end-to-end raw waveform anti-spoofing, strong on seen attacks
- **AASIST** — graph-attention anti-spoofing, stronger generalization on unseen attacks
- **ECAPA-TDNN** — SOTA speaker embedding model, available via SpeechBrain

## Real-Time Constraint
- Inference must be fast enough for streaming audio segments
- ONNX export is the delivery format to backend (avoids PyTorch dependency in prod)

## Evaluation Target
- Primary metric: Equal Error Rate (EER) on ASVspoof 2019/2021 LA track
- Secondary: tandem-DCF (t-DCF) combining spoof + verification scores
