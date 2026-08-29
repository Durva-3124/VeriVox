"""
ONNX export for VeriVox Module 2 anti-spoofing model.

Exports a trained RawNet2 (or AASIST) checkpoint to ONNX opset 17 with
dynamic batch and time axes, then verifies the exported model with
onnxruntime.

Usage:
    # Export RawNet2 (default)
    python model/export/export_onnx.py

    # Export AASIST
    python model/export/export_onnx.py --model aasist

    # Custom checkpoint / output path
    python model/export/export_onnx.py \
        --model    rawnet2 \
        --ckpt     model/training/checkpoints/best_eer_rawnet2.pt \
        --out      model/export/rawnet2.onnx

Output nodes (same for both models):
    Input  : "waveform"   shape (batch, time)   float32
    Output : "logits"     shape (batch, 2)       float32
             "embedding"  shape (batch, emb_dim) float32
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import torch

# Make model/ importable regardless of cwd
_MODEL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_MODEL_DIR))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_model(model_name: str, ckpt_path: Path) -> torch.nn.Module:
    if model_name == "rawnet2":
        from rawnet2 import RawNet2
        model = RawNet2()
    elif model_name == "aasist":
        from aasist import AASISTModel
        model = AASISTModel()
    else:
        raise ValueError(f"Unknown model '{model_name}'. Choose: rawnet2 | aasist")

    if not ckpt_path.exists():
        raise FileNotFoundError(
            f"Checkpoint not found: {ckpt_path}\n"
            "Run training first: python model/training/train.py --model "
            f"{model_name} ..."
        )

    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=True)
    model.load_state_dict(ckpt["model_state"])
    print(f"Loaded : {ckpt_path.name}  (epoch {ckpt['epoch']}, val_eer={ckpt['val_eer']:.4f})")
    model.eval()
    return model


def _export(model: torch.nn.Module, out_path: Path, dummy: torch.Tensor) -> None:
    """Export model to ONNX with dynamic batch and time axes."""
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Use the legacy TorchScript-based exporter (dynamo=False).
    # The new dynamo exporter (default in torch 2.9+) requires dynamic_shapes
    # instead of dynamic_axes and does not yet handle GRU + SincConv tracing
    # reliably. The legacy path is stable, well-tested, and sufficient for
    # opset 17 export.
    torch.onnx.export(
        model,
        dummy,
        str(out_path),
        opset_version=17,
        input_names=["waveform"],
        output_names=["logits", "embedding"],
        dynamic_axes={
            "waveform":  {0: "batch", 1: "time"},
            "logits":    {0: "batch"},
            "embedding": {0: "batch"},
        },
        do_constant_folding=True,
        dynamo=False,
    )
    print(f"Exported: {out_path}  ({out_path.stat().st_size / 1e6:.1f} MB)")


def _verify(out_path: Path, dummy: torch.Tensor, pt_logits: torch.Tensor, pt_emb: torch.Tensor) -> None:
    """Load the ONNX model with onnxruntime and compare outputs to PyTorch."""
    import onnxruntime as ort

    sess = ort.InferenceSession(str(out_path), providers=["CPUExecutionProvider"])

    inp_name = sess.get_inputs()[0].name
    ort_out  = sess.run(None, {inp_name: dummy.numpy()})
    ort_logits, ort_emb = ort_out[0], ort_out[1]

    # Shape checks
    assert list(ort_logits.shape) == list(pt_logits.shape), (
        f"Logits shape mismatch: ORT {ort_logits.shape} vs PT {pt_logits.shape}"
    )
    assert list(ort_emb.shape) == list(pt_emb.shape), (
        f"Embedding shape mismatch: ORT {ort_emb.shape} vs PT {pt_emb.shape}"
    )

    # Numerical closeness (atol 1e-4 is standard for fp32 ONNX export)
    np.testing.assert_allclose(
        ort_logits, pt_logits.numpy(), atol=1e-4,
        err_msg="Logits diverge between PyTorch and ONNX Runtime"
    )
    np.testing.assert_allclose(
        ort_emb, pt_emb.numpy(), atol=1e-4,
        err_msg="Embeddings diverge between PyTorch and ONNX Runtime"
    )

    # Print node names and shapes for Atharv's backend integration
    print("\nONNX node summary:")
    for inp in sess.get_inputs():
        print(f"  Input  '{inp.name}': shape={inp.shape}  dtype={inp.type}")
    for out in sess.get_outputs():
        print(f"  Output '{out.name}': shape={out.shape}  dtype={out.type}")

    print(f"\nPyTorch  logits : {list(pt_logits.shape)}  {pt_logits.numpy()}")
    print(f"ORT      logits : {list(ort_logits.shape)}  {ort_logits}")
    print(f"PyTorch  emb    : {list(pt_emb.shape)}")
    print(f"ORT      emb    : {list(ort_emb.shape)}")
    print("\nVerification passed — PyTorch and ONNX Runtime outputs match.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Export VeriVox anti-spoofing model to ONNX")
    p.add_argument("--model", default="rawnet2", choices=["rawnet2", "aasist"])
    p.add_argument(
        "--ckpt",
        type=Path,
        default=None,
        help="Path to .pt checkpoint. Defaults to model/training/checkpoints/best_eer_<model>.pt",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output .onnx path. Defaults to model/export/<model>.onnx",
    )
    p.add_argument(
        "--batch_size", type=int, default=1,
        help="Batch size for the dummy export tensor (default: 1)",
    )
    p.add_argument(
        "--clip_samples", type=int, default=64_000,
        help="Time dimension for the dummy tensor (default: 64000 = 4s @ 16kHz)",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    ckpt_dir = _MODEL_DIR / "training" / "checkpoints"
    ckpt_path = args.ckpt or ckpt_dir / f"best_eer_{args.model}.pt"
    out_path  = args.out  or _MODEL_DIR / "export" / f"{args.model}.onnx"

    print(f"Model     : {args.model}")
    print(f"Checkpoint: {ckpt_path}")
    print(f"Output    : {out_path}")
    print(f"Opset     : 17")
    print(f"Dummy     : ({args.batch_size}, {args.clip_samples})  [batch, time]")
    print()

    # Load model
    model = _load_model(args.model, ckpt_path)

    # Dummy input — (B, T) matching the forward() contract
    torch.manual_seed(0)
    dummy = torch.randn(args.batch_size, args.clip_samples)

    # PyTorch reference outputs (for numerical verification)
    with torch.no_grad():
        pt_logits, pt_emb = model(dummy)

    # Export
    _export(model, out_path, dummy)

    # Verify
    _verify(out_path, dummy, pt_logits, pt_emb)

    print(f"\nExport complete: {out_path}")


if __name__ == "__main__":
    main()
