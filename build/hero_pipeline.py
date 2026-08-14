"""Gera as variantes da foto da hero a partir de uma master em alta resolucao.

A foto original tem 1672x941 — insuficiente para uma hero full-bleed em 1440p ou
4K. A master vem do Real-ESRGAN (6688x3764) e este script produz a piramide que o
CSS serve por largura de tela x densidade.

ORDEM IMPORTA: correcao tonal na master, depois reduz, e so entao nitidez e grao.
Fazer nitidez antes de reduzir amplia o halo do unsharp; fazer grao antes vira
ruido grosso. Foi exatamente esse erro que fazia a hero parecer mal renderizada.

Serve tambem para o fundo das secoes (--prefix bg). O fundo nasce mais claro que
a hero, entao aceita um gamma proprio: forcar 0.62 nele lavaria a parede.

Uso:
  python build/hero_pipeline.py --master caminho/master.png [--prefix hero] [--gamma 0.62]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")

# largura -> (raio do unsharp, intensidade, sigma do grao)
# Quanto maior a variante, mais raio o unsharp precisa para o detalhe aparecer,
# e menos grao, porque em tela densa o grao fino ja some sozinho.
VARIANTS = {
    1280: (1.2, 0.34, 0.9),
    1920: (1.5, 0.38, 0.8),
    2560: (1.9, 0.42, 0.7),
    3840: (2.6, 0.48, 0.6),
    5120: (3.2, 0.52, 0.5),
}
QUALITY = {1280: 92, 1920: 90, 2560: 88, 3840: 84, 5120: 80}


def grade(img, gamma=0.62, sat=1.55, contrast=1.18):
    """Correcao tonal — na master, antes de qualquer reducao.

    A foto nasce com quase tudo abaixo de 15% de luminancia e a pagina virava um
    retangulo preto. O gamma abre a estante, a planta e o couro sem lavar o preto.
    """
    a = np.asarray(img).astype(np.float32) / 255.0
    a = np.power(a, gamma)
    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    a = np.clip(lum[..., None] + (a - lum[..., None]) * sat, 0, 1)    # satura
    a = np.clip((a - 0.5) * contrast + 0.5, 0, 1)                     # contraste em S
    return Image.fromarray((a * 255).astype(np.uint8))


def finish(img, radius, amount, grain, seed=7):
    """Nitidez e grao — sempre na resolucao FINAL de cada variante."""
    a = np.asarray(img).astype(np.float32) / 255.0
    blur = np.asarray(img.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255.0
    a = np.clip(a + (a - blur) * amount, 0, 1) * 255.0
    a += np.random.default_rng(seed).normal(0, grain, a.shape)   # quebra o banding
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def main():
    argv = sys.argv[1:]
    master_path = argv[argv.index("--master") + 1] if "--master" in argv else os.path.join(ROOT, "assets", "hero.png")
    prefix = argv[argv.index("--prefix") + 1] if "--prefix" in argv else "hero"
    gamma = float(argv[argv.index("--gamma") + 1]) if "--gamma" in argv else 0.62

    master = Image.open(master_path).convert("RGB")
    print(f"[{prefix.upper()}] master {master.size[0]}x{master.size[1]}  {os.path.basename(master_path)}")
    graded = grade(master, gamma)

    total = 0
    for width, (radius, amount, grain) in sorted(VARIANTS.items()):
        if width > master.width:
            # Sem pixel real para essa largura: gerar so aumentaria o peso.
            print(f"[{prefix.upper()}] {width}px  pulado (master tem {master.width}px)")
            continue
        height = round(width * master.height / master.width)
        small = graded.resize((width, height), Image.LANCZOS)
        out = os.path.join(OUT, f"{prefix}-{width}.webp")
        finish(small, radius, amount, grain).save(out, "WEBP", quality=QUALITY[width], method=6)
        size = os.path.getsize(out) / 1024
        total += size
        print(f"[{prefix.upper()}] {width}x{height}  {size:.0f} KB  q={QUALITY[width]}")
    print(f"[{prefix.upper()}] total {total/1024:.1f} MB (o navegador baixa UMA delas)")


if __name__ == "__main__":
    main()
