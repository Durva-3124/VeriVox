"""
Alert Notification Engine for VeriVox (Module 3).

Provides:
  - Stub functions for SMS (Twilio) and Email (SendGrid) alert dispatches.
  - POST /api/v1/policy/alert endpoint to dispatch policy alerts for high-risk sessions.
"""

from __future__ import annotations

import logging
from typing import Dict, Any, List

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

log = logging.getLogger("verivox.alerts")

router = APIRouter(prefix="/api/v1/policy", tags=["alerts"])

# In-memory log of dispatched alerts
ALERT_DISPATCH_LOGS: List[Dict[str, Any]] = []


class AlertRequest(BaseModel):
    """Payload contract for policy alert dispatch."""
    session_id: str = Field(..., description="Session identifier for alert context")
    risk_tier: str = Field(..., description="Risk tier triggering the alert")


def send_sms_stub(message: str) -> bool:
    """
    Simulates sending an SMS notification via Twilio.
    
    TODO: Wire real Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) later.
    """
    # TODO: Wire real Twilio credentials here later.
    log.info("[SMS STUB] Dispatching SMS: %s", message)
    return True


def send_email_stub(message: str) -> bool:
    """
    Simulates sending an Email notification via SendGrid.
    
    TODO: Wire real SendGrid credentials (SENDGRID_API_KEY, SENDGRID_FROM_EMAIL) later.
    """
    # TODO: Wire real SendGrid credentials here later.
    log.info("[EMAIL STUB] Dispatching Email: %s", message)
    return True


@router.post("/alert", status_code=status.HTTP_200_OK)
async def dispatch_alert(payload: AlertRequest) -> Dict[str, Any]:
    """
    Dispatches SMS and Email alert notifications for a given session risk event.
    """
    alert_message = (
        f"[VeriVox ALERT] Session '{payload.session_id}' reached risk tier '{payload.risk_tier}'. "
        "Immediate review recommended."
    )

    sms_success = send_sms_stub(alert_message)
    email_success = send_email_stub(alert_message)

    entry = {
        "session_id": payload.session_id,
        "risk_tier": payload.risk_tier,
        "message": alert_message,
        "sms_sent": sms_success,
        "email_sent": email_success
    }
    ALERT_DISPATCH_LOGS.append(entry)

    log.info("Alert dispatched for session '%s' (SMS: %s, Email: %s)", payload.session_id, sms_success, email_success)

    return {
        "status": "alert dispatched",
        "session_id": payload.session_id,
        "risk_tier": payload.risk_tier,
        "sms_sent": sms_success,
        "email_sent": email_success
    }
