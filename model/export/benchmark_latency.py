"""
ONNX Runtime latency benchmark for VeriVox Module 2.

Measures inference latency on a 200 ms audio chunk (3 200 samples @ 16 kHz),
matching Trisha's Module 1 windowing spec, and reports p50 / p95 against the
<50 ms/chunk real-time target from the project proposal.

Usage:
    python model/export/benchmark_latency.py
    python model/export/benchmark_latency.py --onnx model/export/rawnet2.onnx
    python model/export/benchmark_latency.py --onnx model/export/rawnet2.onnx --runs 500
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort

# ---------------------------------------------------------------------------
# Constants matching the project spec
# ---------------------------------------------------------------------------

SAMPLE_RATE      = 16_000
WINDOW_MS        = 200                          # Trisha's Module 1 window
WINDOW_SAMPLES   = int(SAMPLE_RATE * WINDOW_MS / 1000)   # 3 200
LATENCY_TARGET_MS = 50.0                        # from project proposal
WARMUP_RUNS      = 10


# ---------------------------------------------------------------------------
# Benchmark
# ---------------------------------------------------------------------------

def benchmark(
    onnx_path: Path,
    total_runs: int = 200,
    batch_size: int = 1,
) -> dict[str, float]:
    """
    Run inference `total_runs` times, discard first WARMUP_RUNS, return stats.

    Returns dict with keys:
        p50_ms, p95_ms, mean_ms, min_ms, max_ms, window_samples, window_ms
    """
    if not onnx_path.exists():
        raise FileNotFoundError(
            f"ONNX model not found: {onnx_path}\n"
            "Run model/export/export_onnx.py first."
        )

    sess_opts = ort.SessionOptions()
    sess_opts.intra_op_num_threads = 1   # single-thread: matches edge deployment
    sess_opts.inter_op_num_threads = 1
    sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    sess = ort.InferenceSession(
        str(onnx_path),
        sess_options=sess_opts,
        providers=["CPUExecutionProvider"],
    )

    inp_name  = sess.get_inputs()[0].name
    inp_shape = sess.get_inputs()[0].shape   # ['batch', 'time'] — dynamic

    # Fixed random chunk: (batch, 3200)
    rng   = np.random.default_rng(0)
    chunk = rng.standard_normal((batch_size, WINDOW_SAMPLES)).astype(np.float32)

    latencies_ms: list[float] = []

    for i in range(total_runs):
        t0 = time.perf_counter()
        sess.run(None, {inp_name: chunk})
        t1 = time.perf_counter()

        if i >= WARMUP_RUNS:
            latencies_ms.append((t1 - t0) * 1000.0)

    arr = np.array(latencies_ms)
    return {
        "p50_ms":         float(np.percentile(arr, 50)),
        "p95_ms":         float(np.percentile(arr, 95)),
        "mean_ms":        float(arr.mean()),
        "min_ms":         float(arr.min()),
        "max_ms":         float(arr.max()),
        "window_samples": WINDOW_SAMPLES,
        "window_ms":      WINDOW_MS,
        "measured_runs":  len(latencies_ms),
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    default_onnx = Path(__file__).resolve().parent / "rawnet2.onnx"
    p = argparse.ArgumentParser(description="VeriVox ONNX latency benchmark")
    p.add_argument(
        "--onnx", type=Path, default=default_onnx,
        help=f"Path to exported .onnx file (default: {default_onnx})",
    )
    p.add_argument(
        "--runs", type=int, default=200,
        help="Total inference runs including warmup (default: 200)",
    )
    p.add_argument(
        "--batch_size", type=int, default=1,
        help="Batch size per inference call (default: 1)",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    print("=" * 54)
    print("VeriVox Module 2 — ONNX Latency Benchmark")
    print("=" * 54)
    print(f"Model       : {args.onnx}")
    print(f"Window      : {WINDOW_MS} ms  ({WINDOW_SAMPLES} samples @ {SAMPLE_RATE} Hz)")
    print(f"Batch size  : {args.batch_size}")
    print(f"Total runs  : {args.runs}  (first {WARMUP_RUNS} discarded as warmup)")
    print(f"Target      : p50 < {LATENCY_TARGET_MS:.0f} ms/chunk")
    print()

    stats = benchmark(args.onnx, total_runs=args.runs, batch_size=args.batch_size)

    print(f"Results ({stats['measured_runs']} measured runs):")
    print(f"  p50   : {stats['p50_ms']:7.2f} ms")
    print(f"  p95   : {stats['p95_ms']:7.2f} ms")
    print(f"  mean  : {stats['mean_ms']:7.2f} ms")
    print(f"  min   : {stats['min_ms']:7.2f} ms")
    print(f"  max   : {stats['max_ms']:7.2f} ms")
    print()

    p50_pass = stats["p50_ms"] < LATENCY_TARGET_MS
    p95_pass = stats["p95_ms"] < LATENCY_TARGET_MS

    print(f"  p50 < {LATENCY_TARGET_MS:.0f} ms : {'PASS' if p50_pass else 'FAIL'}  ({stats['p50_ms']:.2f} ms)")
    print(f"  p95 < {LATENCY_TARGET_MS:.0f} ms : {'PASS' if p95_pass else 'FAIL'}  ({stats['p95_ms']:.2f} ms)")
    print("=" * 54)

    if not p50_pass:
        print(
            "NOTE: p50 exceeds target. Consider:\n"
            "  - Quantising the ONNX model (int8) with onnxruntime quantisation tools\n"
            "  - Reducing GRU layers or hidden size in rawnet2.py\n"
            "  - Using AASIST (194K params vs 22M) for lower-latency deployment"
        )


if __name__ == "__main__":
    main()
