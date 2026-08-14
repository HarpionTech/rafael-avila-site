"""Extrai a arte PLANA de cada face a partir dos mockups de estudio, por homografia.

O mockup e a projecao de um livro real: capa e lombada estao em perspectiva.
Desfazer essa perspectiva devolve a arte original de cada face — e e o unico jeito
de o modelo 3D herdar a lombada escrita, que era o que faltava.

Os mockups NAO tem a mesma pose:
  livro (2)          — lombada a esquerda, com texto. Unica com arte de lombada.
  livro (1)          — lombada a esquerda, branca e lisa.
  livro (3)          — espelhado: o que aparece a direita e o corte das folhas.
  autoconfianca      — quase de frente, capa preta, corte das folhas visivel.
Por isso cada um declara de que lado esta o vinco interno (`lado`).

Detectado sozinho : silhueta (esquerda, direita, base e, quando nao ha face de
topo visivel, o topo) por ajuste de reta com minimos quadrados totais sobre o
canal alfa — e a borda do objeto, tem contraste de sobra.
Dado a mao : o vinco da dobra, a aresta superior da capa e, quando o corte das
folhas aparece, a aresta externa (`corte`). Sao encontros de duas superficies de
tom parecido, sem contraste estavel entre as imagens; sao 2 a 6 numeros por
livro, conferidos na sobreposicao que --debug gera.

Uso:
  python build/rectify_mockup.py --debug   # sobreposicao de conferencia
  python build/rectify_mockup.py           # gera as texturas planas
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "assets", "livros")

CFG = {
    "livro (2).png": dict(
        slug="mentalidade", lado="esq",
        dobra=[(199, 300), (205, 1200)],
        # a unica com face de topo larga o bastante para a silhueta nao servir:
        # reta ajustada sobre onde a capa comeca, medida em 5 colunas
        topo=[(188, 186), (948, 85)],
        lombada=(82, 172),          # faixa em x da face plana da lombada
    ),
    "livro (1).png": dict(
        slug="relacionamentos", lado="esq",
        dobra=[(306, 200), (306, 900)],
        topo=None,                  # face de topo com ~5 px: a silhueta ja e a capa
        lombada=None,               # lombada branca lisa: o shader pinta
    ),
    "livro-autoconfianca-corrigida.png": dict(
        slug="autoconfianca", lado="esq",
        # o livro esta quase de frente: a lombada e uma tira de ~25 px
        dobra=[(122, 150), (128, 1300)],
        # A silhueta NAO serve como aresta direita aqui, e isso nao e defeito do
        # recorte: o corte das folhas E parte do livro, entao qualquer silhueta
        # honesta vai alem da capa. A direita da arte a ordem e capa (ate ~880),
        # folhas claras (884..916, luminancia ~220) e o canto da contracapa
        # (920..940). Sem esta reta os 37 px de folha entravam na textura da CAPA,
        # e o livro 3D ganhava uma faixa branca no flanco.
        corte=[(883, 210), (880, 1110)],
        topo=None,
        lombada=None,
    ),
    "livro (3).png": dict(
        slug="autoterapia", lado="dir",
        dobra=[(906, 200), (906, 1000)],
        topo=None,
        lombada=None,
    ),
}


def log(m):
    print(f"[RECT] {m}")
    sys.stdout.flush()


def reta(pts):
    """Reta ax + by + c = 0 por minimos quadrados totais (aguenta quase-vertical)."""
    p = np.asarray(pts, dtype=np.float64)
    c = p.mean(0)
    _, _, vt = np.linalg.svd(p - c)
    d = vt[0]
    return np.array([-d[1], d[0], -(-d[1] * c[0] + d[0] * c[1])])


def cruza(l1, l2):
    p = np.cross(l1, l2)
    if abs(p[2]) < 1e-9:
        raise ValueError("retas paralelas")
    return np.array([p[0] / p[2], p[1] / p[2]])


def encolhe(quad, fx, fy):
    """Recolhe o quadrilatero para dentro, em fracao dos proprios lados.

    Os vincos sao arredondados: o ultimo par de pixels de cada borda ja e a
    curvatura da capa, e sem essa margem ela entra na textura como uma listra
    escura no meio da face plana.
    """
    q = np.asarray(quad, dtype=np.float64)
    u = ((q[1] - q[0]) + (q[2] - q[3])) / 2      # eixo horizontal medio
    v = ((q[3] - q[0]) + (q[2] - q[1])) / 2      # eixo vertical medio
    d = [fx * u + fy * v, -fx * u + fy * v, -fx * u - fy * v, fx * u - fy * v]
    return [q[i] + d[i] for i in range(4)]


def realca(arr, sigma, forca):
    """Máscara de nitidez SÓ no eixo x.

    A lombada aparece de lado no mockup: são ~100 px reais esticados para 400.
    O eixo y não perdeu nada — realçar os dois abriria halo em volta de um texto
    que já estava nítido na vertical.
    """
    r = max(1, int(round(sigma * 3)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.pad(arr, ((0, 0), (r, r), (0, 0)), mode="edge")
    blur = np.zeros_like(arr)
    for i, w in enumerate(k):
        blur += w * pad[:, i:i + arr.shape[1], :]
    return np.clip(arr + forca * (arr - blur), 0, 255)


def nivel(im, p=88):
    """Nivel do papel, por canal: percentil alto ignora o texto e pega o fundo."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    return np.percentile(a.reshape(-1, 3), p, axis=0)


