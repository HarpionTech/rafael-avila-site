"""Corta a faixa de PESO das fontes variaveis para a que a pagina usa.

Newsreader vem com o eixo wght de 200 a 800 e o eixo opsz de 6 a 72. A pagina
usa 400, 500 e 600 — os outros 400 pontos de interpolacao viajam em toda visita
sem nunca serem desenhados.

O eixo opsz fica INTACTO de proposito. Fixa-lo levaria o arquivo de 129 KB para
39 KB, mas muda o desenho: as letras engrossam de leve e o titulo passa a ocupar
menos largura, o que pode mudar onde a headline quebra de linha. Isso e decisao
de identidade visual, nao de performance — nao se toma dentro de um script de
build.

Os .woff2 originais ficam no repositorio: sao a fonte de qualquer reconversao.
"""
import os, shutil, subprocess, sys, tempfile
from fontTools.ttLib import TTFont

PASTA = "assets/fontes"
FAIXA = "wght=400:600"

alvos = [a for a in os.listdir(PASTA) if a.startswith("newsreader") and a.endswith(".woff2")]
antes = depois = 0
for arq in sorted(alvos):
    cam = os.path.join(PASTA, arq)
    orig = os.path.join(PASTA, arq.replace(".woff2", ".original.woff2"))
    if not os.path.exists(orig):          # guarda a fonte antes de mexer
        shutil.copy(cam, orig)
    a = os.path.getsize(orig)
    tmp = os.path.join(tempfile.gettempdir(), "f.ttf")
    r = subprocess.run([sys.executable, "-m", "fontTools.varLib.instancer", orig, FAIXA, "-o", tmp],
                       capture_output=True, text=True)
    if r.returncode:
        print(f"  {arq[:44]}: FALHOU — {r.stderr.strip()[:60]}")
        continue
    f = TTFont(tmp); f.flavor = "woff2"; f.save(cam)
    d = os.path.getsize(cam)
    antes += a; depois += d
    print(f"  {arq[:46]:<46} {a/1024:6.1f} -> {d/1024:6.1f} KB  (-{round((1-d/a)*100)}%)")
print(f"\n  total Newsreader: {antes/1024:.0f} KB -> {depois/1024:.0f} KB  (-{round((1-depois/antes)*100)}%)")
