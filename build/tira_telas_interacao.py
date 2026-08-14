"""Telas dos estados que so existem depois de um toque.

Menu aberto e lightbox do depoimento nao aparecem em captura de rolagem: e
justamente onde um layout de celular costuma quebrar, entao vao aqui.

Uso:
  python build/tira_telas_interacao.py [larguras...]
"""
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "_telas")
URL = "http://127.0.0.1:8765/"
ALTURAS = {390: 844, 430: 932, 768: 1024, 820: 1180}


def abre(pg):
    pg.goto(URL, wait_until="load")
    try:
        pg.wait_for_selector("[data-preloader]", state="detached", timeout=15000)
    except Exception:
        print("  a cortina nao saiu em 15 s")
    pg.wait_for_timeout(800)


def main():
    os.makedirs(OUT, exist_ok=True)
    larguras = [int(a) for a in sys.argv[1:] if a.isdigit()] or [390, 768]
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        for larg in larguras:
            print(f"[TELAS] {larg}px — interacao")
            pg = nav.new_page(viewport={"width": larg, "height": ALTURAS.get(larg, 900)},
                              device_scale_factor=2, is_mobile=larg < 700,
                              has_touch=larg < 900)

            abre(pg)
            pg.click(".nav-toggle")
            pg.wait_for_timeout(450)
            pg.screenshot(path=os.path.join(OUT, f"{larg}-07-menu.png"))
            print(f"  {larg}-07-menu.png")

            abre(pg)
            pg.eval_on_selector("#depoimentos", "s => s.scrollIntoView({block:'start'})")
            pg.wait_for_timeout(900)
            pg.click(".testimonial-card")
            pg.wait_for_timeout(600)
            pg.screenshot(path=os.path.join(OUT, f"{larg}-08-lightbox.png"))
            print(f"  {larg}-08-lightbox.png")

            pg.close()
        nav.close()


if __name__ == "__main__":
    main()
