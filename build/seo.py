"""Mantem canonical, social cards, JSON-LD, robots e sitemap sincronizados.

Uso:
  python build/seo.py https://rafaelavilaterapeuta.com.br
  python build/seo.py https://rafaelavilaterapeuta.com.br --github-pages
  python build/seo.py https://rafaelavilaterapeuta.com.br --verificacao=CODIGO
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
CANONICAL_ORIGIN = "https://rafaelavilaterapeuta.com.br"
SOCIAL_PATH = "assets/social/rafael-avila-1200x630.webp"
SOCIAL_TITLE = "Você não precisa ser outra pessoa."
SOCIAL_DESCRIPTION = "Precisa aprender a lidar com quem você é. Terapia online com Rafael Ávila — breve, prática e objetiva."
SOCIAL_ALT = "Rafael Ávila, terapeuta comportamental, em retrato editorial."

# A politica entra com prioridade baixa: precisa ser encontravel, mas nao deve
# competir com a home por relevancia.
PAGINAS = [
    ("/", "1.0", "monthly"),
    ("/politica.html", "0.3", "yearly"),
]

INSTAGRAM = "https://www.instagram.com/rafa.aviila/"
WHATSAPP = "https://wa.me/5548991947402"


def log(m):
    print(f"[SEO] {m}")


def normalizar_dominio(valor: str) -> str:
    dominio = valor.rstrip("/")
    parsed = urlparse(dominio)
    if parsed.scheme != "https" or not parsed.netloc or parsed.path or parsed.params or parsed.query or parsed.fragment:
        raise SystemExit("[SEO] use uma origem HTTPS sem caminho, query ou fragmento")
    return dominio


def social_url(dominio: str) -> str:
    return f"{dominio}/{SOCIAL_PATH}"


def robots(dominio):
    """Sem comentario nenhum, de proposito.

    robots.txt e servido publicamente: comentario ali vira conteudo publico. Ja
    aconteceu de um comentario explicativo expor rota de admin e a stack de
    autenticacao — num texto que existia justamente para dizer o que nao indexar.
    """
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /build/\n"
        "\n"
        f"Sitemap: {dominio}/sitemap.xml\n"
    )


def sitemap(dominio):
    hoje = date.today().isoformat()
    itens = "".join(
        f"  <url>\n"
        f"    <loc>{dominio}{caminho}</loc>\n"
        f"    <lastmod>{hoje}</lastmod>\n"
        f"    <changefreq>{freq}</changefreq>\n"
        f"    <priority>{prio}</priority>\n"
        f"  </url>\n"
        for caminho, prio, freq in PAGINAS
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">\n'
        f"{itens}"
        "</urlset>\n"
    ).replace("www.sitemap.org", "www.sitemaps.org")


def cabeca(dominio, verificacao=""):
    """Retorna o unico bloco de head que depende da origem publica."""

    image = social_url(dominio)
    dados = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Person",
                "@id": f"{dominio}/#rafael",
                "name": "Rafael Ávila",
                "url": f"{dominio}/",
                "image": image,
                "jobTitle": "Terapeuta comportamental",
                "description": "Terapeuta, mentor, palestrante e autor do livro Bem-vindo ao Mundo Real.",
                "sameAs": [INSTAGRAM],
            },
            {
                "@type": "ProfessionalService",
                "@id": f"{dominio}/#servico",
                "name": "Rafael Ávila — Terapia online",
                "url": f"{dominio}/",
                "image": image,
                "provider": {"@id": f"{dominio}/#rafael"},
                "areaServed": {"@type": "Country", "name": "Brasil"},
                "availableLanguage": "pt-BR",
                "serviceType": "Terapia comportamental online",
                "potentialAction": {
                    "@type": "CommunicateAction",
                    "target": WHATSAPP,
                },
            },
        ],
    }
    json_ld = json.dumps(dados, ensure_ascii=False, indent=2)
    selo = (f'  <meta name="google-site-verification" content="{verificacao}">\n'
            if verificacao else "")
    return (
        selo
        + f'  <link rel="canonical" href="{dominio}/">\n'
        '  <meta property="og:type" content="website">\n'
        f'  <meta property="og:url" content="{dominio}/">\n'
        f'  <meta property="og:title" content="{SOCIAL_TITLE}">\n'
        f'  <meta property="og:description" content="{SOCIAL_DESCRIPTION}">\n'
        f'  <meta property="og:image" content="{image}">\n'
        f'  <meta property="og:image:secure_url" content="{image}">\n'
        '  <meta property="og:image:type" content="image/webp">\n'
        '  <meta property="og:image:width" content="1200">\n'
        '  <meta property="og:image:height" content="630">\n'
        f'  <meta property="og:image:alt" content="{SOCIAL_ALT}">\n'
        '  <meta property="og:locale" content="pt_BR">\n'
        '  <meta name="twitter:card" content="summary_large_image">\n'
        f'  <meta name="twitter:title" content="{SOCIAL_TITLE}">\n'
        f'  <meta name="twitter:description" content="{SOCIAL_DESCRIPTION}">\n'
        f'  <meta name="twitter:image" content="{image}">\n'
        f'  <meta name="twitter:image:alt" content="{SOCIAL_ALT}">\n'
        '  <script type="application/ld+json">\n'
        + "\n".join("  " + line for line in json_ld.splitlines())
        + "\n  </script>"
    )


def escrever(path: Path, conteudo: str) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write(conteudo)


def validar_contrato(dominio: str, html: str, robots_text: str, sitemap_text: str) -> None:
    image = social_url(dominio)
    required_html = (f'{dominio}/', image, 'og:image:width', 'twitter:image:alt', '"@graph"')
    if not all(token in html for token in required_html) or "/assets/perfil.png" in html:
        raise SystemExit("[SEO] index.html nao preservou o contrato social/canonico")
    if f"Sitemap: {dominio}/sitemap.xml" not in robots_text:
        raise SystemExit("[SEO] robots.txt divergiu do dominio canonico")
    expected_urls = [f"{dominio}{path}" for path, _, _ in PAGINAS]
    if not all(f"<loc>{url}</loc>" in sitemap_text for url in expected_urls):
        raise SystemExit("[SEO] sitemap.xml divergiu de PAGINAS ou do dominio canonico")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        raise SystemExit(
            "[SEO] falta o dominio.\n"
            "      uso: python build/seo.py https://exemplo.com.br [--github-pages]"
        )
    dominio = normalizar_dominio(args[0])

    robots_text = robots(dominio)
    escrever(ROOT / "robots.txt", robots_text)
    log("robots.txt")

    sitemap_text = sitemap(dominio)
    escrever(ROOT / "sitemap.xml", sitemap_text)
    log(f"sitemap.xml ({len(PAGINAS)} url)")

    alvo = ROOT / "index.html"
    html = alvo.read_text(encoding="utf-8")

    verificacao = ""
    for a in sys.argv[1:]:
        if a.startswith("--verificacao="):
            verificacao = a.split("=", 1)[1].strip()

    novo, n = re.subn(
        r"(<!-- seo:inicio -->)(.*?)(  <!-- seo:fim -->)",
        lambda m: m.group(1) + "\n" + cabeca(dominio, verificacao) + "\n" + m.group(3),
        html, count=1, flags=re.S)
    if not n:
        raise SystemExit("[SEO] marcadores <!-- seo:inicio --> / <!-- seo:fim --> "
                         "nao encontrados no index.html")

    validar_contrato(dominio, novo, robots_text, sitemap_text)
    escrever(alvo, novo)
    log("index.html: canonical, Open Graph, Twitter e JSON-LD")

    if "--github-pages" in sys.argv:
        host = dominio.split("//", 1)[1]
        escrever(ROOT / "CNAME", host + "\n")
        log(f"CNAME -> {host}")

    log("pronto. Depois do deploy: cadastrar o sitemap no Google Search Console.")


if __name__ == "__main__":
    main()
