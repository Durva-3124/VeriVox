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


async def test_websocket_stream():
    url = "ws://localhost:8000/stream"
    print(f"Connecting to {url} ...")

    async with websockets.connect(url) as ws:
        print("Connected!")

        # 1. Send 5 test chunks (synthetic 200ms audio @ 16kHz)
        for chunk_idx in range(1, 6):
            t = np.linspace(0, 0.2, 3200, endpoint=False, dtype=np.float32)
            # Alternate tone & frequency
            freq = 440.0 if chunk_idx % 2 != 0 else 880.0
            synth_audio = 0.3 * np.sin(2 * np.pi * freq * t)
            pcm_bytes = (synth_audio * 32767.0).astype(np.int16).tobytes()
            b64_str = base64.b64encode(pcm_bytes).decode("utf-8")

            payload = {
                "chunk_id": chunk_idx,
                "timestamp_capture_ms": int(time.time() * 1000),
                "sample_rate": 16000,
                "duration_ms": 200,
                "is_speech": True,
                "audio_b64": b64_str
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
                f"Risk: {resp['risk_score']:.1f} ({resp['risk_tier']}) | "
                f"Server Latency: {resp['latency_ms']:.2f} ms | "
                f"Roundtrip: {client_roundtrip_ms:.2f} ms"
            )

            await asyncio.sleep(0.05)

        print("\nWebSocket Streaming Test PASSED Successfully!")


if __name__ == "__main__":
    asyncio.run(test_websocket_stream())
