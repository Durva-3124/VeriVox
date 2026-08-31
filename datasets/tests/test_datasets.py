"""
Unit and Integration Tests for Datasets & Evaluation Module (Harsh's Test Suite).
"""

from __future__ import annotations

import csv
import tempfile
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from datasets.augmentation.channel_impairments import (
    apply_additive_noise,
    apply_network_jitter,
    apply_packet_loss,
    apply_reverberation_rir,
)
from datasets.augmentation.codecs import (
    apply_aac_mp3_simulation,
    apply_amr_nb_simulation,
    apply_amr_wb_simulation,
    apply_g711_alaw,
    apply_g711_ulaw,
    apply_gsm_simulation,
    apply_opus_simulation,
)
from datasets.augmentation.pipeline import CodecAugmentationPipeline
from datasets.evaluation.adversarial import ModelRunner
from datasets.evaluation.metrics import (
    compute_eer,
    compute_metrics_summary,
    compute_min_tdcf,
)
from datasets.protocols import ASVspoofProtocolParser, AudioSampleMeta
from datasets.splits.speaker_disjoint import (
    partition_speakers_disjoint,
    write_split_csvs,
)
from datasets.splits.verify_splits import audit_splits


@pytest.fixture
def dummy_audio_clip() -> tuple[np.ndarray, int]:
    """Generates a 1-second 16kHz sine wave test clip."""
    sr = 16000
    t = np.linspace(0, 1.0, sr, endpoint=False, dtype=np.float32)
    sine = 0.4 * np.sin(2 * np.pi * 440.0 * t)
    return sine, sr


# ===========================================================================
# 1. Protocols & Manifest Tests
# ===========================================================================

def test_audio_sample_meta():
    sample = AudioSampleMeta(
        filepath="dummy.wav",
        label=0,
        speaker_id="LA_0001",
        system_id="-",
        attack_type="bonafide",
        duration_s=4.0,
        sample_rate=16000,
        key="bonafide",
    )
    min_dict = sample.to_minimal_dict()
    assert min_dict == {"filepath": "dummy.wav", "label": 0}

    ext_dict = sample.to_extended_dict()
    assert ext_dict["speaker_id"] == "LA_0001"
    assert ext_dict["label"] == 0


def test_write_and_read_manifest(tmp_path):
    out_csv = tmp_path / "test_manifest.csv"
    samples = [
        AudioSampleMeta("a.wav", 0, "spk1"),
        AudioSampleMeta("b.wav", 1, "spk2"),
    ]
    ASVspoofProtocolParser.write_csv_manifest(samples, out_csv, extended=False)
    assert out_csv.exists()

    rows = ASVspoofProtocolParser.read_csv_manifest(out_csv)
    assert len(rows) == 2
    assert rows[0]["filepath"] == "a.wav"
    assert int(rows[0]["label"]) == 0
    assert rows[1]["filepath"] == "b.wav"
    assert int(rows[1]["label"]) == 1


# ===========================================================================
# 2. Codecs & Channel Impairments Tests
# ===========================================================================

def test_g711_codecs(dummy_audio_clip):
    audio, sr = dummy_audio_clip
    ulaw = apply_g711_ulaw(audio, sr=sr, output_sr=sr)
    alaw = apply_g711_alaw(audio, sr=sr, output_sr=sr)

    assert len(ulaw) == len(audio)
    assert len(alaw) == len(audio)
    assert ulaw.dtype == np.float32
    assert alaw.dtype == np.float32
    assert not np.isnan(ulaw).any()
    assert not np.isnan(alaw).any()


def test_opus_aac_amr_codecs(dummy_audio_clip):
    audio, sr = dummy_audio_clip
    opus = apply_opus_simulation(audio, sr=sr, bitrate_kbps=16)
    aac = apply_aac_mp3_simulation(audio, sr=sr, bitrate_kbps=32)
    amr = apply_amr_nb_simulation(audio, sr=sr, output_sr=sr)
    gsm = apply_gsm_simulation(audio, sr=sr, output_sr=sr)

    assert len(opus) == len(audio)
    assert len(aac) == len(audio)
    assert len(amr) == len(audio)
    assert len(gsm) == len(audio)
    assert not np.isnan(opus).any()
    assert not np.isnan(aac).any()


def test_packet_loss_and_noise(dummy_audio_clip):
    audio, sr = dummy_audio_clip
    pl_zero = apply_packet_loss(audio, sr=sr, packet_loss_rate=0.20, plc_mode="zero")
    pl_interp = apply_packet_loss(audio, sr=sr, packet_loss_rate=0.20, plc_mode="interp")
    noisy = apply_additive_noise(audio, snr_db=15.0, noise_type="white")
    reverbed = apply_reverberation_rir(audio, sr=sr, rt60_s=0.2)

    assert len(pl_zero) == len(audio)
    assert len(pl_interp) == len(audio)
    assert len(noisy) == len(audio)
    assert len(reverbed) == len(audio)
    assert not np.isnan(pl_zero).any()
    assert not np.isnan(noisy).any()


# ===========================================================================
# 3. Speaker-Disjoint Splitting & Audit Tests
# ===========================================================================

