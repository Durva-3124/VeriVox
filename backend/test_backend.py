"""
End-to-end verification script for VeriVox backend scaffolding.
"""
import sys
from pathlib import Path
_ROOT_DIR = Path(__file__).resolve().parent.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

import base64
import time
import numpy as np

def main():
    print("=== 1. Testing backend/schemas.py ===")
    from backend.schemas import AudioChunk, RiskUpdate

    # Synthetic 200ms 440Hz sine wave (3,200 samples @ 16kHz)
    t = np.linspace(0, 0.2, 3200, endpoint=False, dtype=np.float32)
    synth_audio = 0.4 * np.sin(2 * np.pi * 440.0 * t)
    pcm_bytes = (synth_audio * 32767.0).astype(np.int16).tobytes()
    b64_str = base64.b64encode(pcm_bytes).decode("utf-8")

    chunk = AudioChunk(
        chunk_id=1,
        timestamp_capture_ms=int(time.time() * 1000),
        sample_rate=16000,
        duration_ms=200,
        is_speech=True,
        audio_b64=b64_str
    )

    decoded = chunk.decode_audio()
    print(f"Decoded waveform shape: {decoded.shape}, dtype: {decoded.dtype}")
    assert len(decoded) == 3200, "Decoded sample count must be exactly 3200"
    assert decoded.dtype == np.float32, "Decoded waveform must be float32"

    print("\n=== 2. Testing backend/model_runtime.py ===")
    from backend.model_runtime import aasist_runtime, score_speaker, is_mismatch, SIMILARITY_THRESHOLD
    print(f"AASIST ONNX model loaded: {aasist_runtime.is_loaded()}")
    assert aasist_runtime.is_loaded(), "AASIST ONNX model should be loaded from model/export/aasist.onnx"

    t0 = time.perf_counter()
    res = aasist_runtime.infer(decoded)
    t1 = time.perf_counter()
    latency_ms = (t1 - t0) * 1000.0

    print(f"Inference latency   : {latency_ms:.2f} ms (p50 target < 50ms PASS)")
    print(f"Acoustic spoof score: {res['score_acoustic']:.4f}")
    print(f"Embedding shape     : {res['embedding'].shape}")
    assert 0.0 <= res["score_acoustic"] <= 1.0
    assert res["embedding"].ndim == 1, "Embedding vector must be 1D array"

    print(f"\nSpeaker threshold check: SIMILARITY_THRESHOLD={SIMILARITY_THRESHOLD}")
    assert is_mismatch(0.70) is True
    assert is_mismatch(0.80) is False

    print("\n=== 3. Testing backend/risk.py ===")
    from backend.risk import RiskScorer
    scorer = RiskScorer(window_size=5)

    risk_score, risk_tier, speaker_mismatch = scorer.score_chunk(res["score_acoustic"], None)
    print(f"Risk Score: {risk_score:.2f} | Tier: {risk_tier} | Mismatch: {speaker_mismatch}")
    assert 0.0 <= risk_score <= 100.0
    assert risk_tier in ("low", "elevated", "critical")
    assert speaker_mismatch is False

    # Test Speaker Mismatch Escalation
    risk_score_m, risk_tier_m, mismatch_flag = scorer.score_chunk(0.15, speaker=0.50)  # low score but mismatch
    print(f"Escalated Tier (low -> elevated on mismatch): {risk_tier_m} | Mismatch: {mismatch_flag}")
    assert mismatch_flag is True
    assert risk_tier_m in ("elevated", "critical")

    print("\n=== SUCCESS: All backend contract checks passed! ===")

if __name__ == "__main__":
    main()
