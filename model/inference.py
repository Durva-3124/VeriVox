"""
Module 2 inference entry point for VeriVox.

Single public function:
    run_module2(waveform, sr, enrolled_speaker_embedding=None) -> dict

Return contract (key names are fixed — do not rename):
    {
        "score_acoustic":  float,        # DL model spoof probability [0,1]
        "score_prosody":   float,        # prosodic spoof indicator   [0,1]
        "score_speaker":   float | None, # speaker similarity [0,1] or None
        "raw_features":    dict,         # flat acoustic + prosodic scalars
    }

Model selection:
    Set the MODULE2_MODEL env var to "aasist" to use AASIST instead of
    RawNet2 (default).  The checkpoint is loaded from
    model/training/checkpoints/best_eer_<model>.pt.

    MODULE2_MODEL=aasist python model/inference.py
"""

from __future__ import annotations

import logging
import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import Optional

import torch
import torch.nn.functional as F

# Make model/ importable regardless of cwd
_MODEL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_MODEL_DIR))

from features.acoustic import extract_acoustic_features
from features.prosodic import extract_prosodic_features
from speaker_verification import score_speaker, _embed

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_CHECKPOINT_DIR = _MODEL_DIR / "training" / "checkpoints"
_DEFAULT_MODEL  = os.environ.get("MODULE2_MODEL", "rawnet2").lower()


# ---------------------------------------------------------------------------
# Model loader — lazy singleton, keyed on model name
# ---------------------------------------------------------------------------

@lru_cache(maxsize=2)
def _load_model(model_name: str) -> torch.nn.Module:
    """
    Load the anti-spoofing model from its best-EER checkpoint.
    Falls back to a freshly initialised model if no checkpoint exists
    (useful during development before training has run).
    """
    if model_name == "rawnet2":
        from rawnet2 import RawNet2
        model = RawNet2()
    elif model_name == "aasist":
        from aasist import AASISTModel
        model = AASISTModel()
    else:
        raise ValueError(f"Unknown model '{model_name}'. Set MODULE2_MODEL=rawnet2|aasist")

    ckpt_path = _CHECKPOINT_DIR / f"best_eer_{model_name}.pt"
    if ckpt_path.exists():
        ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=True)
        model.load_state_dict(ckpt["model_state"])
        log.info("Loaded checkpoint: %s (epoch %d, val_eer=%.4f)",
                 ckpt_path.name, ckpt["epoch"], ckpt["val_eer"])
    else:
        log.warning("No checkpoint found at %s — using uninitialised weights.", ckpt_path)

    model.eval()
    return model


# ---------------------------------------------------------------------------
# Prosodic score fusion
# ---------------------------------------------------------------------------

def _prosodic_spoof_score(prosodic: dict[str, float]) -> float:
    """
    Combine prosodic features into a single spoof indicator in [0, 1].

    Heuristic fusion (to be replaced by a learned linear layer once
    labelled prosodic data is available from Harsh's datasets):

      - Low jitter  → more spoof-like  (weight +)
      - Low shimmer → more spoof-like  (weight +)
      - Low f0_std  → more spoof-like  (weight +)
      - High speech_rate → more spoof-like (TTS often too fast)

    Each sub-score is clipped to [0, 1] before weighting.
    Weights sum to 1.0 so the output stays in [0, 1].

    TODO: replace with a logistic regression head trained on
          ASVspoof prosodic features once Harsh's splits are ready.
    """
    # Jitter: natural ~0.005–0.015; TTS ~0. Map low→high spoof score.
    jitter_score  = float(1.0 - min(prosodic["jitter_local"] / 0.02, 1.0))

    # Shimmer: natural ~0.05–0.15; TTS ~0.
    shimmer_score = float(1.0 - min(prosodic["shimmer_local"] / 0.15, 1.0))

    # F0 std: natural ~10–30 Hz; TTS ~0.
    f0_std_score  = float(1.0 - min(prosodic["f0_std"] / 30.0, 1.0))

    # Speech rate: natural 3–8 syl/s; TTS can exceed 10.
    rate          = prosodic["speech_rate_syl_per_s"]
    rate_score    = float(min(max(rate - 8.0, 0.0) / 4.0, 1.0))  # 0 below 8, 1 at 12+

    score = 0.35 * jitter_score + 0.35 * shimmer_score + 0.20 * f0_std_score + 0.10 * rate_score
    return float(min(max(score, 0.0), 1.0))


# ---------------------------------------------------------------------------
# Streaming helper
# ---------------------------------------------------------------------------

