"""
Speaker verification for VeriVox (Module 2).

Uses SpeechBrain's pretrained ECAPA-TDNN model (spkrec-ecapa-voxceleb) to
extract 192-dim speaker embeddings, then scores a live utterance against an
enrolled speaker profile via cosine similarity.

Interfaces
----------
enroll_speaker(genuine_samples)  -> torch.Tensor  shape (192,)
score_speaker(live_emb, enrolled_emb) -> float in [0, 1]
is_mismatch(score) -> bool

The model is loaded once at module level (lazy, on first call) and cached
so repeated calls within the same process pay no reload cost.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

import torch

# Disable symlinks in HuggingFace Hub cache — required on Windows without
# Developer Mode enabled (symlink creation needs elevated privileges).
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("HUGGINGFACE_HUB_VERBOSITY", "warning")
import torch.nn.functional as F

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Threshold
# ---------------------------------------------------------------------------

# TODO: confirm with Atharv (backend) and Harsh (datasets) once real
#       speaker-verification EER results are available on ASVspoof/VoxCeleb.
#       0.75 is a conservative starting point — lower = stricter.
SIMILARITY_THRESHOLD: float = 0.75

# SpeechBrain model identifier and local cache directory
_MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"
_SAVEDIR      = str(Path(__file__).resolve().parent / ".speechbrain_cache")

# ---------------------------------------------------------------------------
# Model loader (cached — loaded once per process)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_encoder():
    """
    Load and return the pretrained ECAPA-TDNN EncoderClassifier.
    Downloads weights on first call (~80 MB), then uses local cache.
    """
    from speechbrain.inference.speaker import EncoderClassifier
    from speechbrain.utils.fetching import LocalStrategy
    log.info("Loading ECAPA-TDNN from %s ...", _MODEL_SOURCE)
    encoder = EncoderClassifier.from_hparams(
        source=_MODEL_SOURCE,
        savedir=_SAVEDIR,
        run_opts={"device": "cpu"},
        local_strategy=LocalStrategy.COPY,
    )
    encoder.eval()
    log.info("ECAPA-TDNN loaded.")
    return encoder


# ---------------------------------------------------------------------------
# Internal: extract a single embedding from one waveform
# ---------------------------------------------------------------------------

def _embed(waveform: torch.Tensor) -> torch.Tensor:
    """
    Extract a 192-dim L2-normalised speaker embedding from a waveform.

    Args:
        waveform: (T,) or (1, T) float32 tensor at 16 kHz.

    Returns:
        embedding: (192,) float32 tensor, L2-normalised.
    """
    encoder = _get_encoder()

    wav = waveform.float()
    if wav.dim() == 1:
        wav = wav.unsqueeze(0)          # (1, T)
    if wav.dim() == 3:
        wav = wav.squeeze(0)            # (1, T)

    wav_lens = torch.tensor([1.0])      # relative length = full utterance

    with torch.no_grad():
        emb = encoder.encode_batch(wav, wav_lens)   # (1, 1, 192)

    emb = emb.squeeze()                             # (192,)
    return F.normalize(emb, dim=0)                  # L2-normalise


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def enroll_speaker(genuine_samples: list[torch.Tensor]) -> torch.Tensor:
    """
    Build an enrollment embedding for a speaker from one or more utterances.

    Extracts an ECAPA-TDNN embedding per sample, averages them, then
    re-normalises. Averaging in embedding space is standard practice for
    multi-utterance enrollment — it reduces per-utterance noise while
    preserving speaker identity direction.

    Args:
        genuine_samples: list of (T,) or (1, T) waveform tensors at 16 kHz.
                         At least one sample required.

    Returns:
        enrollment_embedding: (192,) float32 tensor, L2-normalised.

    Raises:
        ValueError: if genuine_samples is empty.
    """
    if not genuine_samples:
        raise ValueError("genuine_samples must contain at least one waveform.")

    embeddings = torch.stack([_embed(w) for w in genuine_samples])  # (N, 192)
    mean_emb   = embeddings.mean(dim=0)                              # (192,)
    return F.normalize(mean_emb, dim=0)                              # re-normalise


def score_speaker(
    live_embedding: torch.Tensor,
    enrolled_embedding: torch.Tensor,
) -> float:
    """
    Compute a speaker similarity score between a live and enrolled embedding.

    Scoring formula:
        score = (cosine_similarity + 1) / 2

    Rationale: raw cosine similarity is in [-1, 1].
      - Same speaker → cosine ~ +1 → score ~ 1.0
      - Unrelated speaker → cosine ~ 0 → score ~ 0.5
      - Opposite direction (adversarial) → cosine ~ -1 → score ~ 0.0
    Mapping to [0, 1] makes the score directly interpretable as a
    probability-like confidence and compatible with the backend's
    0–1 trust-score range.

    Args:
        live_embedding:     (192,) embedding from the live utterance.
        enrolled_embedding: (192,) enrollment embedding from enroll_speaker().

    Returns:
        score: float in [0, 1]. Higher = more likely same speaker.
    """
    live = F.normalize(live_embedding.float().flatten(), dim=0)
    enrl = F.normalize(enrolled_embedding.float().flatten(), dim=0)
    cosine = torch.dot(live, enrl).item()           # scalar in [-1, 1]
    return (cosine + 1.0) / 2.0                     # map to [0, 1]


def is_mismatch(score: float) -> bool:
    """
    Return True if the speaker score is below SIMILARITY_THRESHOLD,
    indicating the live utterance does NOT match the enrolled speaker.

    Args:
        score: output of score_speaker(), float in [0, 1].

    Returns:
        True  → speaker mismatch (reject / flag)
        False → speaker match   (accept)
    """
    return score < SIMILARITY_THRESHOLD


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import math

    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")

    SR = 16_000
    T  = SR * 3   # 3-second utterances

    print("Generating synthetic test signals ...")
    rng = torch.Generator().manual_seed(7)

    def _synth(f0: float, noise_scale: float = 0.02) -> torch.Tensor:
        """Voiced tone at f0 Hz + small noise — stand-in for a speaker."""
        t = torch.linspace(0, T / SR, T)
        sig = (
            0.4 * torch.sin(2 * math.pi * f0 * t)
          + 0.25 * torch.sin(2 * math.pi * 2 * f0 * t)
          + 0.15 * torch.sin(2 * math.pi * 3 * f0 * t)
          + noise_scale * torch.randn(T, generator=rng)
        )
        return sig

    # Speaker A: two enrollment samples (slightly different noise realisations)
    enroll_a1 = _synth(f0=150.0, noise_scale=0.02)
    enroll_a2 = _synth(f0=150.0, noise_scale=0.02)

    # Speaker B: different F0 (different "speaker")
    sample_b  = _synth(f0=250.0, noise_scale=0.02)

    # Live utterance from Speaker A
    live_a    = _synth(f0=150.0, noise_scale=0.03)

    print("\nEnrolling Speaker A from 2 samples ...")
    enrolled_a = enroll_speaker([enroll_a1, enroll_a2])
    print(f"  Enrollment embedding shape : {list(enrolled_a.shape)}")
    print(f"  Embedding L2 norm          : {enrolled_a.norm().item():.4f}")

    print("\nExtracting live embeddings ...")
    live_emb_a = _embed(live_a)
    live_emb_b = _embed(sample_b)

    score_same    = score_speaker(live_emb_a, enrolled_a)
    score_diff    = score_speaker(live_emb_b, enrolled_a)

    print(f"\nScore (Speaker A vs enrolled A) : {score_same:.4f}  "
          f"mismatch={is_mismatch(score_same)}")
    print(f"Score (Speaker B vs enrolled A) : {score_diff:.4f}  "
          f"mismatch={is_mismatch(score_diff)}")
    print(f"\nSIMILARITY_THRESHOLD = {SIMILARITY_THRESHOLD}")
    print("Demo complete.")
