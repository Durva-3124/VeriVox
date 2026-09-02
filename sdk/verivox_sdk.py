"""
sdk/verivox_sdk.py
VeriVox Python SDK — thin wrapper around the VeriVox backend REST/WebSocket API.

Usage
-----
    from sdk.verivox_sdk import VeriVoxClient

    client = VeriVoxClient(base_url="http://localhost:8000")

    # Health check
    print(client.health())

    # Start a session
    session_id = client.start_session(caller_id="alice")

    # Enroll a speaker (base64-encoded PCM audio)
    client.enroll_speaker(caller_id="alice", audio_b64="<base64>")

    # Get session risk
    risk = client.get_session_risk(session_id)

    # Escalate policy
    client.escalate(session_id, risk_tier="critical")

    # Dispatch alert
    client.alert(session_id, risk_tier="critical")

    # Freeze transaction
    client.freeze_transaction(session_id, risk_tier="critical")

    # Stream audio chunks over WebSocket
    import numpy as np
    audio = np.zeros(3200, dtype=np.float32)
    for update in client.stream_chunks([audio], session_id=session_id, caller_id="alice"):
        print(update)
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Generator, Iterator, Optional

import numpy as np

log = logging.getLogger("verivox.sdk")

# ---------------------------------------------------------------------------
# Optional deps — requests for REST, websocket-client for WS
# ---------------------------------------------------------------------------

try:
    import requests as _requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _requests = None  # type: ignore
    _REQUESTS_AVAILABLE = False

try:
    import websocket as _websocket
    _WEBSOCKET_AVAILABLE = True
except ImportError:
    _websocket = None  # type: ignore
    _WEBSOCKET_AVAILABLE = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _encode_pcm(audio: np.ndarray) -> str:
    """Encode a float32 numpy array as base64 PCM for the API."""
    pcm = audio.astype(np.float32)
    return base64.b64encode(pcm.tobytes()).decode("ascii")


def _require_requests() -> None:
    if not _REQUESTS_AVAILABLE:
        raise ImportError("requests is required: pip install requests")


def _require_websocket() -> None:
    if not _WEBSOCKET_AVAILABLE:
        raise ImportError("websocket-client is required: pip install websocket-client")


# ---------------------------------------------------------------------------
# VeriVoxClient
# ---------------------------------------------------------------------------

class VeriVoxClient:
    """
    Thin Python SDK client for the VeriVox backend API.

    Args:
        base_url: HTTP base URL of the backend (default http://localhost:8000).
        timeout:  Request timeout in seconds (default 10).
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        timeout: int = 10,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.ws_url   = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
        self.timeout  = timeout

    # ------------------------------------------------------------------
    # REST endpoints
    # ------------------------------------------------------------------

    def health(self) -> dict:
        """GET /health — returns service status and model readiness."""
        _require_requests()
        resp = _requests.get(f"{self.base_url}/health", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def start_session(self, caller_id: Optional[str] = None) -> str:
        """
        POST /api/v1/session/start — initialise a new voice session.

        Returns the session_id string.
        """
        _require_requests()
        payload = {"caller_id": caller_id} if caller_id else {}
        resp = _requests.post(
            f"{self.base_url}/api/v1/session/start",
            json=payload,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()["session_id"]

    def get_session_risk(self, session_id: str) -> dict:
        """GET /api/v1/session/{id}/risk — latest risk state for a session."""
        _require_requests()
        resp = _requests.get(
            f"{self.base_url}/api/v1/session/{session_id}/risk",
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    def enroll_speaker(self, caller_id: str, audio_b64: str) -> dict:
        """
        POST /api/v1/speaker/enroll — register a speaker voiceprint.

        Args:
            caller_id:  Unique caller identifier.
            audio_b64:  Base64-encoded float32 PCM audio at 16 kHz mono.
        """
        _require_requests()
        resp = _requests.post(
            f"{self.base_url}/api/v1/speaker/enroll",
            json={"caller_id": caller_id, "audio_b64": audio_b64},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    def enroll_speaker_array(self, caller_id: str, audio: np.ndarray) -> dict:
        """Convenience: enroll from a float32 numpy array instead of base64."""
        return self.enroll_speaker(caller_id, _encode_pcm(audio))

    def escalate(self, session_id: str, risk_tier: str) -> dict:
        """POST /api/v1/policy/escalate — trigger step-up authentication."""
        _require_requests()
        resp = _requests.post(
            f"{self.base_url}/api/v1/policy/escalate",
            json={"session_id": session_id, "risk_tier": risk_tier},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    def alert(self, session_id: str, risk_tier: str) -> dict:
        """POST /api/v1/policy/alert — dispatch SMS + email alert."""
        _require_requests()
        resp = _requests.post(
            f"{self.base_url}/api/v1/policy/alert",
            json={"session_id": session_id, "risk_tier": risk_tier},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    def freeze_transaction(self, session_id: str, risk_tier: str) -> dict:
        """POST /api/v1/transaction/freeze — freeze a high-risk transaction."""
        _require_requests()
        resp = _requests.post(
            f"{self.base_url}/api/v1/transaction/freeze",
            json={"session_id": session_id, "risk_tier": risk_tier},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # WebSocket streaming
    # ------------------------------------------------------------------

    def stream_chunks(
        self,
        chunks: list[np.ndarray],
        session_id: Optional[str] = None,
        caller_id: Optional[str] = None,
        sample_rate: int = 16_000,
        is_privileged_caller: bool = False,
        transaction_amount: Optional[float] = None,
        is_known_contact: bool = False,
        has_fraud_history: bool = False,
    ) -> Generator[dict, None, None]:
        """
        Send a list of 200ms audio chunks over WS /stream and yield RiskUpdate dicts.

        Args:
            chunks:               List of (3200,) float32 numpy arrays.
            session_id:           Session ID from start_session().
            caller_id:            Caller identifier for speaker verification.
            sample_rate:          Must be 16000.
            is_privileged_caller: Privilege flag for context weight.
            transaction_amount:   INR amount for context weight.
            is_known_contact:     Known-contact flag for context weight.
            has_fraud_history:    Fraud-history flag for context weight.

        Yields:
            dict — RiskUpdate payload per chunk.
        """
        _require_websocket()

        ws = _websocket.create_connection(
            f"{self.ws_url}/stream",
            timeout=self.timeout,
        )
        try:
            for i, chunk in enumerate(chunks):
                payload = {
                    "chunk_id":            i,
                    "timestamp_capture_ms": i * 200,
                    "sample_rate":         sample_rate,
                    "duration_ms":         200,
                    "is_speech":           True,
                    "audio_b64":           _encode_pcm(chunk),
                    "session_id":          session_id,
                    "caller_id":           caller_id,
                    "is_privileged_caller": is_privileged_caller,
                    "transaction_amount":  transaction_amount,
                    "is_known_contact":    is_known_contact,
                    "has_fraud_history":   has_fraud_history,
                }
                ws.send(json.dumps(payload))
                raw = ws.recv()
                yield json.loads(raw)
        finally:
            ws.close()
