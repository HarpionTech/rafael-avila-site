"""Limpa o pé da lombada impressa do Mentalidade Blindada.

O selo é o ícone dourado que já existe em assets/icones — não um recorte do
mockup. Recortar do mockup trazia junto o papel bege e o borrão da perspectiva:
o selo saía sujo, e é a peça mais miúda da lombada, onde sujeira aparece mais.

Das três lombadas, só a de Mentalidade Blindada existe no mockup. As outras duas
são construídas aqui:

  fundo : a coluna da borda da capa, esticada. Não é branco genérico — sai na cor
          que aquela capa tem naquela altura, inclusive a faixa verde do pé do
          Relacionamentos, então lombada e capa se encontram sem degrau na quina.
  selo  : o ícone dourado, chaveado do fundo bege pela saturação. Dourado casa
          com a paleta da página e lê bem tanto no creme quanto no verde escuro.

Uso:
  python build/selo_ebook.py
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVROS = os.path.join(ROOT, "assets", "livros")
ICONE = os.path.join(ROOT, "assets", "icones",
                     "ChatGPT Image 8 de ago. de 2026, 13_06_22 (6).png")

LARG, ALT = 408, 1600
LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

# slug, fonte do fundo, razão, espessura, pé a limpar.
#
# Mentalidade é o único que tem lombada no mockup: o fundo dela é a arte
# rectificada, não a borda da capa. O selo impresso ali vem esticado, porque foi
# desenhado para um livro quase duas vezes mais grosso que este — então o pé é
# limpo e recebe o mesmo selo dourado dos outros dois, no mesmo tamanho relativo.
# Limpar sempre a mesma faixa mantém a operação repetível: rodar duas vezes dá o
# mesmo arquivo.
# Só o Mentalidade: é o único com lombada real (vinda do mockup). Os outros
# e-books passaram a ter lombada ESCRITA em canvas, via `lombadaTexto` no
# config.js — não há mais imagem a gerar para eles.
LIVROS_DIGITAIS = [
    ("mentalidade", "lombada-mentalidade.webp", 1.46, 0.16, 1400),
]


def log(m):
    print(f"[SELO] {m}")
    sys.stdout.flush()


def recorta_icone():
    """Ícone dourado sobre fundo bege -> RGBA cortado no próprio contorno.

    A chave é SÓ o dourado, e não o escuro. O escuro pega o contorno do ícone
    mas pega junto a sombra e a vinheta do fundo, que encostam nele: o recorte
    saía com uma franja rasgada em volta. O dourado forma um anel fechado em
    torno do documento — tapar os buracos desse anel devolve o miolo marrom, e
    uma dilatação curta recupera o contorno preto sem alcançar a sombra.

    O filete horizontal no alto da arte é outra peça: some por não ser a maior.
    """
    from scipy import ndimage

    a = np.asarray(Image.open(ICONE).convert("RGB"), dtype=np.float32)
    mx, mn = a.max(2), a.min(2)
    sat = np.where(mx > 1, (mx - mn) / np.maximum(mx, 1.0), 0.0)
    dourado = sat > 0.45

    rot, n = ndimage.label(ndimage.binary_closing(dourado, np.ones((5, 5))))
    if n == 0:
        raise SystemExit("[SELO] não achei o ícone")
    maior = 1 + int(np.argmax(ndimage.sum(dourado, rot, range(1, n + 1))))
    r = 4
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    cheio = ndimage.binary_dilation(ndimage.binary_fill_holes(rot == maior), x * x + y * y <= r * r)
    log(f"ícone: {n} peças na arte, fica a maior com {int(cheio.sum())} px")

    ys, xs = np.where(cheio)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    # Borda de 1 px suavizada: recorte duro serrilha os cantos arredondados.
    alfa = ndimage.gaussian_filter(cheio.astype(np.float32), 0.8)
    rgba = np.dstack([a, np.clip(alfa * 1.15, 0, 1) * 255.0])[y0:y1 + 1, x0:x1 + 1]
    log(f"ícone recortado em x[{x0},{x1}] y[{y0},{y1}]")
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), mode="RGBA")


def base_da_capa(arq, pe):
    """Fundo da lombada.

    Com `pe`, a fonte já É uma lombada (a rectificada do mockup): ela entra
    inteira e só o rodapé é apagado, para o selo impresso sair sem levar junto o
    título e o nome do autor. Sem `pe`, a lombada não existe em lugar nenhum e é
    construída da coluna da borda da capa, esticada na largura — assim a cor
    bate com a da capa em cada altura e a quina não ganha degrau.
    """
    im = Image.open(os.path.join(LIVROS, arq)).convert("RGB")
    if pe is not None:
        fundo = np.asarray(im.resize((LARG, ALT), Image.LANCZOS), dtype=np.float32)
        papel = np.median(fundo[pe - 90:pe - 10], axis=0)      # papel logo acima do pé
        fundo[pe:] = papel
        return fundo
    a = np.asarray(im, dtype=np.float32)
    col = a[:, :max(3, im.width // 90)].mean(axis=1)
    col = np.asarray(Image.fromarray(col[:, None].astype(np.uint8)).resize((1, ALT), Image.LANCZOS),
                     dtype=np.float32)
    return np.repeat(col, LARG, axis=1)


def largura_da_lombada(razao, espessura):
    """Largura da lombada, na mesma unidade do modelo (meia-altura 1).

    A lombada de assets/js/book-3d.js é plana, com barriga de 10% da meia-
    espessura — então a largura é a espessura cheia, com uma folga mínima pelo
    arco. É essa medida que diz quanto a UV vai comprimir a textura.
    """
    return 2.0 * espessura * (1.0 / razao) * 1.02


def assenta(fundo, icone, razao, espessura, pe=None):
    """Encaixa o selo no pé, na primeira janela de cor estável.

    O Relacionamentos tem uma tarja verde no pé mais baixa que o selo: encaixado
    no rodapé, metade dele cairia sobre a tarja e a outra sobre o creme.
    """
    # A textura é 408x1600, mas cobre uma lombada que tem ~5% da altura do livro
    # de largura: a UV comprime tudo umas 2x na horizontal. Desenhar o selo com a
    # proporção dele deixaria o ícone achatado no modelo. Então ele é desenhado
    # JÁ ESTICADO, pelo fator que a própria geometria vai comprimir de volta.
    Sw = largura_da_lombada(razao, espessura)
    Sh = 2.0                                   # o modelo tem meia-altura 1
    sw = int(LARG * 0.72)
    sh = int(sw * (icone.height / icone.width) * (Sw / LARG) * (ALT / Sh))
    log(f"lombada com {Sw:.3f} de arco -> selo {sw}x{sh} px na textura "
        f"(estica {(LARG / ALT) / (Sw / Sh):.2f}x)")
    sx = (LARG - sw) // 2
    lin = fundo[:, LARG // 2] @ LUMA

    # Pé já limpo: a posição é fixa, dentro da faixa apagada. Varrer aqui seria
    # pior — a faixa toda é da mesma cor, então qualquer altura empata.
    if pe is not None:
        sy = max(pe + 8, ALT - sh - int(ALT * 0.045))
        ic = np.asarray(icone.resize((sw, sh), Image.LANCZOS), dtype=np.float32)
        m = ic[..., 3:4] / 255.0
        fundo[sy:sy + sh, sx:sx + sw] = fundo[sy:sy + sh, sx:sx + sw] * (1 - m) + ic[..., :3] * m
        return sy, 0.0

    # Varre de baixo para cima e aceita a PRIMEIRA janela estável, não a mais
    # estável de todas: o selo pertence ao pé da lombada, e caçar o mínimo global
    # o empurrava para o meio só porque lá a cor variava um pouco menos.
    sy = ALT - sh - int(ALT * 0.045)
    melhor = (float(np.std(lin[sy:sy + sh])), sy)
    for topo in range(sy, int(ALT * 0.45), -12):
        dp = float(np.std(lin[topo:topo + sh]))
        if dp < melhor[0]:
            melhor = (dp, topo)
        if dp < 14:
            melhor = (dp, topo)
            break
    sy = melhor[1]

    ic = np.asarray(icone.resize((sw, sh), Image.LANCZOS), dtype=np.float32)
    m = ic[..., 3:4] / 255.0
    fundo[sy:sy + sh, sx:sx + sw] = fundo[sy:sy + sh, sx:sx + sw] * (1 - m) + ic[..., :3] * m
    return sy, melhor[0]


def main():
    for slug, capa, razao, espessura, pe in LIVROS_DIGITAIS:
        fundo = base_da_capa(capa, pe)
        saida = os.path.join(LIVROS, f"lombada-{slug}.webp")
        Image.fromarray(np.clip(fundo, 0, 255).astype(np.uint8)).save(saida, quality=92, method=6)
        log(f"{slug}: pé limpo -> {os.path.relpath(saida, ROOT)}  "
            f"{os.path.getsize(saida) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
