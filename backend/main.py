"""
FastAPI Real-Time Voice Cloning Impersonation Detection Backend for VeriVox (Module 3).

Provides:
  - GET /health: Status & ONNX model readiness check
  - WS /stream: WebSocket endpoint for continuous 200ms audio chunk evaluation
"""

from __future__ import annotations

import logging
import time
from typing import Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.model_runtime import aasist_runtime
from backend.risk import RiskScorer
from backend.schemas import AudioChunk, RiskUpdate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("verivox.backend")

app = FastAPI(
    title="VeriVox Real-Time Voice Anti-Spoofing Backend",
    description="Sub-50ms voice cloning impersonation detection platform powered by AASIST ONNX.",
    version="1.0.0",
)

# Enable CORS for local dev & testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint exposing system status and ONNX model status."""
    return {
        "status": "ok",
        "model_loaded": aasist_runtime.is_loaded()
    }


@app.websocket("/stream")
async def websocket_audio_stream(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for real-time audio chunk stream risk analysis.

    Contract:
      Input : AudioChunk JSON (chunk_id, timestamp_capture_ms, sample_rate, duration_ms, is_speech, audio_b64)
      Output: RiskUpdate JSON (chunk_id, score_acoustic, score_speaker, risk_score, risk_tier, speaker_mismatch, latency_ms)
    """
    await websocket.accept()
    log.info("WebSocket connection established with client: %s", websocket.client)

    # Per-connection session risk scorer instance
    risk_scorer = RiskScorer(window_size=5)

    try:
        while True:
            t_start = time.perf_counter()
            data_text = await websocket.receive_text()

            # 1. Parse and validate AudioChunk JSON payload
            try:
                chunk = AudioChunk.model_validate_json(data_text)
            except Exception as parse_err:
                log.warning("Received malformed AudioChunk payload: %s", parse_err)
                await websocket.send_json({"error": f"Invalid AudioChunk payload: {parse_err}"})
                continue

            # 2. Decode base64 PCM audio waveform
            try:
                waveform = chunk.decode_audio()
            except Exception as decode_err:
                log.warning("Audio decoding failed for chunk %d: %s", chunk.chunk_id, decode_err)
                await websocket.send_json({
                    "error": f"Audio decode failed for chunk {chunk.chunk_id}: {decode_err}"
                })
                continue

            # 3. Handle silence / VAD skip
            if not chunk.is_speech or len(waveform) == 0:
                t_end = time.perf_counter()
                latency_ms = round((t_end - t_start) * 1000.0, 2)
                risk_score, risk_tier, speaker_mismatch = risk_scorer.score_chunk(acoustic=0.0, speaker=None)
                update = RiskUpdate(
                    chunk_id=chunk.chunk_id,
                    score_acoustic=0.0,
                    score_speaker=None,
                    risk_score=risk_score,
                    risk_tier=risk_tier,
                    speaker_mismatch=speaker_mismatch,
                    latency_ms=latency_ms
                )
                log.info("Chunk %d [SILENCE] processed in %.2f ms", chunk.chunk_id, latency_ms)
                await websocket.send_text(update.model_dump_json())
                continue

            # 4. Execute AASIST ONNX Model Inference
            try:
                infer_result = aasist_runtime.infer(waveform)
                score_acoustic = infer_result["score_acoustic"]
            except Exception as infer_err:
                log.error("Inference failed for chunk %d: %s", chunk.chunk_id, infer_err)
                await websocket.send_json({"error": f"Inference failed: {infer_err}"})
                continue

            # 5. Evaluate Risk & Speaker Consistency
            # Note: score_speaker is currently None (no enrollment endpoint active yet)
            score_speaker = None
            risk_score, risk_tier, speaker_mismatch = risk_scorer.score_chunk(
                acoustic=score_acoustic,
                speaker=score_speaker
            )

            # Measure processing latency prior to network socket send
            t_end = time.perf_counter()
            latency_ms = round((t_end - t_start) * 1000.0, 2)

            log.info(
                "Chunk %d | Latency: %.2f ms | Acoustic: %.4f | Risk: %.1f (%s) | Mismatch: %s",
                chunk.chunk_id,
                latency_ms,
                score_acoustic,
                risk_score,
                risk_tier,
                speaker_mismatch
            )

            # 6. Send RiskUpdate response
            update = RiskUpdate(
                chunk_id=chunk.chunk_id,
                score_acoustic=round(score_acoustic, 4),
                score_speaker=score_speaker,
                risk_score=risk_score,
                risk_tier=risk_tier,
                speaker_mismatch=speaker_mismatch,
                latency_ms=latency_ms
            )

            await websocket.send_text(update.model_dump_json())

    except WebSocketDisconnect:
        log.info("WebSocket disconnected gracefully.")
    except Exception as e:
        log.error("Unexpected WebSocket handler error: %s", e)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
