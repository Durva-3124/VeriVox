# Datasets & Evaluation Module

**Owner:** Harsh | **Module:** Datasets & Evaluation (Role 2) | **Project:** VeriVox (SIH26104)

---

## Overview

The `datasets/` module provides data engineering, realistic telephony/VoIP codec augmentation, speaker-disjoint splitting, adversarial stress testing, and equal error rate (EER) benchmarking for the VeriVox voice security platform.

---

## Features

1. **Protocol Parsing & Manifests (`datasets/protocols.py`)**
   - Ingests ASVspoof 2019 LA, ASVspoof 2021 LA/DF, and in-the-wild manifests.
   - Exports minimal manifests (`filepath,label`) compatible with `model/training/train.py` (`SpoofDataset`) and extended manifests with speaker IDs, attack types, and duration metadata.

2. **Offline Codec-Augmentation Pipeline (`datasets/augmentation/`)**
   - Simulates real-world telephony and network transmission artifacts:
     - **G.711 μ-law & A-law** (ITU-T standard 8 kHz companding)
     - **Opus VoIP** (SILK/CELT subband compression, MDCT quantization, bandwidth modes)
     - **AAC / MP3** (Psychoacoustic subband thresholding & scalefactor quantization)
     - **AMR-NB & AMR-WB** (Narrowband 8 kHz & Wideband 16 kHz cellular standard)
     - **GSM Full Rate** (2G mobile telephony simulation)
     - **Gilbert-Elliott Burst Packet Loss** (2-state Markov model with PLC zero-fill)
     - **Controlled SNR Noise** (White, Pink, Babble, Street)
     - **Room Impulse Response (RIR)** (Acoustic room reverberation for replay attack modeling)
   - 100% pure Python/NumPy/SciPy implementation for zero-dependency portability across Windows/Linux/Docker.

3. **Speaker-Disjoint Dataset Partitioning (`datasets/splits/`)**
   - Enforces strict zero speaker overlap:
     $$\text{Speakers}(Train) \cap \text{Speakers}(Val) = \emptyset$$
     $$\text{Speakers}(Train) \cap \text{Speakers}(Test) = \emptyset$$
     $$\text{Speakers}(Val) \cap \text{Speakers}(Test) = \emptyset$$
   - Stratified bonafide vs spoof class balancing.
   - Segregates seen attacks (A01–A06 in Train/Val) and unseen attacks (A07–A19 in Test/Eval).
   - Audit tool (`verify_splits.py`) verifies zero speaker leakage and audio path integrity.

4. **Adversarial Testing & EER/FAR Reporting (`datasets/evaluation/`)**
   - Computes anti-spoofing metrics: EER, normalized ASVspoof min t-DCF, FAR/FRR curves, AUC-ROC, accuracy, and operational threshold calibration (FAR=1%, FAR=0.1%).
   - Evaluates models across 14 stress conditions.
   - Exports automated reports:
     - Markdown report: `datasets/EER_FAR_REPORT.md`
     - JSON metrics: `datasets/evaluation_report.json`

---

## Directory Structure

```
datasets/
├── README.md                           — This file
├── MODULE_SUMMARY.md                   — Engineering dev summary
├── EER_FAR_REPORT.md                   — Automated benchmark report
├── evaluation_report.json              — JSON metric output
├── protocols.py                        — ASVspoof protocol parsers
├── generate_benchmark_data.py          — Multi-speaker benchmark data generator
├── manifests/                          — Standard CSV manifests
│   ├── asvspoof2019_la_train.csv
│   ├── asvspoof2019_la_val.csv
│   ├── asvspoof2019_la_eval.csv
│   ├── asvspoof2021_la_eval.csv
│   ├── codec_augmented_train.csv
│   └── codec_augmented_val.csv
├── augmentation/                       — Codec transforms & pipeline
│   ├── codecs.py
│   ├── channel_impairments.py
│   └── pipeline.py
├── splits/                             — Speaker partitioning & audit
│   ├── speaker_disjoint.py
│   └── verify_splits.py
├── evaluation/                         — Benchmark engine
│   ├── metrics.py
│   ├── adversarial.py
│   └── report_generator.py
├── processed/                          — Active training data & audio clips
│   ├── train.csv
│   ├── val.csv
│   └── benchmark_audio/
└── tests/                              — Pytest test suite
    └── test_datasets.py
```

---

## Quickstart & CLI Commands

### 1. Generate Benchmark Data & Manifests
```bash
python datasets/generate_benchmark_data.py
```

### 2. Verify Speaker-Disjoint Splits (Audit)
```bash
python datasets/splits/verify_splits.py
```

### 3. Run Offline Codec Augmentation Batch
```bash
python -m datasets.augmentation.pipeline \
    --input_csv datasets/manifests/asvspoof2019_la_train.csv \
    --output_dir datasets/processed/augmented_audio \
    --output_csv datasets/manifests/codec_augmented_train.csv \
    --codecs opus_16k,g711_ulaw,aac_32k,amr_nb,packet_loss_10,noise_snr_15 \
    --augment_prob 1.0
```

### 4. Run Model Evaluation & Generate EER/FAR Report
```bash
python -m datasets.evaluation.report_generator \
    --model model/export/aasist.onnx \
    --eval_csv datasets/manifests/asvspoof2019_la_eval.csv \
    --output_report datasets/EER_FAR_REPORT.md \
    --output_json datasets/evaluation_report.json
```

### 5. Train Anti-Spoofing Model (Durva's Module 2)
```bash
python model/training/train.py \
    --model aasist \
    --train_csv datasets/manifests/asvspoof2019_la_train.csv \
    --val_csv datasets/manifests/asvspoof2019_la_val.csv \
    --epochs 2 --batch_size 4 --num_workers 0
```

### 6. Run Unit Tests
```bash
python -m pytest datasets/tests/test_datasets.py -v
```
