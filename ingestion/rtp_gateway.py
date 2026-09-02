"""
ingestion/rtp_gateway.py
SIP/RTP Ingress Gateway — Module 1

Listens for inbound RTP (RFC 3550) UDP packets carrying G.711 μ-law (PCMU,
payload type 0) or raw 16-bit PCM (payload type 96, dynamic) audio and feeds
decoded PCM frames into IngestionPipeline.push() for downstream VAD +
windowing + model inference.

Architecture
------------
                  ┌─────────────────────────────────┐
  SIP/RTP UDP ──► │  RTPGateway (UDP socket)         │
  (port 5004)     │  • parse RTP header              │
                  │  • decode G.711 μ-law → float32  │
                  │  • feed IngestionPipeline.push()  │
                  │  • yield (1,3200) tensors         │
                  └─────────────────────────────────┘
                              │
                              ▼
                  IngestionPipeline → VAD → model

Supported payload types
-----------------------
  PT 0  : G.711 PCMU (μ-law, 8 kHz) — standard PSTN/SIP
  PT 8  : G.711 PCMA (A-law, 8 kHz) — European PSTN
  PT 96 : Raw 16-bit PCM, 16 kHz mono (dynamic, VeriVox internal)

Usage
-----
    from ingestion.rtp_gateway import RTPGateway

    def on_chunk(tensor):
        # tensor: (1, 3200) float32 torch.Tensor @ 16 kHz
        result = run_module2(tensor, sr=16000)

    gw = RTPGateway(host="0.0.0.0", port=5004, on_chunk=on_chunk)
    gw.start()          # non-blocking — runs in background thread
    ...
    gw.stop()

    # Or use as a context manager:
    with RTPGateway(port=5004, on_chunk=on_chunk):
        time.sleep(30)
"""

from __future__ import annotations

import logging
import socket
import struct
import threading
from typing import Callable, Optional

import numpy as np

try:
    import torch
    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False

try:
    from ingestion.pipeline import IngestionPipeline
except ImportError:
    from pipeline import IngestionPipeline  # type: ignore

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_RTP_HEADER_MIN_BYTES = 12
_PT_PCMU  = 0    # G.711 μ-law, 8 kHz
_PT_PCMA  = 8    # G.711 A-law, 8 kHz
_PT_PCM16 = 96   # Raw int16 PCM, 16 kHz (VeriVox dynamic PT)

_PCMU_SR  = 8_000
_PCM16_SR = 16_000

_UDP_RECV_BYTES = 65_535


# ---------------------------------------------------------------------------
# G.711 decoders (pure numpy — no external deps)
# ---------------------------------------------------------------------------

def _decode_ulaw(data: bytes) -> np.ndarray:
    """Decode G.711 μ-law bytes → float32 array in [-1, 1]."""
    samples = np.frombuffer(data, dtype=np.uint8).astype(np.int32)
    samples = ~samples & 0xFF
    sign    = (samples & 0x80) >> 7
    exp     = (samples >> 4) & 0x07
    mantissa = samples & 0x0F
    linear  = ((mantissa << 1) + 33) << exp
    linear  = np.where(sign, -linear, linear)
    return linear.astype(np.float32) / 32768.0


def _decode_alaw(data: bytes) -> np.ndarray:
    """Decode G.711 A-law bytes → float32 array in [-1, 1]."""
    samples = np.frombuffer(data, dtype=np.uint8).astype(np.int32)
    samples = samples ^ 0x55
    sign    = (samples & 0x80) >> 7
    exp     = (samples >> 4) & 0x07
    mantissa = samples & 0x0F
    linear  = np.where(
        exp == 0,
        (mantissa << 1) + 1,
        ((mantissa << 1) + 33) << (exp - 1),
    )
    linear  = np.where(sign, linear, -linear)
    return linear.astype(np.float32) / 32768.0


def _decode_pcm16(data: bytes) -> np.ndarray:
    """Decode raw int16 PCM bytes → float32 array in [-1, 1]."""
    return np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0


# ---------------------------------------------------------------------------
# RTP header parser
# ---------------------------------------------------------------------------

