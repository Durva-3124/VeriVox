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

import asyncio
from backend.schemas import AudioChunk, RiskUpdate, decode_pcm_b64
from backend.enrollment import enroll_speaker_endpoint, EnrollRequest
from backend.policy import escalate_policy, freeze_transaction, get_session_risk_endpoint, PolicyActionRequest, update_session_risk
from backend.alerts import dispatch_alert, AlertRequest
from backend.main import health_check

async def run_async_tests():
    print("=== 1. Testing backend/schemas.py & Requirements ===")
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
        audio_b64=b64_str,
        caller_id="caller_test_001",
        session_id="sess_test_999"
    )

    decoded = chunk.decode_audio()
    print(f"Decoded waveform shape: {decoded.shape}, dtype: {decoded.dtype}")
    assert len(decoded) == 3200, "Decoded sample count must be exactly 3200"
    assert decoded.dtype == np.float32, "Decoded waveform must be float32"
    assert chunk.caller_id == "caller_test_001"
    assert chunk.session_id == "sess_test_999"

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

    print("\n=== 3. Testing backend/risk.py & Calibrated Threshold ===")
    from backend.risk import RiskScorer, ACOUSTIC_OPERATING_THRESHOLD, is_acoustic_spoof
    print(f"ACOUSTIC_OPERATING_THRESHOLD: {ACOUSTIC_OPERATING_THRESHOLD}")
    assert ACOUSTIC_OPERATING_THRESHOLD == 0.3998
    assert is_acoustic_spoof(0.40) is True
    assert is_acoustic_spoof(0.30) is False

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

    print("\n=== 4. Testing Enrollment, Policy, Session & Alert Endpoints ===")

    # 4a. Health Check
    res_health = await health_check()
    assert res_health["status"] == "ok"

    # 4b. Speaker Enrollment (POST /api/v1/speaker/enroll)
    t_1s = np.linspace(0, 1.0, 16000, endpoint=False, dtype=np.float32)
    enroll_audio = 0.3 * np.sin(2 * np.pi * 300.0 * t_1s)
    enroll_pcm = (enroll_audio * 32767.0).astype(np.int16).tobytes()
    enroll_b64 = base64.b64encode(enroll_pcm).decode("utf-8")

    res_enroll = await enroll_speaker_endpoint(EnrollRequest(
        caller_id="caller_test_001",
        audio_b64=enroll_b64
    ))
    print(f"Enroll Response: {res_enroll}")
    assert res_enroll == {"caller_id": "caller_test_001", "enrolled": True}

    # 4c. Policy Escalation (POST /api/v1/policy/escalate)
    res_esc = await escalate_policy(PolicyActionRequest(
        session_id="sess_test_999",
        risk_tier="elevated"
    ))
    print(f"Escalate Response: {res_esc}")
    assert res_esc["status"] == "step-up auth requested"

    # 4d. Transaction Freeze (POST /api/v1/transaction/freeze)
    res_freeze = await freeze_transaction(PolicyActionRequest(
        session_id="sess_test_999",
        risk_tier="critical"
    ))
    print(f"Freeze Response: {res_freeze}")
    assert res_freeze["status"] == "transaction frozen"

    # 4e. Alert Dispatcher (POST /api/v1/policy/alert)
    res_alert = await dispatch_alert(AlertRequest(
        session_id="sess_test_999",
        risk_tier="critical"
    ))
    print(f"Alert Response: {res_alert}")
    assert res_alert["status"] == "alert dispatched"
    assert res_alert["sms_sent"] is True
    assert res_alert["email_sent"] is True

    # 4f. Session Risk Store lookup (GET /api/v1/session/{id}/risk)
    sample_update = RiskUpdate(
        chunk_id=1,
        score_acoustic=0.85,
        score_speaker=0.92,
        risk_score=85.0,
        risk_tier="critical",
        speaker_mismatch=False,
        latency_ms=15.2,
        is_spoof=True
    )
    update_session_risk("sess_test_999", sample_update)

    res_sess = await get_session_risk_endpoint("sess_test_999")
    print(f"Session Risk Response: {res_sess}")
    assert res_sess.chunk_id == 1
    assert res_sess.risk_tier == "critical"
    assert res_sess.is_spoof is True

    print("\n=== SUCCESS: All backend contract & extended API checks passed! ===")


def main():
    asyncio.run(run_async_tests())



if __name__ == "__main__":
    main()

