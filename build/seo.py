"""Fecha o SEO da pagina assim que o dominio existir.

Tudo que o Google precisa e que depende de URL ABSOLUTA esta aqui: canonical,
og:url, og:image, sitemap, robots e os dados estruturados. Nada disso funciona
com caminho relativo — canonical relativo o Google ignora, og:image relativo o
WhatsApp nao busca, e sitemap so aceita URL completa.

Enquanto o dominio nao existe, o index.html fica VALIDO e sem placeholder
nenhum: as tags moram entre dois marcadores vazios e sao escritas aqui. Assim
nada quebrado vai ao ar por engano se a pagina subir antes da hora.

Uso:
  python build/seo.py https://rafaelavila.com.br
  python build/seo.py https://rafaelavila.com.br --github-pages
  python build/seo.py https://rafaelavila.com.br --verificacao=CODIGO

--github-pages escreve tambem o CNAME, que o GitHub Pages exige para dominio
proprio — foi o que faltou no website-salsa e derrubou o dominio ate ser criado.

--verificacao insere a <meta> do Google Search Console. So e necessaria no modo
"prefixo de URL"; verificando por DNS (registro TXT), que e o modo que cobre www
e nao-www de uma vez, a meta nao entra.
"""
import os
import re
import sys
from datetime import date

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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
    """Tags do <head> que dependem do dominio, mais os dados estruturados.

    O JSON-LD e o que mais rende para marca pessoal: e por ele que o Google
    entende que "Rafael Avila" e uma pessoa que presta um servico, liga o perfil
    do Instagram ao site e passa a aceitar o site como fonte em recomendacao.
    `sameAs` e a chave dessa ligacao.
    """
    dados = f'''{{
  "@context": "https://schema.org",
  "@graph": [
    {{
      "@type": "Person",
      "@id": "{dominio}/#rafael",
      "name": "Rafael \\u00c1vila",
      "url": "{dominio}/",
      "image": "{dominio}/assets/perfil.png",
      "jobTitle": "Terapeuta comportamental",
      "description": "Terapeuta, mentor, palestrante e autor do livro Bem-vindo ao Mundo Real.",
      "sameAs": ["{INSTAGRAM}"]
    }},
    {{
      "@type": "ProfessionalService",
      "@id": "{dominio}/#servico",
      "name": "Rafael \\u00c1vila \\u2014 Terapia online",
      "url": "{dominio}/",
      "image": "{dominio}/assets/perfil.png",
      "provider": {{ "@id": "{dominio}/#rafael" }},
      "areaServed": {{ "@type": "Country", "name": "Brasil" }},
      "availableLanguage": "pt-BR",
      "serviceType": "Terapia comportamental online",
      "potentialAction": {{
        "@type": "CommunicateAction",
        "target": "{WHATSAPP}"
      }}
    }}
  ]
}}'''
    selo = (f'  <meta name="google-site-verification" content="{verificacao}">\n'
            if verificacao else "")
    return (
        selo
        + f'  <link rel="canonical" href="{dominio}/">\n'
        f'  <meta property="og:url" content="{dominio}/">\n'
        '  <meta name="twitter:card" content="summary_large_image">\n'
        '  <script type="application/ld+json">\n'
        + "\n".join("  " + l for l in dados.splitlines())
        + "\n  </script>"
    )


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        raise SystemExit(
            "[SEO] falta o dominio.\n"
            "      uso: python build/seo.py https://exemplo.com.br [--github-pages]"
        )
    dominio = args[0].rstrip("/")
    if not dominio.startswith("https://"):
        raise SystemExit("[SEO] o dominio precisa comecar com https:// — canonical "
                         "e sitemap com http viram redirecionamento e o Google reclama.")

    with open(os.path.join(RAIZ, "robots.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write(robots(dominio))
    log("robots.txt")

    with open(os.path.join(RAIZ, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as f:
        f.write(sitemap(dominio))
    log(f"sitemap.xml ({len(PAGINAS)} url)")

    alvo = os.path.join(RAIZ, "index.html")
    html = open(alvo, encoding="utf-8").read()

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

    # og:image precisa ser absoluta: relativa, o WhatsApp e o Facebook nao buscam
    # e o link compartilhado sai sem imagem.
    novo = re.sub(r'(<meta property="og:image" content=")[^"]*(")',
                  rf'\g<1>{dominio}/assets/perfil.png\g<2>', novo, count=1)

    open(alvo, "w", encoding="utf-8").write(novo)
    log("index.html: canonical, og:url, og:image e JSON-LD")

    if "--github-pages" in sys.argv:
        host = dominio.split("//", 1)[1]
        with open(os.path.join(RAIZ, "CNAME"), "w", encoding="utf-8", newline="\n") as f:
            f.write(host + "\n")
        log(f"CNAME -> {host}")

    log("pronto. Depois do deploy: cadastrar o sitemap no Google Search Console.")


if __name__ == "__main__":
    main()