def assemble_segment(chunks: list[torch.Tensor]) -> torch.Tensor:
    """
    Assemble a list of 200ms chunks into a single segment for run_module2().

    Args:
        chunks: list of (1, 3200) or (3200,) float32 tensors from ingestion.
                Typically a rolling deque of 20 chunks = 4 seconds.

    Returns:
        (1, T) float32 tensor ready to pass as `waveform` to run_module2().
    """
    tensors = [c.reshape(1, -1) if c.dim() == 1 else c for c in chunks]
    return torch.cat(tensors, dim=-1)  # (1, T)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_module2(
    waveform: torch.Tensor,
    sr: int,
    enrolled_speaker_embedding: Optional[torch.Tensor] = None,
    model_name: str = _DEFAULT_MODEL,
) -> dict:
    """
    Run the full Module 2 pipeline on a single utterance.

    Args:
        waveform:
            (T,) or (1, T) float32 tensor, mono, at `sr` Hz.
            Expected: 16 kHz, ~4 s (64 000 samples) for anti-spoofing.
        sr:
            Sample rate in Hz. Must be 16 000 for the DL model.
        enrolled_speaker_embedding:
            Optional (192,) tensor from speaker_verification.enroll_speaker().
            If provided, score_speaker is computed; otherwise None is returned.
        model_name:
            "rawnet2" or "aasist". Defaults to MODULE2_MODEL env var or "rawnet2".

    Returns:
        {
            "score_acoustic":  float,        # spoof prob from DL model [0,1]
                                             # 1.0 = definitely spoof
            "score_prosody":   float,        # heuristic prosodic spoof score [0,1]
            "score_speaker":   float | None, # (cosine+1)/2 vs enrolled, or None
            "raw_features":    dict,         # 13 flat scalar features:
                                             #   acoustic: spectral_rolloff,
                                             #     phase_consistency,
                                             #     harmonic_structure,
                                             #     vocoder_artifact_2_4khz
                                             #   prosodic: f0_mean, f0_std,
                                             #     f0_range, jitter_local,
                                             #     shimmer_local, pause_count,
                                             #     pause_mean_dur_s,
                                             #     pause_total_ratio,
                                             #     speech_rate_syl_per_s
        }
    """
    # ---- 1. DL anti-spoofing score ----------------------------------------
    model = _load_model(model_name)

    wav = waveform.float()
    if wav.dim() == 1:
        wav = wav.unsqueeze(0)          # (1, T)

    with torch.no_grad():
        logits, embedding = model(wav)  # (1, 2), (1, D)

    spoof_prob = float(F.softmax(logits, dim=-1)[0, 1].item())  # class 1 = spoof

    # ---- 2. Acoustic features ---------------------------------------------
    acoustic = extract_acoustic_features(waveform, sr)

    # ---- 3. Prosodic features ---------------------------------------------
    prosodic = extract_prosodic_features(waveform, sr)

    # ---- 4. Speaker score (optional) --------------------------------------
    if enrolled_speaker_embedding is not None:
        live_emb     = _embed(wav.squeeze(0))
        speaker_score: Optional[float] = score_speaker(live_emb, enrolled_speaker_embedding)
    else:
        speaker_score = None

    # ---- 5. Assemble output -----------------------------------------------
    return {
        "score_acoustic": spoof_prob,
        "score_prosody":  _prosodic_spoof_score(prosodic),
        "score_speaker":  speaker_score,
        "raw_features":   {**acoustic, **prosodic},
    }


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import math

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S",
    )

    SR = 16_000
    T  = SR * 4

    def _synth_tone(f0: float, seed: int = 0) -> torch.Tensor:
        rng = torch.Generator().manual_seed(seed)
        t   = torch.linspace(0, T / SR, T)
        return (
            0.4 * torch.sin(2 * math.pi * f0 * t)
          + 0.25 * torch.sin(2 * math.pi * 2 * f0 * t)
          + 0.15 * torch.sin(2 * math.pi * 3 * f0 * t)
          + 0.02 * torch.randn(T, generator=rng)
        )

    dummy = _synth_tone(f0=150.0, seed=42)

    print("=" * 60)
    print(f"Model : {_DEFAULT_MODEL}")
    print(f"Input : shape={list(dummy.shape)}, sr={SR}")
    print("=" * 60)

    # --- Without speaker enrollment ---
    result = run_module2(dummy, SR)
    print("\n[No enrollment]")
    print(f"  score_acoustic  : {result['score_acoustic']:.4f}")
    print(f"  score_prosody   : {result['score_prosody']:.4f}")
    print(f"  score_speaker   : {result['score_speaker']}")
    print("  raw_features:")
    for k, v in result["raw_features"].items():
        print(f"    {k:<30s}: {v:.4f}")

    # --- With speaker enrollment ---
    from speaker_verification import enroll_speaker
    enroll_wav = _synth_tone(f0=150.0, seed=1)
    enrolled   = enroll_speaker([enroll_wav])

    result2 = run_module2(dummy, SR, enrolled_speaker_embedding=enrolled)
    print(f"\n[With enrollment]")
    print(f"  score_acoustic  : {result2['score_acoustic']:.4f}")
    print(f"  score_prosody   : {result2['score_prosody']:.4f}")
    print(f"  score_speaker   : {result2['score_speaker']:.4f}")
    print("=" * 60)
