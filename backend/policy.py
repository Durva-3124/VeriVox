"""
Policy Engine and Session Risk Store for VeriVox (Module 3).

Provides:
  - In-memory store for session risk updates (SESSION_RISK_STORE).
  - POST /api/v1/policy/escalate: Stub endpoint for step-up authentication.
  - POST /api/v1/transaction/freeze: Stub endpoint for transaction freezes (requires human/policy review).
  - GET /api/v1/session/{session_id}/risk: Latest RiskUpdate lookup by session_id.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.schemas import RiskUpdate

log = logging.getLogger("verivox.policy")

router = APIRouter(prefix="/api/v1", tags=["policy"])

# In-memory stores
SESSION_RISK_STORE: Dict[str, RiskUpdate] = {}
ESCALATION_LOGS: List[Dict[str, Any]] = []
FREEZE_LOGS: List[Dict[str, Any]] = []


def update_session_risk(session_id: str, update: RiskUpdate) -> None:
    """Updates the latest RiskUpdate in memory for a session_id."""
    SESSION_RISK_STORE[session_id] = update


def get_session_risk(session_id: str) -> Optional[RiskUpdate]:
    """Retrieves the latest RiskUpdate for a session_id, or None if not found."""
    return SESSION_RISK_STORE.get(session_id)


def reset_policy_stores() -> None:
    """Clears all session risk, escalation, and freeze logs (testing utility)."""
    SESSION_RISK_STORE.clear()
    ESCALATION_LOGS.clear()
    FREEZE_LOGS.clear()


class PolicyActionRequest(BaseModel):
    """Payload for policy escalation and freeze requests."""
    session_id: str = Field(..., description="Unique ID for the voice session")
    risk_tier: str = Field(..., description="Risk tier e.g. low, elevated, critical")


@router.post("/policy/escalate", status_code=status.HTTP_200_OK)
async def escalate_policy(payload: PolicyActionRequest) -> Dict[str, Any]:
    """
    Triggers policy step-up authentication request for elevated/critical risk sessions.
    
    NOTE: NOT a real MFA integration. Stub logger endpoint for pitch/demo flow.
    """
    # NOT a real MFA integration — stub event logger
    entry = {
        "session_id": payload.session_id,
        "risk_tier": payload.risk_tier,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "step_up_auth_requested"
    }
    ESCALATION_LOGS.append(entry)
    log.info("Policy Escalation logged for session '%s' (risk_tier: %s)", payload.session_id, payload.risk_tier)

    return {
        "status": "step-up auth requested",
        "session_id": payload.session_id,
        "risk_tier": payload.risk_tier,
        "timestamp": entry["timestamp"]
    }


@router.post("/transaction/freeze", status_code=status.HTTP_200_OK)
async def freeze_transaction(payload: PolicyActionRequest) -> Dict[str, Any]:
    """
    Triggers a transaction freeze for a critical-risk session.
    
    IMPORTANT: This endpoint must never be called automatically from risk.py
    based on risk_score alone — freezing requires a human/policy decision in
    between, per the system's fail-safe requirement.
    """

    # IMPORTANT: This endpoint must never be called automatically from risk.py
    # based on risk_score alone — freezing requires a human/policy decision in
    # between, per the system's fail-safe requirement.
    entry = {
        "session_id": payload.session_id,
        "risk_tier": payload.risk_tier,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "transaction_frozen"
    }
    FREEZE_LOGS.append(entry)
    log.warning("Transaction freeze logged for session '%s' (risk_tier: %s)", payload.session_id, payload.risk_tier)

    return {
        "status": "transaction frozen",
        "session_id": payload.session_id,
        "risk_tier": payload.risk_tier,
        "timestamp": entry["timestamp"]
    }


@router.get("/session/{session_id}/risk", response_model=RiskUpdate, status_code=status.HTTP_200_OK)
async def get_session_risk_endpoint(session_id: str) -> RiskUpdate:
    """
    Returns the latest RiskUpdate for a given session_id from the in-memory session store.
    """
    update = get_session_risk(session_id)
    if update is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session risk data not found for session_id '{session_id}'."
        )
    return update
