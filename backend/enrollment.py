"""
Speaker Enrollment Module for VeriVox (Module 3).

Provides:
  - In-memory store for 192-dimensional ECAPA-TDNN speaker embeddings.
  - POST /api/v1/speaker/enroll endpoint to register speaker voiceprints.
"""

from __future__ import annotations

import logging
from typing import Dict, Optional, Any

import torch
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.schemas import decode_pcm_b64
from model.speaker_verification import enroll_speaker

log = logging.getLogger("verivox.enrollment")

router = APIRouter(prefix="/api/v1/speaker", tags=["speaker"])

# In-memory speaker profile store: caller_id -> 192-dim ECAPA-TDNN torch.Tensor
ENROLLED_SPEAKERS: Dict[str, torch.Tensor] = {}


class EnrollRequest(BaseModel):
    """Payload contract for speaker enrollment."""
    caller_id: str
    audio_b64: str


class EnrollResponse(BaseModel):
    """Response contract for speaker enrollment."""
    caller_id: str
    enrolled: bool


def get_enrolled_embedding(caller_id: str) -> Optional[torch.Tensor]:
    """Retrieve 192-dim enrolled speaker embedding if caller_id is registered."""
    return ENROLLED_SPEAKERS.get(caller_id)


def is_enrolled(caller_id: str) -> bool:
    """Return True if caller_id has an enrolled speaker profile."""
    return caller_id in ENROLLED_SPEAKERS


def reset_enrollments() -> None:
    """Clear all enrolled speaker profiles (testing utility)."""
    ENROLLED_SPEAKERS.clear()


@router.post("/enroll", response_model=EnrollResponse, status_code=status.HTTP_200_OK)
async def enroll_speaker_endpoint(payload: EnrollRequest) -> Dict[str, Any]:
    """
    Enrolls a speaker by extracting a 192-dimensional ECAPA-TDNN embedding
    from the provided base64 PCM audio waveform.
    """
    if not payload.caller_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="caller_id must not be empty."
        )

    if not payload.audio_b64.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="audio_b64 payload must not be empty."
        )

    try:
        samples_np = decode_pcm_b64(payload.audio_b64, expected_samples=None)
    except Exception as decode_err:
        log.warning("Enrollment audio decode failed for %s: %s", payload.caller_id, decode_err)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 audio payload: {decode_err}"
        ) from decode_err

    if len(samples_np) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decoded audio payload contains 0 samples."
        )

    wav_tensor = torch.from_numpy(samples_np)

    try:
        embedding = enroll_speaker([wav_tensor])
    except Exception as enroll_err:
        log.error("Speaker embedding extraction failed for %s: %s", payload.caller_id, enroll_err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract speaker embedding: {enroll_err}"
        ) from enroll_err

    ENROLLED_SPEAKERS[payload.caller_id] = embedding
    log.info("Successfully enrolled speaker '%s' (embedding shape: %s)", payload.caller_id, list(embedding.shape))

    return {
        "caller_id": payload.caller_id,
        "enrolled": True
    }