def _parse_rtp(packet: bytes) -> Optional[tuple[int, int, bytes]]:
    """
    Parse an RTP packet.

    Returns (payload_type, sequence_number, payload_bytes)
    or None if the packet is malformed.
    """
    if len(packet) < _RTP_HEADER_MIN_BYTES:
        return None
    first_byte, second_byte = packet[0], packet[1]
    version = (first_byte >> 6) & 0x03
    if version != 2:
        return None
    cc          = first_byte & 0x0F          # CSRC count
    has_ext     = (first_byte >> 4) & 0x01
    payload_type = second_byte & 0x7F
    seq_num     = struct.unpack_from("!H", packet, 2)[0]

    header_len = _RTP_HEADER_MIN_BYTES + cc * 4
    if has_ext:
        if len(packet) < header_len + 4:
            return None
        ext_len = struct.unpack_from("!H", packet, header_len + 2)[0]
        header_len += 4 + ext_len * 4

    if len(packet) <= header_len:
        return None

    return payload_type, seq_num, packet[header_len:]


# ---------------------------------------------------------------------------
# RTPGateway
# ---------------------------------------------------------------------------

class RTPGateway:
    """
    UDP socket listener that decodes inbound RTP audio and feeds it into
    IngestionPipeline, yielding (1, 3200) float32 torch.Tensor chunks via
    an on_chunk callback.

    Args:
        host:       Bind address (default "0.0.0.0").
        port:       UDP port to listen on (default 5004, standard RTP).
        on_chunk:   Callback invoked with each (1, 3200) tensor.
        vad_enabled: Pass through to IngestionPipeline (default True).
        dynamic_pt: Payload type number for raw PCM16 (default 96).
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 5004,
        on_chunk: Optional[Callable] = None,
        vad_enabled: bool = True,
        dynamic_pt: int = _PT_PCM16,
    ) -> None:
        self.host       = host
        self.port       = port
        self.on_chunk   = on_chunk
        self.dynamic_pt = dynamic_pt
        self._pipeline  = IngestionPipeline(vad_enabled=vad_enabled)
        self._sock: Optional[socket.socket] = None
        self._thread: Optional[threading.Thread] = None
        self._running   = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Bind the UDP socket and start the receive loop in a daemon thread."""
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind((self.host, self.port))
        self._sock.settimeout(1.0)   # allows clean shutdown check
        self._running = True
        self._thread  = threading.Thread(target=self._recv_loop, daemon=True)
        self._thread.start()
        log.info("RTPGateway listening on %s:%d", self.host, self.port)

    def stop(self) -> None:
        """Signal the receive loop to stop and close the socket."""
        self._running = False
        if self._sock:
            self._sock.close()
            self._sock = None
        if self._thread:
            self._thread.join(timeout=3.0)
        self._pipeline.reset()
        log.info("RTPGateway stopped.")

    def __enter__(self) -> "RTPGateway":
        self.start()
        return self

    def __exit__(self, *_) -> None:
        self.stop()

    # ------------------------------------------------------------------
    # Receive loop
    # ------------------------------------------------------------------

    def _recv_loop(self) -> None:
        while self._running:
            try:
                packet, addr = self._sock.recvfrom(_UDP_RECV_BYTES)
            except socket.timeout:
                continue
            except OSError:
                break

            parsed = _parse_rtp(packet)
            if parsed is None:
                log.debug("Dropped malformed RTP packet from %s", addr)
                continue

            pt, seq, payload = parsed
            pcm, sr = self._decode_payload(pt, payload)
            if pcm is None:
                log.debug("Unsupported RTP payload type %d — dropped", pt)
                continue

            chunks = self._pipeline.push(pcm, sr)
            if self.on_chunk:
                for chunk in chunks:
                    try:
                        self.on_chunk(chunk)
                    except Exception as exc:
                        log.error("on_chunk callback raised: %s", exc)

    # ------------------------------------------------------------------
    # Payload decoder dispatch
    # ------------------------------------------------------------------

    def _decode_payload(
        self, pt: int, payload: bytes
    ) -> tuple[Optional[np.ndarray], int]:
        """
        Decode RTP payload bytes to (float32 ndarray, sample_rate).
        Returns (None, 0) for unsupported payload types.
        """
        if pt == _PT_PCMU:
            return _decode_ulaw(payload), _PCMU_SR
        if pt == _PT_PCMA:
            return _decode_alaw(payload), _PCMU_SR
        if pt == self.dynamic_pt:
            return _decode_pcm16(payload), _PCM16_SR
        return None, 0


# ---------------------------------------------------------------------------
# CLI smoke-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import time

    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")

    received: list = []

    def _on_chunk(tensor):
        received.append(tensor)
        log.info("Chunk received — shape %s  total=%d", list(tensor.shape), len(received))

    print("Starting RTPGateway on UDP 0.0.0.0:5004 — send RTP packets to test.")
    print("Press Ctrl+C to stop.\n")

    with RTPGateway(port=5004, on_chunk=_on_chunk):
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print(f"\nStopped. Received {len(received)} chunks.")
