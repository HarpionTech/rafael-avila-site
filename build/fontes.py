"""Traz as fontes do Google para dentro do projeto.

Enquanto o CSS aponta para fonts.googleapis.com, o navegador de CADA visitante
abre conexao com o Google e entrega IP, User-Agent e a pagina de origem. Baixando
os arquivos para ca, a fonte passa a vir do mesmo servidor do resto do site e
esse terceiro some — o site fica sem nenhum host externo.

Ganho junto: somem duas resolucoes de DNS e dois handshakes TLS que estavam no
caminho critico. Texto nao pinta ate a fonte resolver, entao isso e LCP direto.

O truque do User-Agent: a API do Google devolve formatos diferentes conforme quem
pergunta. Com UA de Chrome moderno ela responde woff2, que e o menor. Com UA
generico volta ttf, varias vezes maior.

Uso:
  python build/fontes.py
"""
import os
import re
import sys
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "assets", "fontes")

FAMILIAS = (
    "https://fonts.googleapis.com/css2"
    "?family=IBM+Plex+Sans:wght@400;500;600;700"
    "&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600"
    ";1,6..72,400;1,6..72,500"
    "&display=swap"
)

UA_CHROME = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36")


def log(m):
    print(f"[FONTES] {m}")
    sys.stdout.flush()


def baixa(url, ua=UA_CHROME):
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    os.makedirs(DESTINO, exist_ok=True)

    css = baixa(FAMILIAS).decode("utf-8")
    urls = sorted(set(re.findall(r"url\((https://[^)]+\.woff2)\)", css)))
    if not urls:
        raise SystemExit("[FONTES] o Google nao devolveu woff2 — confira o User-Agent")
    log(f"{len(urls)} arquivos woff2 a baixar")

    mapa = {}
    total = 0
    for u in urls:
        # nome estavel a partir do caminho do Google: familia + hash do arquivo
        nome = re.sub(r"[^a-zA-Z0-9._-]", "-", u.split("/s/")[-1]).lower()
        dados = baixa(u)
        with open(os.path.join(DESTINO, nome), "wb") as f:
            f.write(dados)
        mapa[u] = nome
        total += len(dados)
    log(f"{total/1024:.0f} KB baixados")

    local = css
    for u, nome in mapa.items():
        local = local.replace(u, nome)

    cabeca = (
        "/* Gerado por build/fontes.py — nao editar a mao.\n"
        "   Fontes servidas pelo proprio site: nenhum host externo, e o Google\n"
        "   nao recebe o IP de quem visita. Para atualizar, rodar o script. */\n"
    )
    with open(os.path.join(DESTINO, "fontes.css"), "w", encoding="utf-8", newline="\n") as f:
        f.write(cabeca + local)
    log(f"assets/fontes/fontes.css ({len(local)/1024:.0f} KB)")

    # troca o <link> do Google pelo local, e derruba os preconnect que sobram
    alvo = os.path.join(RAIZ, "index.html")
    html = open(alvo, encoding="utf-8").read()
    antes = html

    html = re.sub(r'\n *<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"[^>]*>', "", html)
    html = re.sub(
        r'<link href="https://fonts\.googleapis\.com/css2[^"]*" rel="stylesheet">',
        '<link rel="stylesheet" href="assets/fontes/fontes.css">',
        html, count=1)

    if html == antes:
        log("index.html ja estava apontando para as fontes locais")
    else:
        open(alvo, "w", encoding="utf-8").write(html)
        log("index.html: <link> do Google trocado pelo local, preconnect removidos")


if __name__ == "__main__":
    main()
