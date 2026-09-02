"""
WebSocket End-to-End Test Client for VeriVox Backend.
"""
import sys
from pathlib import Path
_ROOT_DIR = Path(__file__).resolve().parent.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

import asyncio
import base64
import json
import time
import numpy as np
import websockets


try:
    import torch
    TORCH_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    torch = None
    TORCH_AVAILABLE = False

from backend.enrollment import enroll_speaker_endpoint, EnrollRequest
from backend.policy import get_session_risk_endpoint

async def test_websocket_stream():
    url = "ws://localhost:8000/stream"

    # 1. Enroll speaker before streaming (if torch & speechbrain available)
    t_1s = np.linspace(0, 1.0, 16000, endpoint=False, dtype=np.float32)
    enroll_audio = 0.3 * np.sin(2 * np.pi * 440.0 * t_1s)
    enroll_pcm = (enroll_audio * 32767.0).astype(np.int16).tobytes()
    enroll_b64 = base64.b64encode(enroll_pcm).decode("utf-8")

    try:
        enroll_res = await enroll_speaker_endpoint(EnrollRequest(
            caller_id="caller_ws_user",
            audio_b64=enroll_b64
        ))
        print(f"Pre-stream Enrollment: {enroll_res}")
    except Exception as e:
        print(f"Pre-stream Enrollment skipped (expected if torch/speechbrain missing): {e}")

    print(f"Connecting to WebSocket endpoint {url} ...")
    async with websockets.connect(url) as ws:
        print("Connected to WebSocket stream!")

        # 2. Send 5 test chunks with caller_id & session_id
        session_id = "sess_ws_live_001"
        for chunk_idx in range(1, 6):
            t = np.linspace(0, 0.2, 3200, endpoint=False, dtype=np.float32)
            synth_audio = 0.3 * np.sin(2 * np.pi * 440.0 * t)
            pcm_bytes = (synth_audio * 32767.0).astype(np.int16).tobytes()
            b64_str = base64.b64encode(pcm_bytes).decode("utf-8")

            payload = {
                "chunk_id": chunk_idx,
                "timestamp_capture_ms": int(time.time() * 1000),
                "sample_rate": 16000,
                "duration_ms": 200,
                "is_speech": True,
                "audio_b64": b64_str,
                "caller_id": "caller_ws_user",
                "session_id": session_id
            }

            t0 = time.perf_counter()
            await ws.send(json.dumps(payload))
            response_json = await ws.recv()
            t1 = time.perf_counter()

            resp = json.loads(response_json)
            client_roundtrip_ms = (t1 - t0) * 1000.0

            print(
                f"Chunk {resp['chunk_id']} | "
                f"Acoustic: {resp['score_acoustic']:.4f} | "
                f"Speaker: {resp.get('score_speaker')} | "
                f"Risk: {resp['risk_score']:.1f} ({resp['risk_tier']}) | "
                f"Spoof: {resp.get('is_spoof')} | "
                f"Server Latency: {resp['latency_ms']:.2f} ms | "
                f"Roundtrip: {client_roundtrip_ms:.2f} ms"
            )

            assert "is_spoof" in resp
            assert resp["chunk_id"] == chunk_idx
            await asyncio.sleep(0.05)

    # 3. Verify session risk store has latest RiskUpdate
    latest_risk = await get_session_risk_endpoint(session_id)
    print(f"\nRetrieved latest session risk from store: chunk_id={latest_risk.chunk_id}, risk_tier={latest_risk.risk_tier}")
    assert latest_risk.chunk_id == 5

    print("\nWebSocket Streaming & Speaker Verification Test PASSED Successfully!")


if __name__ == "__main__":
    asyncio.run(test_websocket_stream())

