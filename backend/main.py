"""
FastAPI Real-Time Voice Cloning Impersonation Detection Backend for VeriVox (Module 3).

Note: Install dependencies from the repository root requirements.txt only (`pip install -r requirements.txt`).

Provides:
  - GET /health: Status & ONNX model readiness check
  - WS /stream: WebSocket endpoint for continuous 200ms audio chunk evaluation
  - POST /api/v1/speaker/enroll: Speaker profile registration endpoint
  - POST /api/v1/policy/escalate: Step-up authentication trigger (stub)
  - POST /api/v1/transaction/freeze: Transaction freeze trigger (stub)
  - GET /api/v1/session/{id}/risk: Real-time session risk state lookup
  - POST /api/v1/policy/alert: Policy alert dispatcher (SMS & Email stubs)
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Dict, Any, Deque, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.alerts import router as alerts_router, send_sms_stub, send_email_stub
from backend.auth import AuthMiddleware
from backend.context import compute_context_weight_from_chunk, register_known_contact, register_fraud_indicator
from backend.enrollment import router as enrollment_router, is_enrolled, get_enrolled_embedding
from backend.model_runtime import aasist_runtime
from backend.policy import router as policy_router, update_session_risk
from backend.risk import RiskScorer, is_acoustic_spoof
from backend.schemas import AudioChunk, RiskUpdate
from backend.session import router as session_router

try:
    import torch
    from model.speaker_verification import score_speaker, _embed
    TORCH_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    torch = None
    score_speaker = None
    _embed = None
    TORCH_AVAILABLE = False

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

# Auth + rate limiting (reads VERIVOX_API_KEYS env var; disabled in dev if unset)
app.add_middleware(AuthMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount APIRouters for enrollment, policy, alert, and session modules
app.include_router(enrollment_router)
app.include_router(policy_router)
app.include_router(alerts_router)
app.include_router(session_router)


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
      Input : AudioChunk JSON (chunk_id, timestamp_capture_ms, sample_rate, duration_ms, is_speech, audio_b64, caller_id, session_id)
      Output: RiskUpdate JSON (chunk_id, score_acoustic, score_speaker, risk_score, risk_tier, speaker_mismatch, latency_ms, is_spoof)
    """
    await websocket.accept()
    log.info("WebSocket connection established with client: %s", websocket.client)

    # Per-connection state
    risk_scorer = RiskScorer(window_size=5)
    # Rolling buffer: accumulate 20 × 200ms chunks = 4s before calling run_module2()
    _SEGMENT_CHUNKS = 20
    chunk_buffer: Deque["torch.Tensor"] = deque(maxlen=_SEGMENT_CHUNKS)

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
                cw = compute_context_weight_from_chunk(chunk)
                risk_score, risk_tier, speaker_mismatch = risk_scorer.score_chunk(
                    acoustic=0.0,
                    speaker=None,
                    score_prosody=0.0,
                    context_weight=cw
                )
                update = RiskUpdate(
                    chunk_id=chunk.chunk_id,
                    score_acoustic=0.0,
                    score_speaker=None,
                    risk_score=risk_score,
                    risk_tier=risk_tier,
                    speaker_mismatch=speaker_mismatch,
                    latency_ms=latency_ms,
                    is_spoof=False
                )
                if chunk.session_id:
                    update_session_risk(chunk.session_id, update)

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

            # 4b. Accumulate chunks; run run_module2() only on full 4s segments (off event loop)
            score_prosody_val: Optional[float] = None
            wav_tensor = torch.from_numpy(waveform)
            chunk_buffer.append(wav_tensor)
            if len(chunk_buffer) == _SEGMENT_CHUNKS:
                try:
                    from model.inference import run_module2, assemble_segment
                    segment = assemble_segment(list(chunk_buffer))
                    loop = asyncio.get_event_loop()
                    mod2_res = await loop.run_in_executor(
                        None, run_module2, segment, chunk.sample_rate
                    )
                    score_prosody_val = mod2_res.get("score_prosody")
                except Exception as pros_err:
                    log.warning("Prosodic scoring via run_module2 failed for chunk %d: %s", chunk.chunk_id, pros_err)
                    score_prosody_val = None

            # 4c. Compute Context Weight (all 4 signals: privilege, amount, known-contact, fraud-history)
            context_weight = compute_context_weight_from_chunk(chunk)

            # 5. Speaker Verification (ECAPA-TDNN 192-dim vector)
            score_speaker_val: Optional[float] = None
            if chunk.caller_id and is_enrolled(chunk.caller_id):
                try:
                    enrolled_emb = get_enrolled_embedding(chunk.caller_id)
                    if enrolled_emb is not None:
                        live_emb = _embed(wav_tensor)
                        score_speaker_val = score_speaker(live_emb, enrolled_emb)
                except Exception as spk_err:
                    log.warning("Speaker verification failed for chunk %d: %s", chunk.chunk_id, spk_err)
                    score_speaker_val = None

            # 6. Evaluate Risk & Speaker Consistency
            risk_score, risk_tier, speaker_mismatch = risk_scorer.score_chunk(
                acoustic=score_acoustic,
                speaker=score_speaker_val,
                score_prosody=score_prosody_val,
                context_weight=context_weight
            )

            is_spoof = is_acoustic_spoof(score_acoustic)

            # Measure processing latency prior to network socket send
            t_end = time.perf_counter()
            latency_ms = round((t_end - t_start) * 1000.0, 2)

            log.info(
                "Chunk %d | Latency: %.2f ms | Acoustic: %.4f | Speaker: %s | Risk: %.1f (%s) | Mismatch: %s | Spoof: %s",
                chunk.chunk_id,
                latency_ms,
                score_acoustic,
                f"{score_speaker_val:.4f}" if score_speaker_val is not None else "N/A",
                risk_score,
                risk_tier,
                speaker_mismatch,
                is_spoof
            )

            # 7. Construct and send RiskUpdate response
            update = RiskUpdate(
                chunk_id=chunk.chunk_id,
                score_acoustic=round(score_acoustic, 4),
                score_speaker=round(score_speaker_val, 4) if score_speaker_val is not None else None,
                risk_score=risk_score,
                risk_tier=risk_tier,
                speaker_mismatch=speaker_mismatch,
                latency_ms=latency_ms,
                is_spoof=is_spoof
            )

            if chunk.session_id:
                update_session_risk(chunk.session_id, update)

            # Auto-dispatch alerts on critical tier
            if risk_tier == "critical" and chunk.session_id:
                alert_msg = (
                    f"[VeriVox ALERT] Session '{chunk.session_id}' reached CRITICAL risk tier "
                    f"(score={risk_score:.1f}, spoof={is_spoof})."
                )
                send_sms_stub(alert_msg)
                send_email_stub(alert_msg)

            await websocket.send_text(update.model_dump_json())

    except WebSocketDisconnect:
        log.info("WebSocket disconnected gracefully.")
    except Exception as e:
        log.error("Unexpected WebSocket handler error: %s", e)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

