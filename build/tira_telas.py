"""Tira as telas da pagina em larguras de celular e tablet.

O viewport nao da para estreitar pelo navegador da sessao — `resize_window`
devolve sucesso e `innerWidth` continua o mesmo — e iframe tambem nao serve:
o Chrome nao roda `requestAnimationFrame` em subframe de aba que nao esta em
primeiro plano, entao o GSAP nunca dava um tick e o preloader travava no meio.
Playwright abre uma janela com o viewport EXATO pedido e com o quadro rodando.

Uso:
  python build/tira_telas.py                 # celular 390 e tablet 820
  python build/tira_telas.py 390             # so uma largura
"""
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "_telas")
URL = "http://127.0.0.1:8765/"

# Onde parar. O topo de cada secao mais os pontos em que ha peca interativa.
PARADAS = [
    ("01-hero", "#inicio"),
    ("01b-cerebro", ".brain-stage"),
    ("02-metodo", "#metodo"),
    ("03-sobre", "#sobre"),
    ("04-depoimentos", "#depoimentos"),
    ("05-ebooks", "#ebooks"),
    ("05b-painel", ".showcase__panel"),
    ("05c-vitrine", ".showcase__nav"),
    ("06-contato", "#contato"),
]

LARGURAS = {390: 844, 430: 932, 768: 1024, 820: 1180}


def tira(pw, larg, alt):
    nav = pw.chromium.launch()
    pg = nav.new_page(viewport={"width": larg, "height": alt},
                      device_scale_factor=2, is_mobile=larg < 700,
                      has_touch=larg < 900)
    pg.goto(URL, wait_until="load")
    # A cortina sai sozinha; o teto dela e 7 s. Esperar o elemento sumir e mais
    # confiavel do que cronometrar a animacao.
    try:
        pg.wait_for_selector("[data-preloader]", state="detached", timeout=15000)
    except Exception:
        print(f"  [{larg}] a cortina nao saiu em 15 s")
    pg.wait_for_timeout(1200)

    for nome, sel in PARADAS:
        pg.evaluate("s => document.querySelector(s).scrollIntoView({block:'start'})", sel)
        # As secoes entram com stagger; 900 ms pegava a segunda fileira ainda
        # deslocada e a captura parecia desalinhamento de grid.
        pg.wait_for_timeout(1600)
        alvo = os.path.join(OUT, f"{larg}-{nome}.png")
        pg.screenshot(path=alvo)
        print(f"  {os.path.relpath(alvo, ROOT)}")

    nav.close()


def main():
    os.makedirs(OUT, exist_ok=True)
    pedidas = [int(a) for a in sys.argv[1:] if a.isdigit()] or [390, 820]
    with sync_playwright() as pw:
        for larg in pedidas:
            print(f"[TELAS] {larg}px")
            tira(pw, larg, LARGURAS.get(larg, 900))


if __name__ == "__main__":
    main()
