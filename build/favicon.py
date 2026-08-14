"""Gera o favicon a partir do cerebro da hero.

O render tem 1400x1184 com quase metade de margem vazia e e feito de particulas
finas. Reduzido cru para 32 px ele vira uma mancha: sobra a silhueta, some o
brilho. Entao aqui a arte e recortada no proprio conteudo e reforcada em
contraste ANTES de encolher — o que sobrevive a 32 px e a silhueta do cerebro,
que e o que precisa ser lido.

Fundo TRANSPARENTE: o icone assenta na cor da aba, seja ela clara ou escura. O
preco e que em aba clara o dourado perde contorno, entao o realce aqui puxa para
o mais fechado do dourado em vez do mais aceso — e o que da borda ao cerebro
sobre branco sem apagar ele sobre preto.

Uso:
  python build/favicon.py
"""
import os

import numpy as np
from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(ROOT, "assets", "cerebro", "cerebro.webp")
ICONES = os.path.join(ROOT, "assets", "icones")

LADO = 512                # mestre; todo o resto sai daqui por reducao
OCUPACAO = 0.94           # quanto do quadro o cerebro ocupa


def recorta(im):
    """Caixa do que realmente tem tinta — a margem vazia e ~metade da imagem."""
    a = np.asarray(im)
    ys, xs = np.where(a[..., 3] > 24)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main():
    os.makedirs(ICONES, exist_ok=True)
    arte = recorta(Image.open(FONTE).convert("RGBA"))
    print(f"[ICONE] conteudo recortado: {arte.width}x{arte.height}")

    # Contraste e cor sobem ANTES da reducao: depois de 32 px nao ha mais o que
    # realcar, so ruido. O brilho DESCE junto — sem fundo escuro por tras, as
    # particulas mais claras encostavam no branco da aba e o contorno sumia.
    arte = ImageEnhance.Brightness(
        ImageEnhance.Color(
            ImageEnhance.Contrast(arte).enhance(1.30)).enhance(1.30)).enhance(0.88)

    escala = (LADO * OCUPACAO) / max(arte.width, arte.height)
    arte = arte.resize((max(1, round(arte.width * escala)),
                        max(1, round(arte.height * escala))), Image.LANCZOS)

    tile = Image.new("RGBA", (LADO, LADO), (0, 0, 0, 0))
    tile.paste(arte, ((LADO - arte.width) // 2, (LADO - arte.height) // 2), arte)

    for n in (512, 180):
        alvo = os.path.join(ICONES, f"favicon-{n}.png")
        tile.resize((n, n), Image.LANCZOS).save(alvo, optimize=True)
        print(f"[ICONE] {os.path.relpath(alvo, ROOT)}")

    # /favicon.ico na raiz: o navegador pede este caminho sozinho, sem <link>.
    # Era ele o 404 que aparecia no console.
    ico = os.path.join(ROOT, "favicon.ico")
    tile.resize((64, 64), Image.LANCZOS).save(
        ico, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f"[ICONE] favicon.ico  {os.path.getsize(ico) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
