"""
Codec and Channel Augmentation Package for VeriVox (Module: Datasets & Evaluation).
"""

from datasets.augmentation.channel_impairments import (
    apply_additive_noise,
    apply_network_jitter,
    apply_packet_loss,
    apply_reverberation_rir,
)
from datasets.augmentation.codecs import (
    apply_aac_mp3_simulation,
    apply_amr_nb_simulation,
    apply_amr_wb_simulation,
    apply_g711_alaw,
    apply_g711_ulaw,
    apply_gsm_simulation,
    apply_opus_simulation,
)
from datasets.augmentation.pipeline import (
    AVAILABLE_TRANSFORMS,
    CodecAugmentationPipeline,
)

__all__ = [
    "CodecAugmentationPipeline",
    "AVAILABLE_TRANSFORMS",
    "apply_g711_ulaw",
    "apply_g711_alaw",
    "apply_opus_simulation",
    "apply_aac_mp3_simulation",
    "apply_amr_nb_simulation",
    "apply_amr_wb_simulation",
    "apply_gsm_simulation",
    "apply_packet_loss",
    "apply_network_jitter",
    "apply_additive_noise",
    "apply_reverberation_rir",
]
