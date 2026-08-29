# Tech Context — VeriVox / model/

## Pinned Stack
| Package | Version |
|---|---|
| Python | 3.10.13 |
| torch | 2.2.1 |
| torchaudio | 2.2.1 (pinned) / 2.11 (actual — uses soundfile for audio loading, bypasses torchcodec) |
| speechbrain | 1.1.1 (upgraded from 0.5.16 — 0.5.16 incompatible with torchaudio 2.x, calls removed `set_audio_backend`) |
| onnxruntime | 1.17.x |

## Key Libraries
| Library | Role |
|---|---|
| `torch` / `torchaudio` | Model definition, training loop, resampling (torchaudio.functional) |
| `soundfile` | WAV loading in Dataset — bypasses torchcodec requirement in torchaudio 2.9+ |
| `speechbrain` | ECAPA-TDNN speaker embeddings (pretrained `spkrec-ecapa-voxceleb`) |
| `resemblyzer` | Lightweight speaker d-vector alternative |
| `onnxruntime` | Production inference (exported models consumed by backend) |

## Feature Extraction
- Raw waveform → RawNet2 / AASIST (no hand-crafted features needed)
- Raw waveform → log-Mel filterbank → ECAPA-TDNN (SpeechBrain handles internally)
- Sample rate: 16 kHz (ASVspoof standard)

## Model Delivery Format
- Training: `.pt` / `.pth` checkpoints
- Production: `.onnx` exported models → handed to `backend/`

## Dev Environment
- OS: Windows
- Working folder: `model/`
- IDE: VS Code / Cursor with Amazon Q Developer