def test_speaker_disjoint_splits():
    # 6 speakers, 4 samples each
    samples = []
    for spk_idx in range(6):
        spk = f"SPK_{spk_idx:02d}"
        for i in range(4):
            samples.append(
                {
                    "filepath": f"{spk}_{i}.wav",
                    "label": i % 2,
                    "speaker_id": spk,
                    "system_id": "A01" if (i % 2 == 1) else "-",
                }
            )

    train_s, val_s, test_s = partition_speakers_disjoint(
        samples, split_ratios=(0.60, 0.20, 0.20), seed=42
    )

    train_spks = {s["speaker_id"] for s in train_s}
    val_spks = {s["speaker_id"] for s in val_s}
    test_spks = {s["speaker_id"] for s in test_s}

    assert len(train_spks & val_spks) == 0, "Leakage between Train and Val"
    assert len(train_spks & test_spks) == 0, "Leakage between Train and Test"
    assert len(val_spks & test_spks) == 0, "Leakage between Val and Test"
    assert len(train_s) + len(val_s) + len(test_s) == len(samples)


# ===========================================================================
# 4. Evaluation Metrics Tests
# ===========================================================================

def test_compute_eer_perfect():
    labels = np.array([0, 0, 0, 0, 1, 1, 1, 1])
    scores = np.array([0.1, 0.2, 0.15, 0.25, 0.8, 0.85, 0.9, 0.95])
    eer, thresh = compute_eer(labels, scores)
    assert eer == 0.0
    assert 0.25 <= thresh <= 0.8


def test_compute_metrics_summary():
    labels = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
    scores = [0.1, 0.2, 0.3, 0.7, 0.2, 0.8, 0.9, 0.85, 0.4, 0.95]
    summary = compute_metrics_summary(labels, scores)

    assert "eer" in summary
    assert "min_tdcf" in summary
    assert "accuracy" in summary
    assert "auc_roc" in summary
    assert 0.0 <= summary["eer"] <= 1.0
    assert summary["total_samples"] == 10


# ===========================================================================
# 5. Model Runner (AASIST ONNX) Test
# ===========================================================================

def test_aasist_onnx_model_runner(dummy_audio_clip):
    onnx_path = Path("model/export/aasist.onnx")
    if not onnx_path.exists():
        pytest.skip("AASIST ONNX model not exported yet")

    audio, sr = dummy_audio_clip
    runner = ModelRunner(onnx_path)
    prob = runner.predict_spoof_prob(audio, sr=sr)
    assert isinstance(prob, float)
    assert 0.0 <= prob <= 1.0


# ===========================================================================
# 6. Manifest Path Portability & Split Auditing Tests
# ===========================================================================

def test_manifest_csvs_use_relative_paths():
    repo_root = Path(__file__).resolve().parent.parent.parent
    manifest_dirs = [
        repo_root / "datasets" / "manifests",
        repo_root / "datasets" / "processed",
    ]
    csv_files = []
    for d in manifest_dirs:
        if d.exists():
            csv_files.extend(list(d.glob("*.csv")))

    assert len(csv_files) > 0, "No manifest CSVs found to test"
    for csv_file in csv_files:
        with open(csv_file, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row_idx, row in enumerate(reader):
                fp = row.get("filepath", "")
                assert fp, f"Row {row_idx} in {csv_file.name} missing filepath"
                assert not Path(fp).is_absolute(), (
                    f"Found absolute path '{fp}' in {csv_file.relative_to(repo_root)}"
                )
                assert "HARSH" not in fp, f"Found hardcoded user path '{fp}' in {csv_file.name}"
                # If audio directory exists locally, verify file existence
                resolved_file = repo_root / fp
                if resolved_file.parent.exists():
                    assert resolved_file.exists(), (
                        f"Referenced audio file '{fp}' in {csv_file.name} does not exist at {resolved_file}"
                    )


def test_audit_splits_with_relative_paths():
    repo_root = Path(__file__).resolve().parent.parent.parent
    train_csv = repo_root / "datasets" / "manifests" / "asvspoof2019_la_train.csv"
    val_csv = repo_root / "datasets" / "manifests" / "asvspoof2019_la_val.csv"
    eval_csv = repo_root / "datasets" / "manifests" / "asvspoof2019_la_eval.csv"

    if train_csv.exists() and val_csv.exists():
        summary = audit_splits(train_csv, val_csv, eval_csv, check_audio_files=True)
        assert summary["status"] == "PASSED"
        assert summary["missing_files_count"] == 0
        assert summary["speaker_disjoint"] is True


def test_spoof_dataset_path_resolution(tmp_path):
    repo_root = Path(__file__).resolve().parent.parent.parent
    csv_rel = tmp_path / "rel.csv"
    with open(csv_rel, "w", newline="", encoding="utf-8") as f:
        f.write("filepath,label\ndatasets/processed/benchmark_audio/LA_0005_000_bonafide.wav,0\n")

    csv_abs = tmp_path / "foreign_abs.csv"
    with open(csv_abs, "w", newline="", encoding="utf-8") as f:
        f.write("filepath,label\nC:\\Users\\OtherUser\\Desktop\\VeriVox\\datasets\\processed\\benchmark_audio\\LA_0005_000_bonafide.wav,0\n")

    try:
        from model.training.train import SpoofDataset
        ds_rel = SpoofDataset(csv_rel, base_dir=repo_root)
        assert len(ds_rel) == 1
        expected_path = str(repo_root / "datasets/processed/benchmark_audio/LA_0005_000_bonafide.wav")
        assert ds_rel.samples[0][0] == expected_path

        ds_abs = SpoofDataset(csv_abs, base_dir=repo_root)
        assert len(ds_abs) == 1
        assert ds_abs.samples[0][0] == expected_path
    except ImportError:
        pass
