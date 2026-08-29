# System Patterns — VeriVox / model/

## Planned Directory Layout (model/)
```
model/
├── architectures/       — RawNet2, AASIST, ECAPA-TDNN model definitions
├── train/               — training scripts, loss functions, optimizers
├── inference/           — inference wrappers, ONNX export scripts
├── eval/                — EER, t-DCF, scoring utilities
├── checkpoints/         — saved .pt model weights (gitignored)
├── onnx/                — exported .onnx artifacts (gitignored)
├── configs/             — YAML/JSON hyperparameter configs
└── README.md
```

## Interface Contracts

### Input (from ingestion/)
- 16 kHz mono PCM audio segments as `torch.Tensor` of shape `(1, T)` or `(B, T)`
- Segment length: typically 4 s (64 000 samples) for anti-spoofing

### Output (to backend/)
- Anti-spoofing score: `float` in `[0, 1]` — 1 = spoof, 0 = genuine
- Speaker embedding: `np.ndarray` of shape `(192,)` for ECAPA-TDNN
- ONNX model files with documented input/output node names

## Training Conventions
- Config-driven: all hyperparameters in `configs/`
- Reproducibility: seed everything (`torch.manual_seed`, `torchaudio`, `numpy`)
- Checkpointing: save best EER checkpoint + last epoch checkpoint
- Logging: use Python `logging` module; optionally TensorBoard

## ONNX Export Rules
- Export with `opset_version=17`
- Always verify exported model with `onnxruntime` before handing to backend
- Document input/output node names in `onnx/README.md`

## Code Style
- Type hints on all public functions
- No global state — pass config objects explicitly
- Keep model definitions pure (no training logic inside `nn.Module`)
