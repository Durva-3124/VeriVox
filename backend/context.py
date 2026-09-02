"""
backend/context.py
Context Weight Engine for VeriVox risk scoring (Module 3).

Computes the γ·Context_weight term in the risk formula:
    Rt = α·score_acoustic + β·score_prosody + γ·context_weight + δ·score_speaker

Context signals (all four now implemented)
------------------------------------------
1. Caller privilege      — is_privileged_caller flag (×1.3 multiplier)
2. Transaction amount    — amount > ₹10,00,000 threshold (×1.2 multiplier)
3. Known-contact lookup  — caller_id in enrolled contact registry (×0.7 — reduces risk)
4. Fraud-history signal  — caller_id in fraud-indicator registry (×1.5 — escalates risk)

Normalisation
-------------
    Minimum possible raw weight : 0.7  (known contact, no other flags)
    Maximum possible raw weight : 2.34 (privileged + high-value + fraud history)
    Neutral baseline            : 1.0  (no flags set)

    context_weight = (raw - 0.7) / (2.34 - 0.7)   → [0, 1]

Public API
----------
    compute_context_weight(...)              -> float
    compute_context_weight_from_chunk(chunk) -> float
    register_known_contact(caller_id)
    register_fraud_indicator(caller_id)
    clear_registries()
"""

from __future__ import annotations

import logging
from typing import Optional, Set

log = logging.getLogger("verivox.context")

# ---------------------------------------------------------------------------
# In-memory registries (replace with DB lookups in production)
# ---------------------------------------------------------------------------

_KNOWN_CONTACTS: Set[str] = set()
_FRAUD_INDICATORS: Set[str] = set()

# ---------------------------------------------------------------------------
# Multiplier constants
# ---------------------------------------------------------------------------

_MULT_PRIVILEGED    = 1.3   # caller has elevated access rights
_MULT_HIGH_VALUE    = 1.2   # transaction > ₹10,00,000
_MULT_KNOWN_CONTACT = 0.7   # caller is in enrolled contact list (trust signal)
_MULT_FRAUD_HISTORY = 1.5   # caller_id has prior fraud indicator

_HIGH_VALUE_THRESHOLD_INR = 1_000_000   # ₹10,00,000

# Normalisation bounds
_RAW_MIN = _MULT_KNOWN_CONTACT                                         # 0.70
_RAW_MAX = _MULT_PRIVILEGED * _MULT_HIGH_VALUE * _MULT_FRAUD_HISTORY   # 2.34


# ---------------------------------------------------------------------------
# Registry management
# ---------------------------------------------------------------------------

def register_known_contact(caller_id: str) -> None:
    """Add a caller_id to the known-contact trust registry."""
    _KNOWN_CONTACTS.add(caller_id)
    log.debug("Registered known contact: %s", caller_id)


def register_fraud_indicator(caller_id: str) -> None:
    """Flag a caller_id as having a historical fraud indicator."""
    _FRAUD_INDICATORS.add(caller_id)
    log.debug("Registered fraud indicator: %s", caller_id)


def clear_registries() -> None:
    """Clear both registries (testing utility)."""
    _KNOWN_CONTACTS.clear()
    _FRAUD_INDICATORS.clear()


def is_known_contact(caller_id: Optional[str]) -> bool:
    return bool(caller_id and caller_id in _KNOWN_CONTACTS)


def has_fraud_history(caller_id: Optional[str]) -> bool:
    return bool(caller_id and caller_id in _FRAUD_INDICATORS)


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

def compute_context_weight(
    caller_id: Optional[str] = None,
    is_privileged_caller: bool = False,
    transaction_amount: Optional[float] = None,
    is_known_contact_flag: Optional[bool] = None,
    has_fraud_history_flag: Optional[bool] = None,
) -> float:
    """
    Compute the normalised context weight in [0, 1].

    Args:
        caller_id:              Caller identifier for registry lookups.
        is_privileged_caller:   True if caller has elevated access rights.
        transaction_amount:     Transaction value in INR (None = unknown).
        is_known_contact_flag:  Override for known-contact signal (None = use registry).
        has_fraud_history_flag: Override for fraud-history signal (None = use registry).

    Returns:
        float in [0, 1] — 0.0 = trusted known contact, 1.0 = maximum risk context.
    """
    raw = 1.0

    # Signal 1: caller privilege
    if is_privileged_caller:
        raw *= _MULT_PRIVILEGED

    # Signal 2: high-value transaction
    if transaction_amount is not None and transaction_amount > _HIGH_VALUE_THRESHOLD_INR:
        raw *= _MULT_HIGH_VALUE

    # Signal 3: known-contact lookup (trust signal — reduces weight)
    known = is_known_contact_flag if is_known_contact_flag is not None else is_known_contact(caller_id)
    if known:
        raw *= _MULT_KNOWN_CONTACT

    # Signal 4: fraud-history indicator (escalates weight)
    fraud = has_fraud_history_flag if has_fraud_history_flag is not None else has_fraud_history(caller_id)
    if fraud:
        raw *= _MULT_FRAUD_HISTORY

    normalised = (raw - _RAW_MIN) / (_RAW_MAX - _RAW_MIN)
    return float(min(max(normalised, 0.0), 1.0))


def compute_context_weight_from_chunk(chunk) -> float:
    """Convenience wrapper: compute context weight directly from an AudioChunk."""
    return compute_context_weight(
        caller_id=chunk.caller_id,
        is_privileged_caller=chunk.is_privileged_caller,
        transaction_amount=chunk.transaction_amount,
        is_known_contact_flag=getattr(chunk, "is_known_contact", None),
        has_fraud_history_flag=getattr(chunk, "has_fraud_history", None),
    )
