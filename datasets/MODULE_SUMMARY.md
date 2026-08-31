# Module: Datasets & Evaluation — Development Summary
**Owner:** Harsh | **Project:** VeriVox (SIH26104)

---

## What This Module Does

The **Datasets & Evaluation** module is responsible for the data lifecycle, realistic audio augmentation, partition integrity, and model robustness benchmarking of the VeriVox platform:

| Capability | Scope | Deliverable |
|---|---|---|
| **ASVspoof Protocol Ingestion** | ASVspoof 2019 LA, 2021 LA/DF & In-The-Wild manifest generation | `datasets/protocols.py`, `datasets/manifests/` |
| **Offline Codec Augmentation** | Opus, G.711 (μ-law/A-law), AAC, AMR-NB/WB, GSM, Gilbert-Elliott Packet Loss | `datasets/augmentation/` |
| **Speaker-Disjoint Splitting** | Strict zero-leakage speaker partitioning & validation | `datasets/splits/` |
| **Adversarial Evaluation & Reporting** | EER, min t-DCF, FAR/FRR calibration, stress tests, markdown & JSON reporting | `datasets/evaluation/` |

---

## Directory Layout

```
datasets/
├── README.md                           — Module documentation & quickstart
├── MODULE_SUMMARY.md                   — Comprehensive engineering summary (this file)
├── EER_FAR_REPORT.md                   — Automated EER/FAR benchmark report
├── evaluation_report.json              — JSON metric export for CI & frontend ingestion
├── protocols.py                        — ASVspoof 2019/2021 protocol parsers
├── generate_benchmark_data.py          — Multi-speaker synthetic benchmark data generator
├── manifests/                          — Ready-to-use CSV manifests for model training & evaluation
│   ├── asvspoof2019_la_train.csv       — Train split (seen attacks A01–A06)
│   ├── asvspoof2019_la_val.csv         — Validation split (seen attacks)
│   ├── asvspoof2019_la_eval.csv        — Evaluation split (seen + unseen attacks A07–A09)
│   ├── asvspoof2021_la_eval.csv        — 2021 evaluation split
│   ├── codec_augmented_train.csv       — Augmented training set (mixed clean + codecs)
│   └── codec_augmented_val.csv         — Augmented validation set
├── augmentation/                       — Codec & channel impairment pipeline
│   ├── codecs.py                       — G.711, Opus, AAC, AMR, GSM transforms
│   ├── channel_impairments.py          — Packet loss (Gilbert-Elliott), jitter, SNR noise, RIR
│   └── pipeline.py                     — CodecAugmentationPipeline & offline batch CLI
├── splits/                             — Speaker partitioning & audit tools
│   ├── speaker_disjoint.py             — Zero-leakage speaker partitioning algorithm
│   └── verify_splits.py                — Split integrity & speaker leakage auditor
├── evaluation/                         — Anti-spoofing benchmarking & adversarial suite
│   ├── metrics.py                      — EER, min t-DCF, FAR/FRR curves, operational thresholds
│   ├── adversarial.py                  — AdversarialTester across 14 stress conditions
│   └── report_generator.py             — Automated benchmarking harness & CLI
├── processed/                          — Audio assets and active training manifests
│   ├── train.csv                       — Direct target for model/training/train.py
│   ├── val.csv                         — Direct target for model/training/train.py
│   ├── benchmark_audio/                — 140 multi-speaker synthetic audio clips
│   └── augmented_audio/                — Offline augmented audio clips
└── tests/                              — Comprehensive unit & integration test suite
    └── test_datasets.py
```

---

## Step-by-Step Development Log

### Step 1 — ASVspoof 2019/2021 Protocol Parser & Manifests (`datasets/protocols.py`)
Built parsers for ASVspoof 2019 LA and 2021 LA/DF protocol formats:
- Protocol format: `[speaker_id, audio_filename, -, system_id, key]`
- Supports relative & absolute path resolution with file extension handling (`.flac`, `.wav`).
- Generates standard CSV manifests compatible with Durva's `SpoofDataset` (`filepath,label`) as well as rich diagnostics (`speaker_id,system_id,attack_type,subset,duration_s,key`).

### Step 2 — Offline Codec-Augmentation Pipeline (`datasets/augmentation/`)
Built an offline augmentation pipeline supporting telephony and VoIP codecs without requiring external binary dependencies:
- **ITU-T G.711 μ-law & A-law**: 8 kHz companding, logarithmic quantization, anti-aliasing lowpass filtering.
- **Opus VoIP Simulation**: Bitrate bandwidth modes (Fullband, Wideband, Narrowband), subband MDCT quantization, frame loss simulation.
- **AAC / MP3**: MDCT lossy quantization and psychoacoustic spectral masking.
- **AMR-NB / AMR-WB**: Cellular LPC compression across 8 kHz and 16 kHz.
- **GSM-FR**: 2G mobile standard simulation with harmonic saturation.
- **Gilbert-Elliott Packet Loss**: 2-state Markov model for realistic burst packet loss (5% to 30%) with Packet Loss Concealment (PLC).
- **SNR-Controlled Noise**: Calibrated additive noise (White, Pink, Babble, Street) at exact SNRs.
- **Room Impulse Response (RIR)**: Synthetic room reverberation simulating physical replay attack channels.

### Step 3 — Speaker-Disjoint Partitioning & Auditor (`datasets/splits/`)
Built strict speaker-level partitioning:
- Guarantees $Train \cap Val = \emptyset$, $Train \cap Test = \emptyset$, $Val \cap Test = \emptyset$.
- Stratified bonafide vs spoof balancing across splits.
- Segregates seen attacks (A01–A06 in Train/Val) and unseen attacks (A07–A19 in Test/Eval) to measure generalization.
- Verification auditor (`verify_splits.py`) asserts zero speaker leakage and validates audio existence.

### Step 4 — Adversarial Testing & EER/FAR Report Generator (`datasets/evaluation/`)
Built complete benchmarking suite:
- **Metrics**: Exact EER, ASVspoof min t-DCF, AUC-ROC, FAR@1%FRR, FRR@1%FAR.
- **Adversarial Suite**: Evaluates model performance across 14 stress conditions.
- **Reporting**: Generates `datasets/EER_FAR_REPORT.md` and `datasets/evaluation_report.json`.

---

## Integration with Other Modules

1. **Module 2 (Durva - DL Engine)**:
   - Durva can run training immediately with `train.csv` / `val.csv` or `datasets/manifests/asvspoof2019_la_train.csv`.
   - Codec-augmented training is available at `datasets/manifests/codec_augmented_train.csv`.
2. **Module 3 + 5 (Atharv - Backend & Risk Scoring)**:
   - Operational threshold `0.75` for speaker similarity and calibrated EER threshold for anti-spoofing.
   - `evaluation_report.json` provides metrics for API health and dashboard consumption.
3. **Module 4 (Shweta - SOC UI Console)**:
   - Attack breakdown and metrics feed live into SOC dashboard risk cards.
