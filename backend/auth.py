"""
backend/auth.py
Authentication, RBAC, and Rate Limiting middleware for VeriVox (Module 3).

Auth scheme : Bearer API key in Authorization header.
              Keys are stored in the VERIVOX_API_KEYS environment variable
              as a comma-separated list (e.g. "key1,key2").
              If the env var is unset, auth is DISABLED with a warning
              (development mode only).

RBAC roles  : admin  — full access to all endpoints
              analyst — read + stream; no enroll/freeze/escalate
              stream  — WS /stream only (telephony edge nodes)

Rate limiting: sliding-window in-memory counter per API key.
               Default: 120 requests / 60 seconds.
               Configurable via VERIVOX_RATE_LIMIT and VERIVOX_RATE_WINDOW env vars.

Usage (in main.py)
------------------
    from backend.auth import AuthMiddleware, require_role
    app.add_middleware(AuthMiddleware)

    @app.get("/admin-only")
    async def admin_endpoint(role: str = Depends(require_role("admin"))):
        ...
"""

from __future__ import annotations

import logging
import os
import time
from collections import defaultdict, deque
from typing import Callable, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

log = logging.getLogger("verivox.auth")

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------

def _load_api_keys() -> dict[str, str]:
    """
    Load API keys and their roles from environment variables.

    VERIVOX_API_KEYS format: "key1:admin,key2:analyst,key3:stream"
    Falls back to open access (dev mode) if unset.
    """
    raw = os.environ.get("VERIVOX_API_KEYS", "")
    if not raw.strip():
        log.warning(
            "VERIVOX_API_KEYS not set — authentication DISABLED (dev mode). "
            "Set this env var before deploying to production."
        )
        return {}
    keys: dict[str, str] = {}
    for entry in raw.split(","):
        entry = entry.strip()
        if ":" in entry:
            key, role = entry.split(":", 1)
            keys[key.strip()] = role.strip()
        else:
            keys[entry] = "analyst"   # default role
    log.info("Loaded %d API key(s).", len(keys))
    return keys


_API_KEYS: dict[str, str] = _load_api_keys()

_RATE_LIMIT  = int(os.environ.get("VERIVOX_RATE_LIMIT", "120"))   # requests
_RATE_WINDOW = int(os.environ.get("VERIVOX_RATE_WINDOW", "60"))    # seconds

# ---------------------------------------------------------------------------
# Role permissions
# ---------------------------------------------------------------------------

_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin":   {"*"},
    "analyst": {"/health", "/api/v1/session", "/stream", "/api/v1/policy/alert"},
    "stream":  {"/stream", "/health"},
}

# Endpoints that are always public (no auth required)
_PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

# ---------------------------------------------------------------------------
# In-memory rate limiter (sliding window per API key)
# ---------------------------------------------------------------------------

_rate_windows: dict[str, deque] = defaultdict(deque)


def _check_rate_limit(api_key: str) -> bool:
    """Return True if the request is within the rate limit, False if exceeded."""
    now = time.monotonic()
    window = _rate_windows[api_key]
    # Drop timestamps outside the window
    while window and window[0] < now - _RATE_WINDOW:
        window.popleft()
    if len(window) >= _RATE_LIMIT:
        return False
    window.append(now)
    return True


# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------

class AuthMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that enforces Bearer API key authentication
    and per-key rate limiting on all non-public endpoints.
    """

    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path

        # Always allow public paths
        if any(path.startswith(p) for p in _PUBLIC_PATHS):
            return await call_next(request)

        # Dev mode: no keys configured — allow all
        if not _API_KEYS:
            return await call_next(request)

        # Extract Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing or invalid Authorization header. Use: Bearer <api_key>"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        api_key = auth_header[len("Bearer "):].strip()
        if api_key not in _API_KEYS:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid API key."},
            )

        # Rate limit check
        if not _check_rate_limit(api_key):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": f"Rate limit exceeded: {_RATE_LIMIT} requests per {_RATE_WINDOW}s."
                },
            )

        # Attach role to request state for downstream use
        request.state.api_key = api_key
        request.state.role    = _API_KEYS[api_key]

        return await call_next(request)


# ---------------------------------------------------------------------------
# Role dependency for individual endpoints
# ---------------------------------------------------------------------------

def require_role(required_role: str) -> Callable:
    """
    FastAPI dependency that enforces a minimum role on an endpoint.

    Usage:
        @app.post("/api/v1/transaction/freeze")
        async def freeze(role: str = Depends(require_role("admin"))):
            ...
    """
    async def _check(request: Request) -> str:
        # Dev mode: no keys configured
        if not _API_KEYS:
            return "admin"

        role = getattr(request.state, "role", None)
        if role is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

        allowed = _ROLE_PERMISSIONS.get(role, set())
        if "*" in allowed or required_role == role:
            return role

        # Admin can do everything
        if role == "admin":
            return role

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role}' is not permitted to access this endpoint (requires '{required_role}').",
        )

    return _check
