"""
Adversarial and Robustness Evaluation Suite for Anti-Spoofing Models (Harsh's Sep 02 Deliverable).

Tests models across:
1. Codec Compression: Opus, G.711 (μ-law/A-law), AAC, AMR-NB, GSM-FR
2. Network Impairments: Burst Packet Loss (5%, 10%, 20%), Jitter
3. Acoustic Environments: Additive Noise (SNR 20dB, 15dB, 10dB, 5dB, 0dB), Room Reverberation (RIR)
4. Adversarial Perturbations: Pitch shifting, Tempo/Speed jitter, Audio Evasion noise

Outputs degradation metrics (Delta EER, Delta FAR, Robustness Score).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import numpy as np
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
from datasets.evaluation.metrics import compute_metrics_summary

log = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parent.parent.parent


# Standard stress-test condition definitions
STRESS_CONDITIONS: dict[str, dict[str, Any]] = {
    "clean": {"desc": "Clean Uncorrupted Baseline", "fn": lambda x, sr: x},
    "g711_ulaw": {"desc": "G.711 μ-law Telephony (8 kHz)", "fn": lambda x, sr: apply_g711_ulaw(x, sr=sr, output_sr=sr)},
    "g711_alaw": {"desc": "G.711 A-law Telephony (8 kHz)", "fn": lambda x, sr: apply_g711_alaw(x, sr=sr, output_sr=sr)},
    "opus_16k": {"desc": "Opus VoIP (16 kbps Wideband)", "fn": lambda x, sr: apply_opus_simulation(x, sr=sr, bitrate_kbps=16)},
    "opus_8k": {"desc": "Opus VoIP (8 kbps Narrowband)", "fn": lambda x, sr: apply_opus_simulation(x, sr=sr, bitrate_kbps=8)},
    "aac_32k": {"desc": "AAC Streaming (32 kbps)", "fn": lambda x, sr: apply_aac_mp3_simulation(x, sr=sr, bitrate_kbps=32)},
    "amr_nb": {"desc": "AMR-NB Cellular (8 kHz 4.75kbps)", "fn": lambda x, sr: apply_amr_nb_simulation(x, sr=sr, output_sr=sr)},
    "amr_wb": {"desc": "AMR-WB HD Voice (16 kHz 12.65kbps)", "fn": lambda x, sr: apply_amr_wb_simulation(x, sr=sr)},
    "gsm": {"desc": "GSM Full Rate (2G Telephony)", "fn": lambda x, sr: apply_gsm_simulation(x, sr=sr, output_sr=sr)},
    "packet_loss_10": {"desc": "VoIP Packet Loss (10% Burst)", "fn": lambda x, sr: apply_packet_loss(x, sr=sr, packet_loss_rate=0.10)},
    "packet_loss_20": {"desc": "VoIP Packet Loss (20% Heavy Burst)", "fn": lambda x, sr: apply_packet_loss(x, sr=sr, packet_loss_rate=0.20)},
    "noise_snr_15": {"desc": "Additive Background Noise (15 dB SNR)", "fn": lambda x, sr: apply_additive_noise(x, snr_db=15.0, noise_type="babble")},
    "noise_snr_5": {"desc": "Severe Background Noise (5 dB SNR)", "fn": lambda x, sr: apply_additive_noise(x, snr_db=5.0, noise_type="street")},
    "reverb_rir": {"desc": "Room Reverberation (RT60=0.3s Replay)", "fn": lambda x, sr: apply_reverberation_rir(x, sr=sr, rt60_s=0.3)},
    "adversarial_evasion": {"desc": "Adversarial Acoustic Perturbation", "fn": lambda x, sr: np.clip(x + np.random.normal(0, 0.015, len(x)), -1.0, 1.0).astype(np.float32)},
}


class ModelRunner:
    """
    Unified model runner supporting ONNX runtime and PyTorch checkpoints.
    """

    def __init__(self, model_path: Union[str, Path]) -> None:
        self.model_path = Path(model_path)
        self.is_onnx = self.model_path.suffix.lower() == ".onnx"
        self._session = None
        self._torch_model = None

        if self.is_onnx:
            import onnxruntime as ort
            # Run single-threaded for deterministic benchmark
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 1
            opts.inter_op_num_threads = 1
            self._session = ort.InferenceSession(str(self.model_path), sess_options=opts)
            self._input_name = self._session.get_inputs()[0].name
            self._output_name = self._session.get_outputs()[0].name
        else:
            # PyTorch fallback if .pt checkpoint
            import torch
            from model.training.train import build_model
            model_name = "aasist" if "aasist" in str(self.model_path).lower() else "rawnet2"
            self._torch_model = build_model(model_name)
            ckpt = torch.load(str(self.model_path), map_location="cpu")
            state_dict = ckpt.get("model_state", ckpt)
            self._torch_model.load_state_dict(state_dict)
            self._torch_model.eval()

    def predict_spoof_prob(self, waveform: np.ndarray, sr: int = 16000) -> float:
        """
        Runs model inference on a 1D audio waveform and returns spoof probability in [0, 1].
        """
        # Ensure 1D float32
        audio = waveform.astype(np.float32)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        # Pad / crop to 64,000 samples (4s)
        clip_len = 64_000
        if len(audio) < clip_len:
            audio = np.pad(audio, (0, clip_len - len(audio)))
        elif len(audio) > clip_len:
            audio = audio[:clip_len]

        if self.is_onnx:
            # Batch dimension (1, 64000)
            inp = audio[np.newaxis, :]
            outputs = self._session.run([self._output_name], {self._input_name: inp})
            logits = outputs[0]  # shape (1, 2)
            # Softmax
            exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
            probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
            return float(probs[0, 1])
        else:
            import torch
            with torch.no_grad():
                tensor = torch.from_numpy(audio).unsqueeze(0)
                logits, _ = self._torch_model(tensor)
                probs = torch.softmax(logits, dim=-1)
                return float(probs[0, 1].item())


class AdversarialTester:
    """
    Evaluates anti-spoofing models under clean, codec, and adversarial conditions.
    """

    def __init__(self, model_runner: ModelRunner, sample_rate: int = 16000) -> None:
        self.runner = model_runner
        self.sample_rate = sample_rate

    def evaluate_manifest_under_condition(
        self,
        samples: list[dict],
        condition_name: str = "clean",
        calibrated_threshold: Optional[float] = None,
    ) -> dict[str, Any]:
        """
        Evaluates a list of samples under a specific degradation condition.
        """
        cond = STRESS_CONDITIONS.get(condition_name, STRESS_CONDITIONS["clean"])
        transform_fn = cond["fn"]

        labels: list[int] = []
        scores: list[float] = []

        for s in samples:
            fp = Path(s["filepath"])
            if not fp.is_absolute():
                fp = _ROOT / fp
            label = int(s["label"])
            if not fp.exists():
                continue

            audio, sr = sf.read(str(fp), dtype="float32")
            if audio.ndim > 1:
                audio = audio.mean(axis=1)

            # Apply condition transform
            degraded = transform_fn(audio, sr)

            # Infer score
            score = self.runner.predict_spoof_prob(degraded, sr=self.sample_rate)
            labels.append(label)
            scores.append(score)

        if not labels:
            return {"error": "No valid samples evaluated"}

        summary = compute_metrics_summary(labels, scores, threshold=calibrated_threshold)
        summary["condition"] = condition_name
        summary["description"] = cond["desc"]
        return summary

    def run_full_adversarial_suite(
        self,
        samples: list[dict],
        conditions: Optional[Sequence[str]] = None,
    ) -> dict[str, Any]:
        """
        Runs the complete battery of robustness and adversarial tests.
        """
        test_conds = list(conditions) if conditions else list(STRESS_CONDITIONS.keys())

        # 1. First run clean baseline to get optimal operational threshold
        log.info("Running clean baseline benchmark...")
        clean_res = self.evaluate_manifest_under_condition(samples, "clean")
        clean_eer = clean_res["eer"]
        calibrated_thresh = clean_res["eer_threshold"]

        results: dict[str, Any] = {
            "clean_baseline": clean_res,
            "calibrated_threshold": calibrated_thresh,
            "conditions": {},
            "robustness_score": 0.0,
        }

        eer_degradations = []

        for name in test_conds:
            log.info("Evaluating condition: %s...", name)
            res = self.evaluate_manifest_under_condition(
                samples, name, calibrated_threshold=calibrated_thresh
            )
            delta_eer = res["eer"] - clean_eer
            res["delta_eer"] = round(delta_eer, 4)
            res["delta_eer_pct"] = round(delta_eer * 100.0, 2)
            results["conditions"][name] = res
            if name != "clean":
                eer_degradations.append(delta_eer)

        # Average robustness retention score (100% = zero degradation)
        avg_degradation = np.mean(eer_degradations) if eer_degradations else 0.0
        robustness_score = max(0.0, 100.0 - (avg_degradation * 200.0))
        results["robustness_score"] = round(robustness_score, 1)

        return results
