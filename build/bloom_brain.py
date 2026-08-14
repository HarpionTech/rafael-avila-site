"""Bloom em pos sobre o render do cerebro.

O Cycles entrega os pontos como pixels nitidos; o brilho difuso que faz o cerebro
parecer aceso nao existe no render. Somar copias borradas em varias escalas e o
que produz o halo — e e muito mais barato do que tentar resolve-lo em samples.

Uso:
  python build/bloom_brain.py [--strength 1.5] [--threshold 0.30]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "cerebro", "cerebro.png")
OUT = os.path.join(ROOT, "assets", "cerebro", "cerebro-glow.png")

# escalas do bloom: raio do blur x peso. As tres juntas dao o halo curto junto do
# ponto e o brilho largo que envolve o cerebro inteiro.
SCALES = ((3, 0.55), (9, 0.42), (26, 0.34), (70, 0.26))
TINT = np.array([1.0, 0.74, 0.34], dtype=np.float32)


def arg(flag, default):
    return float(sys.argv[sys.argv.index(flag) + 1]) if flag in sys.argv else default


def main():
    strength = arg("--strength", 1.5)
    threshold = arg("--threshold", 0.30)

    img = Image.open(SRC).convert("RGBA")
    rgb = np.asarray(img).astype(np.float32) / 255.0
    alpha = rgb[..., 3:4]
    rgb = rgb[..., :3]

    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mask = np.clip((lum - threshold) / max(1e-3, 1 - threshold), 0, 1)[..., None]
    bright = rgb * mask

    glow = np.zeros_like(rgb)
    for radius, weight in SCALES:
        blurred = Image.fromarray((np.clip(bright, 0, 1) * 255).astype(np.uint8)) \
            .filter(ImageFilter.GaussianBlur(radius))
        glow += np.asarray(blurred).astype(np.float32) / 255.0 * weight

    out = rgb + glow * strength * TINT
    out = out / (1.0 + out * 0.35)          # rolloff suave, evita chapar em branco
    out = np.clip(out * 1.25, 0, 1)

    # O bloom precisa aparecer FORA da silhueta: o alpha herda o brilho espalhado,
    # senao o halo fica recortado na borda do cerebro.
    glow_a = np.clip(glow.max(axis=2, keepdims=True) * strength * 1.4, 0, 1)
    alpha = np.clip(np.maximum(alpha, glow_a), 0, 1)

    rgba = np.concatenate([out, alpha], axis=2)
    Image.fromarray((rgba * 255).astype(np.uint8)).save(OUT)
    print(f"[BLOOM] {os.path.relpath(OUT, ROOT)}  strength={strength} threshold={threshold}")


if __name__ == "__main__":
    main()