def homografia(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([-x, -y, -1, 0, 0, 0, u * x, u * y, u])
        A.append([0, 0, 0, -x, -y, -1, v * x, v * y, v])
    _, _, vt = np.linalg.svd(np.asarray(A, dtype=np.float64))
    return vt[-1].reshape(3, 3)


def desentorta(im, quad, larg, alt):
    """Retifica o quadrilatero (TL, TR, BR, BL) num retangulo larg x alt.

    PIL quer o mapeamento INVERSO (destino -> origem): e a homografia do retangulo
    de saida para o quad de entrada, exatamente o que resolvemos aqui.
    """
    H = homografia([(0, 0), (larg, 0), (larg, alt), (0, alt)], quad)
    H = H / H[2, 2]
    return im.transform((larg, alt), Image.PERSPECTIVE, H.flatten()[:8], Image.BICUBIC)


def geometria(path, cfg):
    im = Image.open(path).convert("RGBA")
    m = np.array(im)[..., 3] > 128
    ys = np.where(m.any(1))[0]
    xs = np.where(m.any(0))[0]
    y0, y1, x0, x1 = ys[0], ys[-1], xs[0], xs[-1]
    h = y1 - y0

    def col_topo(x):
        return int(np.where(m[:, x])[0][0])

    def col_base(x):
        return int(np.where(m[:, x])[0][-1])

    # 20%..85% da altura foge dos cantos, onde a curvatura da capa desvia a borda
    faixa = range(y0 + int(0.20 * h), y0 + int(0.85 * h), 4)
    L = reta([(int(np.where(m[y])[0][0]), y) for y in faixa])
    R = reta([(int(np.where(m[y])[0][-1]), y) for y in faixa])

    dobra = reta(cfg["dobra"])
    dx = int(np.mean([p[0] for p in cfg["dobra"]]))
    # Com `corte`, a aresta externa da capa vem dada e a silhueta so vale ate ali:
    # ajustar topo e base sobre a faixa inteira arrastaria as retas para o corte
    # das folhas, que fica alguns pixels mais para dentro do que a capa.
    corte = reta(cfg["corte"]) if cfg.get("corte") else None
    cx = int(np.mean([p[0] for p in cfg["corte"]])) if corte is not None else None
    span = ((dx + 30, (cx if cx else x1) - 18) if cfg["lado"] == "esq"
            else ((cx if cx else x0) + 18, dx - 30))
    cols = range(span[0], span[1], 4)
    B = reta([(x, col_base(x)) for x in cols])
    T = reta(cfg["topo"]) if cfg["topo"] else reta([(x, col_topo(x)) for x in cols])

    if cfg["lado"] == "esq":
        esq, dir_ = dobra, (corte if corte is not None else R)
    else:
        esq, dir_ = (corte if corte is not None else L), dobra
    capa = [cruza(T, esq), cruza(T, dir_), cruza(dir_, B), cruza(B, esq)]

    lomb = None
    if cfg["lombada"]:
        a, b = cfg["lombada"]
        cols_l = range(a + 4, b - 4, 2)
        Tl = reta([(x, col_topo(x)) for x in cols_l])
        Bl = reta([(x, col_base(x)) for x in cols_l])
        # a aresta que fecha a lombada acompanha a inclinacao da dobra
        incl = (cfg["dobra"][1][0] - cfg["dobra"][0][0]) / max(
            1, cfg["dobra"][1][1] - cfg["dobra"][0][1])
        fim = reta([(b, cfg["dobra"][0][1]),
                    (b + incl * (cfg["dobra"][1][1] - cfg["dobra"][0][1]), cfg["dobra"][1][1])])
        lomb = [cruza(Tl, L), cruza(Tl, fim), cruza(fim, Bl), cruza(Bl, L)]
    return im, capa, lomb


def main():
    so_debug = "--debug" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    for nome, cfg in CFG.items():
        im, capa, lomb = geometria(os.path.join(SRC, nome), cfg)
        lc = (np.linalg.norm(capa[1] - capa[0]) + np.linalg.norm(capa[2] - capa[3])) / 2
        hc = (np.linalg.norm(capa[3] - capa[0]) + np.linalg.norm(capa[2] - capa[1])) / 2
        log(f"{cfg['slug']}: capa {lc:.0f}x{hc:.0f} px (h/l {hc/lc:.3f})"
            + (f"  lombada {np.linalg.norm(lomb[1]-lomb[0]):.0f} px" if lomb else "  sem lombada"))

        if so_debug:
            d = ImageDraw.Draw(im)
            for quad, cor in ((capa, (255, 55, 55)), (lomb, (40, 210, 255))):
                if not quad:
                    continue
                pts = [tuple(p) for p in quad]
                d.line(pts + [pts[0]], fill=cor, width=3)
                for p in pts:
                    d.ellipse([p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8], fill=cor)
            alvo = os.path.join(ROOT, "build", f"_dbg_{cfg['slug']}.png")
            im.convert("RGB").save(alvo)
            log(f"   conferencia -> {os.path.relpath(alvo, ROOT)}")
            continue

        alt = 1600
        larg = int(round(alt * lc / hc))
        tex = desentorta(im, encolhe(capa, 0.008, 0.012), larg, alt).convert("RGB")
        tex.save(os.path.join(OUT, f"plana-{cfg['slug']}.webp"), quality=92, method=6)
        log(f"   plana-{cfg['slug']}.webp {larg}x{alt}")

        if lomb:
            ll = np.linalg.norm(lomb[1] - lomb[0])
            # 3x mais larga do que a perspectiva deixou: o eixo comprimido e o unico
            # que perdeu resolucao, e ampliar aqui evita reamostrar de novo na GPU
            lw = max(96, int(round(alt * ll / hc)) * 3)
            face = desentorta(im, encolhe(lomb, 0.02, 0.022), lw, alt).convert("RGB")
            # O estudio deixou a lombada na sombra. Manter essa sombra assada na
            # textura duplicaria a iluminacao no 3D e, pior, a sombra giraria junto
            # com o livro. Normaliza para o mesmo papel da capa; quem escurece a
            # lombada passa a ser a luz da cena.
            g = nivel(tex) / np.maximum(1.0, nivel(face))
            log(f"   lombada normalizada por {g.round(2)}")
            arr = realca(np.asarray(face, dtype=np.float32) * g, sigma=2.2, forca=0.85)
            face = Image.fromarray(arr.astype(np.uint8))
            face.save(os.path.join(OUT, f"lombada-{cfg['slug']}.webp"), quality=92, method=6)
            log(f"   lombada-{cfg['slug']}.webp {lw}x{alt}")


if __name__ == "__main__":
    main()
