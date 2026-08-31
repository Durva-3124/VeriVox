"""
AASIST ONNX Model Runtime for VeriVox (Module 3).

Loads model/export/aasist.onnx via onnxruntime for real-time streaming inference.
Imports and reuses speaker verification utilities from model/speaker_verification.py.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any, Dict, Optional
import numpy as np
import onnxruntime as ort

# Ensure workspace root is on sys.path for model module imports
_ROOT_DIR = Path(__file__).resolve().parent.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

log = logging.getLogger("verivox.model_runtime")

try:
    from model.speaker_verification import score_speaker, is_mismatch, SIMILARITY_THRESHOLD
except ImportError:
    log.warning("PyTorch not found; using NumPy fallback for model.speaker_verification contract helpers.")
    SIMILARITY_THRESHOLD: float = 0.75

    def is_mismatch(score: float) -> bool:
        return score < SIMILARITY_THRESHOLD

    def score_speaker(live_embedding: Any, enrolled_embedding: Any) -> float:
        live = np.asarray(live_embedding, dtype=np.float32).flatten()
        enrl = np.asarray(enrolled_embedding, dtype=np.float32).flatten()
        norm_l = np.linalg.norm(live)
        norm_e = np.linalg.norm(enrl)
        if norm_l == 0 or norm_e == 0:
            return 0.5
        cosine = float(np.dot(live, enrl) / (norm_l * norm_e + 1e-10))
        return (cosine + 1.0) / 2.0


_MODEL_PATH = _ROOT_DIR / "model" / "export" / "aasist.onnx"


class AasistRuntime:
    """
    Singleton wrapper for AASIST ONNX model inference.
    Executes onnxruntime single-threaded to match 14ms p50 benchmark conditions.
    """

    def __init__(self, model_path: Path = _MODEL_PATH) -> None:
        self.model_path = Path(model_path)
        self.session: Optional[ort.InferenceSession] = None
        self._load_model()

    def _load_model(self) -> None:
        """Loads the ONNX session if model file exists locally; logs warning otherwise."""
        if not self.model_path.exists():
            log.warning(
                "AASIST ONNX model missing at %s. "
                "Inference calls will fail until the checkpoint is exported.",
                self.model_path
            )
            return

        try:
            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 1
            sess_options.inter_op_num_threads = 1
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            self.session = ort.InferenceSession(
                str(self.model_path),
                sess_options=sess_options,
                providers=["CPUExecutionProvider"]
            )
            log.info("Successfully loaded AASIST ONNX model from %s (single-threaded CPU)", self.model_path.name)
        except Exception as e:
            log.error("Failed to load AASIST ONNX model session from %s: %s", self.model_path, e)
            self.session = None

    def is_loaded(self) -> bool:
        """Returns True if the ONNX session is loaded and ready for inference."""
        return self.session is not None

    def infer(self, waveform: np.ndarray) -> Dict[str, Any]:
        """
        Runs AASIST ONNX model inference on a single 1D float32 audio waveform.

        Args:
            waveform: 1D float32 numpy array, shape (T,) e.g. (3200,) for 200ms @ 16kHz.

        Returns:
            {
                "score_acoustic": float in [0.0, 1.0] (class 1 = spoof probability),
                "embedding": 1D float32 numpy array, shape (128,)
            }

        Raises:
            RuntimeError: if ONNX model session is not loaded.
        """
        if self.session is None:
            # Retry loading in case file was exported after startup
            self._load_model()
            if self.session is None:
                raise RuntimeError(
                    f"AASIST ONNX model session is not available at {self.model_path}. "
                    "Ensure model/export/aasist.onnx exists."
                )

        wav = np.asarray(waveform, dtype=np.float32)
        if wav.ndim == 1:
            wav = np.expand_dims(wav, axis=0)  # (1, T)

        # ONNX input node contract: "waveform" shape (batch, time)
        inputs = {"waveform": wav}
        outputs = self.session.run(None, inputs)

        # Output nodes: "logits" shape (1, 2), "embedding" shape (1, 128)
        logits = outputs[0]
        embedding = outputs[1]

        # Apply softmax to logits over class dimension
        exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
        probs = exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)
        score_acoustic = float(probs[0, 1])  # index 1 = spoof probability

        emb_1d = np.squeeze(embedding).astype(np.float32)

        return {
            "score_acoustic": score_acoustic,
            "embedding": emb_1d
        }


# Global singleton instance
aasist_runtime = AasistRuntime()

__all__ = ["aasist_runtime", "AasistRuntime", "score_speaker", "is_mismatch", "SIMILARITY_THRESHOLD"]
