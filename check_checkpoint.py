import sys
import torch

sys.path.insert(0, "model")
from rawnet2 import RawNet2

ckpt = torch.load(
    "model/training/checkpoints/best_eer_rawnet2.pt",
    map_location="cpu",
    weights_only=True,
)
print("Saved at epoch :", ckpt["epoch"])
print("Val EER        :", ckpt["val_eer"])
print("Train args     :", ckpt["args"])

model = RawNet2()
missing, unexpected = model.load_state_dict(ckpt["model_state"], strict=True)
print("Missing keys   :", missing)
print("Unexpected keys:", unexpected)

model.eval()
dummy = torch.randn(1, 64_000)
with torch.no_grad():
    logits, emb = model(dummy)

print("Logits shape   :", list(logits.shape))
print("Embedding shape:", list(emb.shape))
print("Spoof prob     :", round(torch.softmax(logits, dim=-1)[0, 1].item(), 4))
print("Checkpoint OK")
