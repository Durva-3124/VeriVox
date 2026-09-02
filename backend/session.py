"""
Session Management Module for VeriVox (Module 3).

Provides:
  - POST /api/v1/session/start endpoint to initialize new voice sessions.
"""

from __future__ import annotations

import logging
import uuid
from typing import Dict, Any, Optional

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from backend.policy import update_session_risk
from backend.schemas import RiskUpdate

log = logging.getLogger("verivox.session")

router = APIRouter(prefix="/api/v1/session", tags=["session"])


class StartSessionRequest(BaseModel):
    """Payload contract for session start request."""
    caller_id: Optional[str] = Field(default=None, description="Optional caller ID for the session")


class StartSessionResponse(BaseModel):
    """Response contract for session start request."""
    session_id: str
    status: str


@router.post("/start", response_model=StartSessionResponse, status_code=status.HTTP_200_OK)
async def start_session_endpoint(payload: Optional[StartSessionRequest] = None) -> Dict[str, Any]:
    """
    Initializes a new voice session, generates a unique session_id,
    and seeds the session risk store with a default low-risk state (risk_score=0.0, risk_tier="low").
    """
    session_id = str(uuid.uuid4())
    caller_id = payload.caller_id if payload is not None else None

    default_update = RiskUpdate(
        chunk_id=0,
        score_acoustic=0.0,
        score_speaker=None,
        risk_score=0.0,
        risk_tier="low",
        speaker_mismatch=False,
        latency_ms=0.0,
        is_spoof=False
    )
    update_session_risk(session_id, default_update)

    log.info("Session started with session_id '%s' (caller_id: %s)", session_id, caller_id)

    return {
        "session_id": session_id,
        "status": "started"
    }
