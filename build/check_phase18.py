"""Checks reproduziveis da Phase 18.

Uso:
  python build/check_phase18.py
  python build/check_phase18.py --group syntax --group performance
  python build/check_phase18.py --self-test

Os checks usam somente arquivos publicos do repositorio e processos locais. Eles
nao leem segredos, nao fazem chamadas autenticadas e nao acessam o site publicado.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import socket
import shutil
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable, Iterable
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


ROOT = Path(__file__).resolve().parent.parent
BASELINE = Path("build/baseline-v1.6.json")
CANONICAL_ORIGIN = "https://rafaelavilaterapeuta.com.br"
CANONICAL = f"{CANONICAL_ORIGIN}/terapia"
POLICY_CANONICAL = f"{CANONICAL_ORIGIN}/politica.html"
BASELINE_CANONICAL = f"{CANONICAL_ORIGIN}/"
SOCIAL_PATH = Path("assets/social/rafael-avila-1200x630.webp")
SOCIAL_URL = f"{CANONICAL_ORIGIN}/{SOCIAL_PATH.as_posix()}"
GROUPS = (
    "syntax",
    "raw-html",
    "seo",
    "accessibility",
    "resilience",
    "network",
    "cache",
    "performance",
)
LIGHTHOUSE_TIMEOUT_SECONDS = 180
LIVE_TIMEOUT_SECONDS = 12
MAX_REDIRECTS = 8


@dataclass(frozen=True)
class Failure:
    group: str
    file: str
    assertion: str
    detail: str

    def format(self) -> str:
        return f"[{self.group}] {self.file}: {self.assertion} — {self.detail}"


class Results:
    def __init__(self) -> None:
        self.checks = {group: 0 for group in GROUPS}
        self.failures: list[Failure] = []

    def assert_true(
        self,
        group: str,
        file: str,
        assertion: str,
        condition: bool,
        detail: str,
    ) -> None:
        self.checks[group] += 1
        if not condition:
            self.failures.append(Failure(group, file, assertion, detail))

    def failures_for(self, group: str) -> list[Failure]:
        return [failure for failure in self.failures if failure.group == group]


class DocumentParser(HTMLParser):
    """Coleta a estrutura relevante sem executar JavaScript."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.declarations: list[str] = []
        self.start_tags: list[tuple[str, dict[str, str | None]]] = []
        self.json_ld: list[str] = []
        self._json_chunks: list[str] | None = None

    def handle_decl(self, decl: str) -> None:
        self.declarations.append(decl)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        self.start_tags.append((tag, values))
        if tag == "script" and values.get("type") == "application/ld+json":
            self._json_chunks = []

    def handle_data(self, data: str) -> None:
        if self._json_chunks is not None:
            self._json_chunks.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._json_chunks is not None:
            self.json_ld.append("".join(self._json_chunks).strip())
            self._json_chunks = None

    def tags(self, name: str) -> list[dict[str, str | None]]:
        return [attrs for tag, attrs in self.start_tags if tag == name]


def relpath(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def parse_html(path: Path, group: str, results: Results, root: Path) -> DocumentParser | None:
    label = relpath(path, root)
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        results.assert_true(group, label, "arquivo legivel", False, str(exc))
        return None

    parser = DocumentParser()
    try:
        parser.feed(text)
        parser.close()
    except Exception as exc:  # HTMLParser pode levantar por entrada estrutural invalida.
        results.assert_true(group, label, "HTML parseavel", False, str(exc))
        return None

    results.assert_true(group, label, "HTML parseavel", True, "")
    return parser


def check_syntax(root: Path, results: Results) -> None:
    group = "syntax"
    scripts = sorted((root / "assets/js").glob("*.js"))
    results.assert_true(group, "assets/js", "scripts proprios encontrados", bool(scripts), "nenhum .js encontrado")
    if shutil.which("node") is None:
        results.assert_true(group, "node", "runtime disponivel", False, "instale Node.js 24")
        return

    for script in scripts:
        label = relpath(script, root)
        try:
            completed = subprocess.run(
                ["node", "--check", str(script)],
                cwd=root,
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            detail = (completed.stderr or completed.stdout).strip() or f"exit code {completed.returncode}"
            results.assert_true(group, label, "node --check", completed.returncode == 0, detail)
        except (OSError, subprocess.TimeoutExpired) as exc:
            results.assert_true(group, label, "node --check", False, str(exc))


def check_raw_html(root: Path, results: Results) -> None:
    group = "raw-html"
    for filename in ("index.html", "politica.html"):
        path = root / filename
        parser = parse_html(path, group, results, root)
        if parser is None:
            continue
        results.assert_true(
            group,
            filename,
            "doctype HTML presente",
            any(decl.lower() == "doctype html" for decl in parser.declarations),
            "esperado <!DOCTYPE html>",
        )
        tag_names = {tag for tag, _ in parser.start_tags}
        results.assert_true(group, filename, "estrutura html/head/body", {"html", "head", "body"} <= tag_names, "tags obrigatorias ausentes")

        if filename != "index.html":
            continue

        html = path.read_text(encoding="utf-8")
        section_ids = {
            attrs.get("id")
            for tag, attrs in parser.start_tags
            if tag == "section"
        }
        results.assert_true(
            group,
            filename,
            "secoes canonicas presentes",
            {"metodo", "sobre", "depoimentos", "ebooks", "contato"} <= section_ids,
            f"ids encontrados: {sorted(value for value in section_ids if value)!r}",
        )

        for section_id in ("metodo", "sobre", "depoimentos", "ebooks", "contato"):
            marker = f'id="{section_id}"'
            start = html.find(marker)
            end = html.find("</section>", start)
            body = html[start:end] if start >= 0 and end > start else ""
            results.assert_true(
                group,
                filename,
                f"secao #{section_id} materializada",
                bool(body) and "<h2" in body and len(body) > 300,
                "esperado heading e conteudo substancial no HTML bruto",
            )

        footer_start = html.find('<footer class="footer"')
        footer_end = html.find("</footer>", footer_start)
        footer = html[footer_start:footer_end] if footer_start >= 0 and footer_end > footer_start else ""
        results.assert_true(
            group,
            filename,
            "rodape materializado",
            "Preferências de cookies" in footer and "politica.html" in footer and len(footer) > 500,
            "rodape canonico ausente ou incompleto",
        )

        results.assert_true(
            group,
            filename,
            "sem shells data-render",
            "data-render=" not in html,
            "conteudo ainda depende dos renderers client-side",
        )

        essential_links = [
            attrs
            for tag, attrs in parser.start_tags
            if tag == "a" and (
                "data-wa" in attrs
                or "hotmart.com" in (attrs.get("href") or "")
                or "instagram.com" in (attrs.get("href") or "")
                or (attrs.get("href") or "").endswith("politica.html")
            )
        ]
        invalid_links = [attrs.get("href") for attrs in essential_links if (attrs.get("href") or "") in ("", "#")]
        results.assert_true(
            group,
            filename,
            "destinos essenciais reais",
            len(essential_links) >= 15 and not invalid_links,
            f"esperados WhatsApp, Hotmart, Instagram e politica; invalidos: {invalid_links!r}; total: {len(essential_links)}",
        )

        noscript_start = html.find("<noscript>", html.find("</main>"))
        noscript_end = html.find("</noscript>", noscript_start)
        noscript = html[noscript_start:noscript_end] if noscript_start >= 0 and noscript_end > noscript_start else ""
        results.assert_true(
            group,
            filename,
            "noscript nao condiciona o conteudo",
            "Ative o JavaScript" not in noscript and "conteúdo completo" not in noscript,
            "fallback ainda afirma que o conteudo depende de JavaScript",
        )


def check_seo(root: Path, results: Results) -> None:
    group = "seo"
    index = parse_html(root / "index.html", group, results, root)
    if index is not None:
        html = (root / "index.html").read_text(encoding="utf-8")
        results.assert_true(group, "index.html", "JSON-LD presente", bool(index.json_ld), "nenhum script application/ld+json")
        json_documents: list[dict] = []
        for position, raw in enumerate(index.json_ld, start=1):
            try:
                parsed = json.loads(raw)
                valid = parsed.get("@context") == "https://schema.org"
                results.assert_true(group, "index.html", f"JSON-LD #{position} parseavel e schema.org", valid, "@context ausente ou incorreto")
                if isinstance(parsed, dict):
                    json_documents.append(parsed)
            except (json.JSONDecodeError, AttributeError) as exc:
                results.assert_true(group, "index.html", f"JSON-LD #{position} parseavel", False, str(exc))

        canonical_links = [attrs.get("href") for attrs in index.tags("link") if attrs.get("rel") == "canonical"]
        results.assert_true(group, "index.html", "canonical unico no apex HTTPS", canonical_links == [CANONICAL], f"encontrado: {canonical_links!r}")

        social_meta = {
            "property:og:url": CANONICAL,
            "property:og:type": "website",
            "property:og:title": "Você não precisa ser outra pessoa.",
            "property:og:description": "Precisa aprender a lidar com quem você é. Terapia online com Rafael Ávila — breve, prática e objetiva.",
            "property:og:image": SOCIAL_URL,
            "property:og:image:secure_url": SOCIAL_URL,
            "property:og:image:type": "image/webp",
            "property:og:image:width": "1200",
            "property:og:image:height": "630",
            "property:og:image:alt": "Rafael Ávila, terapeuta comportamental, em retrato editorial.",
            "name:twitter:card": "summary_large_image",
            "name:twitter:title": "Você não precisa ser outra pessoa.",
            "name:twitter:description": "Precisa aprender a lidar com quem você é. Terapia online com Rafael Ávila — breve, prática e objetiva.",
            "name:twitter:image": SOCIAL_URL,
            "name:twitter:image:alt": "Rafael Ávila, terapeuta comportamental, em retrato editorial.",
        }
        for selector, expected in social_meta.items():
            attribute, key = selector.split(":", 1)
            values = [attrs.get("content") for attrs in index.tags("meta") if attrs.get(attribute) == key]
            results.assert_true(
                group,
                "index.html",
                f"meta {key} unico e coerente",
                values == [expected],
                f"esperado: {[expected]!r}; encontrado: {values!r}",
            )

        graphs = [document.get("@graph") for document in json_documents]
        graph = next((value for value in graphs if isinstance(value, list)), [])
        typed_nodes = {
            node.get("@type"): node
            for node in graph
            if isinstance(node, dict) and node.get("@type") in {"Person", "ProfessionalService"}
        }
        results.assert_true(
            group,
            "index.html",
            "JSON-LD declara Person e ProfessionalService",
            set(typed_nodes) == {"Person", "ProfessionalService"},
            f"tipos encontrados: {sorted(typed_nodes)!r}",
        )
        for node_type in ("Person", "ProfessionalService"):
            node = typed_nodes.get(node_type, {})
            results.assert_true(
                group,
                "index.html",
                f"JSON-LD {node_type} usa URL e imagem canonicas",
                node.get("url") == CANONICAL and node.get("image") == SOCIAL_URL,
                f"url={node.get('url')!r}; image={node.get('image')!r}",
            )
        person = typed_nodes.get("Person", {})
        service = typed_nodes.get("ProfessionalService", {})
        instagram = "https://www.instagram.com/rafa.aviila/"
        whatsapp = "https://wa.me/5548991947402"
        results.assert_true(
            group,
            "index.html",
            "JSON-LD referencia links visiveis",
            instagram in person.get("sameAs", [])
            and instagram in html
            and service.get("potentialAction", {}).get("target") == whatsapp
            and whatsapp in html,
            "Instagram ou WhatsApp divergente do HTML visivel",
        )

    policy_path = root / "politica.html"
    policy = parse_html(policy_path, group, results, root)
    if policy is not None:
        policy_html = policy_path.read_text(encoding="utf-8")
        policy_head = policy_html.split("</head>", 1)[0]
        policy_title = "Política de Privacidade — Rafael Ávila"
        policy_description = (
            "Como o site de Rafael Ávila trata dados pessoais, cookies, "
            "serviços externos e os direitos previstos na LGPD."
        )
        policy_alt = "Rafael Ávila, terapeuta comportamental, em retrato editorial."

        results.assert_true(
            group,
            "politica.html",
            "title proprio da politica",
            f"<title>{policy_title}</title>" in policy_head,
            "title institucional especifico ausente ou divergente",
        )

        policy_meta = {
            "name:description": policy_description,
            "name:robots": "index,follow",
            "property:og:type": "website",
            "property:og:url": POLICY_CANONICAL,
            "property:og:title": policy_title,
            "property:og:description": policy_description,
            "property:og:image": SOCIAL_URL,
            "property:og:image:secure_url": SOCIAL_URL,
            "property:og:image:type": "image/webp",
            "property:og:image:width": "1200",
            "property:og:image:height": "630",
            "property:og:image:alt": policy_alt,
            "name:twitter:card": "summary_large_image",
            "name:twitter:title": policy_title,
            "name:twitter:description": policy_description,
            "name:twitter:image": SOCIAL_URL,
            "name:twitter:image:alt": policy_alt,
        }
        for selector, expected in policy_meta.items():
            attribute, key = selector.split(":", 1)
            values = [attrs.get("content") for attrs in policy.tags("meta") if attrs.get(attribute) == key]
            results.assert_true(
                group,
                "politica.html",
                f"meta {key} unico e coerente",
                values == [expected],
                f"esperado: {[expected]!r}; encontrado: {values!r}",
            )

        policy_canonical_links = [attrs.get("href") for attrs in policy.tags("link") if attrs.get("rel") == "canonical"]
        results.assert_true(
            group,
            "politica.html",
            "canonical proprio e unico",
            policy_canonical_links == [POLICY_CANONICAL],
            f"esperado: {[POLICY_CANONICAL]!r}; encontrado: {policy_canonical_links!r}",
        )

        deferred_providers = (
            "googletagmanager.com",
            "google-analytics.com",
            "connect.facebook.net",
            "facebook.com/tr",
            "fbq(",
            "gtag(",
        )
        found_providers = [token for token in deferred_providers if token in policy_head.lower()]
        results.assert_true(
            group,
            "politica.html",
            "head sem provedores de medicao antecipados",
            not found_providers,
            f"tokens encontrados: {found_providers!r}",
        )

    social_file = root / SOCIAL_PATH
    try:
        from PIL import Image

        with Image.open(social_file) as image:
            dimensions = image.size
            image_format = image.format
        results.assert_true(group, SOCIAL_PATH.as_posix(), "WebP 1200x630 valido", dimensions == (1200, 630) and image_format == "WEBP", f"dimensao={dimensions}; formato={image_format}")
        results.assert_true(group, SOCIAL_PATH.as_posix(), "peso maximo de 300 KiB", social_file.stat().st_size <= 300 * 1024, f"{social_file.stat().st_size} bytes")
    except (ImportError, OSError) as exc:
        results.assert_true(group, SOCIAL_PATH.as_posix(), "imagem social legivel", False, str(exc))

    robots_path = root / "robots.txt"
    try:
        robots = robots_path.read_text(encoding="utf-8")
        expected = f"Sitemap: {CANONICAL_ORIGIN}/sitemap.xml"
        results.assert_true(group, "robots.txt", "sitemap canonico", expected in robots, f"esperado {expected}")
    except OSError as exc:
        results.assert_true(group, "robots.txt", "arquivo legivel", False, str(exc))

    sitemap_path = root / "sitemap.xml"
    try:
        xml_root = ET.parse(sitemap_path).getroot()
        namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [node.text for node in xml_root.findall("s:url/s:loc", namespace)]
        results.assert_true(group, "sitemap.xml", "XML parseavel com home canonica", CANONICAL in urls, f"URLs: {urls!r}")
        results.assert_true(group, "sitemap.xml", "somente URLs HTTPS do apex", bool(urls) and all(url.startswith(f"{CANONICAL_ORIGIN}/") for url in urls), f"URLs: {urls!r}")
        results.assert_true(group, "sitemap.xml", "paginas canonicas exatas", urls == [CANONICAL, POLICY_CANONICAL], f"URLs: {urls!r}")
    except (OSError, ET.ParseError) as exc:
        results.assert_true(group, "sitemap.xml", "XML parseavel", False, str(exc))

    with tempfile.TemporaryDirectory(prefix="phase18-seo-") as temp:
        fixture_root = Path(temp)
        (fixture_root / "build").mkdir(parents=True)
        for relative in (Path("index.html"), Path("robots.txt"), Path("sitemap.xml"), Path("build/seo.py")):
            destination = fixture_root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(root / relative, destination)
        command = [sys.executable, str(fixture_root / "build/seo.py"), CANONICAL_ORIGIN]
        try:
            first = subprocess.run(command, cwd=fixture_root, capture_output=True, text=True, timeout=20, check=False)
            snapshot = {
                relative: (fixture_root / relative).read_bytes()
                for relative in (Path("index.html"), Path("robots.txt"), Path("sitemap.xml"))
            }
            second = subprocess.run(command, cwd=fixture_root, capture_output=True, text=True, timeout=20, check=False)
            repeated = {
                relative: (fixture_root / relative).read_bytes()
                for relative in (Path("index.html"), Path("robots.txt"), Path("sitemap.xml"))
            }
            generated_html = snapshot[Path("index.html")].decode("utf-8")
            required_tokens = (SOCIAL_URL, "og:image:width", "twitter:image:alt", '"@graph"')
            results.assert_true(
                group,
                "build/seo.py",
                "gerador executa duas vezes",
                first.returncode == 0 and second.returncode == 0,
                (first.stderr or second.stderr or first.stdout or second.stdout).strip(),
            )
            results.assert_true(
                group,
                "build/seo.py",
                "geracao idempotente",
                snapshot == repeated,
                "segunda execucao alterou index.html, robots.txt ou sitemap.xml",
            )
            results.assert_true(
                group,
                "build/seo.py",
                "gerador preserva metadados sociais completos",
                all(token in generated_html for token in required_tokens) and "/assets/perfil.png" not in generated_html,
                "asset social, dimensoes, Twitter ou JSON-LD divergiram apos gerar",
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            results.assert_true(group, "build/seo.py", "gerador testavel em copia temporaria", False, str(exc))


def check_accessibility(root: Path, results: Results) -> None:
    group = "accessibility"
    for filename in ("index.html", "politica.html"):
        parser = parse_html(root / filename, group, results, root)
        if parser is None:
            continue
        html_tags = parser.tags("html")
        results.assert_true(group, filename, "idioma pt-BR", len(html_tags) == 1 and html_tags[0].get("lang") == "pt-BR", "atributo lang ausente ou divergente")
        results.assert_true(group, filename, "exatamente um h1", len(parser.tags("h1")) == 1, f"encontrados {len(parser.tags('h1'))}")

        prohibited = [
            (tag, attrs.get("aria-label"))
            for tag, attrs in parser.start_tags
            if tag in {"span", "em"} and attrs.get("aria-label")
        ]
        results.assert_true(
            group,
            filename,
            "sem aria-label em wrappers genericos",
            not prohibited,
            f"encontrado: {prohibited!r}",
        )

    css = (root / "assets/css/style.css").read_text(encoding="utf-8")
    results.assert_true(
        group,
        "assets/css/style.css",
        "foco perceptivel global",
        ":focus-visible" in css and "outline:" in css,
        "regra global de foco visivel ausente",
    )

    for scenario, failures in accessibility_browser_scenarios(root).items():
        results.assert_true(
            group,
            f"browser:{scenario}",
            "operacao acessivel",
            not failures,
            "; ".join(failures),
        )


def check_resilience(root: Path, results: Results) -> None:
    group = "resilience"
    index_path = root / "index.html"
    try:
        html = index_path.read_text(encoding="utf-8")
        results.assert_true(
            group,
            "index.html",
            "fallback sem JS libera a cortina",
            ".preloader { display: none" in (root / "assets/css/style.css").read_text(encoding="utf-8")
            and "preloader-capable" in html,
            "cortina deve ser oculta por padrao e ativada apenas pelo bootstrap",
        )
        results.assert_true(group, "index.html", "fallback sem JS oferece contato real", "https://wa.me/" in html, "WhatsApp nao encontrado no HTML bruto")
    except OSError as exc:
        results.assert_true(group, "index.html", "arquivo legivel", False, str(exc))

    for scenario, failures in resilience_browser_scenarios(root).items():
        results.assert_true(
            group,
            f"browser:{scenario}",
            "conteudo e conversao fail-open",
            not failures,
            "; ".join(failures),
        )


def check_network(root: Path, results: Results) -> None:
    group = "network"
    prohibited_tokens = (
        "googletagmanager.com",
        "google-analytics.com",
        "analytics.google.com",
        "doubleclick.net",
        "connect.facebook.net",
        "facebook.com/tr",
        "graph.facebook.com",
        "fbq(",
        "gtag(",
    )
    for filename in ("index.html", "politica.html"):
        path = root / filename
        try:
            html = path.read_text(encoding="utf-8")
            results.assert_true(group, filename, "sem URL HTTP insegura", "http://" not in html, "URL http:// encontrada no documento")
            matches = [token for token in prohibited_tokens if token in html.lower()]
            results.assert_true(
                group,
                filename,
                "sem tag Google ou Meta embutida",
                not matches,
                f"tokens encontrados: {matches!r}",
            )
        except OSError as exc:
            results.assert_true(group, filename, "arquivo legivel", False, str(exc))

    for scenario, failures in network_browser_scenarios(root, prohibited_tokens).items():
        results.assert_true(
            group,
            f"browser:{scenario}",
            "zero requests Google/Meta antes do consentimento",
            not failures,
            "; ".join(failures),
        )


def network_browser_scenarios(root: Path, prohibited_tokens: tuple[str, ...]) -> dict[str, list[str]]:
    """Observa e bloqueia requests de medicao em contextos sem escolha persistida."""

    failures: dict[str, list[str]] = {"pre-consent": []}
    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import Route, sync_playwright
    except ImportError:
        return {"preflight": ["Playwright Python nao esta instalado"]}

    host, port = "127.0.0.1", 8765
    server: subprocess.Popen[bytes] | None = None
    try:
        if not wait_for_local_server(host, port, timeout=0.3):
            server = subprocess.Popen(
                [sys.executable, "-m", "http.server", str(port), "--bind", host],
                cwd=root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
            if not wait_for_local_server(host, port):
                return {"preflight": ["servidor local nao respondeu em 10 s"]}

        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=True)
            except PlaywrightError:
                return {"preflight": ["Chromium do Playwright indisponivel"]}

            try:
                for pathname in ("/", "/politica.html"):
                    context = browser.new_context(viewport={"width": 390, "height": 844})

                    def inspect_request(route: Route) -> None:
                        request_url = route.request.url
                        if any(token in request_url.lower() for token in prohibited_tokens):
                            failures["pre-consent"].append(f"{pathname}: {request_url}")
                            route.abort()
                        else:
                            route.continue_()

                    context.route("**/*", inspect_request)
                    page = context.new_page()
                    response = page.goto(
                        f"http://{host}:{port}{pathname}",
                        wait_until="load",
                        timeout=20_000,
                    )
                    page.wait_for_timeout(750)
                    if response is None or not response.ok:
                        status = "sem resposta" if response is None else str(response.status)
                        failures["pre-consent"].append(f"{pathname}: HTTP {status}")
                    context.close()
            finally:
                browser.close()
    except PlaywrightError as exc:
        failures.setdefault("preflight", []).append(str(exc).splitlines()[0])
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
    return failures


def check_cache(root: Path, results: Results) -> None:
    group = "cache"
    max_age_pattern = re.compile(r"max-age\s*=\s*(\d+)", re.IGNORECASE)
    for filename in ("index.html", "politica.html", "robots.txt", "sitemap.xml"):
        path = root / filename
        try:
            text = path.read_text(encoding="utf-8")
            results.assert_true(group, filename, "sem cache imutavel embutido no documento", "immutable" not in text.lower(), "diretiva immutable pertence apenas a assets versionados")
            max_ages = [int(value) for value in max_age_pattern.findall(text)]
            results.assert_true(
                group,
                filename,
                "cache documental no maximo 86400 s",
                all(value <= 86400 for value in max_ages),
                f"max-age encontrados: {max_ages!r}",
            )

            if filename.endswith(".html"):
                parser = parse_html(path, group, results, root)
                http_equiv = [attrs.get("http-equiv") for attrs in parser.tags("meta")] if parser else []
                results.assert_true(
                    group,
                    filename,
                    "sem cache via meta http-equiv",
                    not any(http_equiv),
                    f"http-equiv encontrados: {http_equiv!r}",
                )
        except OSError as exc:
            results.assert_true(group, filename, "arquivo legivel", False, str(exc))

    cache_api_patterns = {
        "service worker": re.compile(r"(?:navigator\s*\.\s*)?serviceWorker\s*\.\s*register", re.IGNORECASE),
        "Cache API": re.compile(r"(?:window\s*\.\s*)?caches\s*\.\s*(?:open|match|keys|delete)", re.IGNORECASE),
    }
    first_party_sources = [root / "index.html", root / "politica.html", *sorted((root / "assets/js").glob("*.js"))]
    for path in first_party_sources:
        try:
            source = path.read_text(encoding="utf-8")
        except OSError as exc:
            results.assert_true(group, relpath(path, root), "fonte legivel", False, str(exc))
            continue
        matches = [name for name, pattern in cache_api_patterns.items() if pattern.search(source)]
        results.assert_true(
            group,
            relpath(path, root),
            "sem service worker ou Cache API",
            not matches,
            f"mecanismos encontrados: {matches!r}",
        )

    config_names = {
        "_headers",
        ".htaccess",
        "firebase.json",
        "netlify.toml",
        "vercel.json",
        "wrangler.toml",
    }
    try:
        tracked = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=root,
            capture_output=True,
            check=True,
            timeout=20,
        ).stdout.decode("utf-8").split("\0")
    except (OSError, subprocess.SubprocessError, UnicodeDecodeError) as exc:
        results.assert_true(group, ".git", "lista de configuracoes versionadas", False, str(exc))
        tracked = []

    for relative in tracked:
        if not relative:
            continue
        candidate = Path(relative)
        lower_name = candidate.name.lower()
        is_cache_config = lower_name in config_names or (
            candidate.suffix.lower() in {".json", ".toml", ".yaml", ".yml"}
            and any(token in lower_name for token in ("cache", "header", "cloudflare"))
        )
        if not is_cache_config:
            continue
        try:
            config_text = (root / candidate).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        route_lines = {line.strip().split()[0] for line in config_text.splitlines() if line.strip().startswith("/")}
        document_scope = bool(route_lines & {"/", "/*", "/politica.html", "/robots.txt", "/sitemap.xml"})
        long_max_ages = [int(value) for value in max_age_pattern.findall(config_text) if int(value) > 86400]
        dangerous = "immutable" in config_text.lower() or bool(long_max_ages)
        results.assert_true(
            group,
            relative,
            "config nao aplica cache longo a documentos",
            not (document_scope and dangerous),
            f"rotas={sorted(route_lines)!r}; max-age longos={long_max_ages!r}; immutable={'immutable' in config_text.lower()}",
        )


def load_baseline(root: Path, results: Results) -> dict | None:
    group = "performance"
    path = root / BASELINE
    label = BASELINE.as_posix()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        results.assert_true(group, label, "JSON estrito e legivel", False, str(exc))
        return None
    results.assert_true(group, label, "JSON estrito e legivel", isinstance(payload, dict), "raiz deve ser objeto")
    return payload if isinstance(payload, dict) else None


def check_performance(root: Path, results: Results) -> None:
    group = "performance"
    label = BASELINE.as_posix()
    payload = load_baseline(root, results)
    if payload is None:
        return

    expected = {
        ("schemaVersion",): 1,
        ("canonicalUrl",): BASELINE_CANONICAL,
        ("observed", "scores", "performance"): 56,
        ("observed", "scores", "seo"): 100,
        ("observed", "scores", "bestPractices"): 100,
        ("observed", "scores", "accessibility"): 96,
        ("observed", "metrics", "fcpMs"): 3300,
        ("observed", "metrics", "lcpMs"): 6500,
        ("observed", "metrics", "tbtMs"): 580,
        ("observed", "metrics", "cls"): 0.002,
        ("phase19Targets", "status"): "future-non-blocking",
    }
    for keys, value in expected.items():
        cursor: object = payload
        try:
            for key in keys:
                if not isinstance(cursor, dict):
                    raise KeyError(key)
                cursor = cursor[key]
            valid = cursor == value and type(cursor) is type(value)
        except KeyError:
            cursor = "<ausente>"
            valid = False
        dotted = ".".join(keys)
        results.assert_true(group, label, dotted, valid, f"esperado {value!r}; encontrado {cursor!r}")

    lighthouse_dir = root / "build/_lighthouse"
    manifest_path = lighthouse_dir / "manifest.json"
    if not manifest_path.exists():
        print("[performance] INFO — manifest Lighthouse ausente; check:phase18 compara deltas apos o LHCI")
        return

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        results.assert_true(group, relpath(manifest_path, root), "manifest Lighthouse legivel", False, str(exc))
        return

    representatives = [entry for entry in manifest if isinstance(entry, dict) and entry.get("isRepresentativeRun")]
    expected_urls = {
        "http://127.0.0.1:8765/",
        "http://127.0.0.1:8765/politica.html",
    }
    found_urls = {entry.get("url") for entry in representatives}
    results.assert_true(
        group,
        relpath(manifest_path, root),
        "relatorios representativos das duas paginas",
        found_urls == expected_urls,
        f"esperado: {sorted(expected_urls)!r}; encontrado: {sorted(str(url) for url in found_urls)!r}",
    )

    baseline_score = payload["observed"]["scores"]["performance"]
    baseline_metrics = payload["observed"]["metrics"]
    for entry in representatives:
        report_path = Path(str(entry.get("jsonPath", "")))
        if not report_path.exists():
            report_path = lighthouse_dir / report_path.name
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
            score = round(float(report["categories"]["performance"]["score"]) * 100)
            audits = report["audits"]
            metrics = {
                "lcpMs": float(audits["largest-contentful-paint"]["numericValue"]),
                "tbtMs": float(audits["total-blocking-time"]["numericValue"]),
                "cls": float(audits["cumulative-layout-shift"]["numericValue"]),
            }
        except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            results.assert_true(group, relpath(report_path, root), "relatorio Lighthouse parseavel", False, str(exc))
            continue

        results.assert_true(group, relpath(report_path, root), "relatorio Lighthouse parseavel", True, "")
        url = str(entry.get("url"))
        print(
            "[performance] INFO — "
            f"{url}: Performance {score} ({score - baseline_score:+d}); "
            f"LCP {metrics['lcpMs']:.0f} ms ({metrics['lcpMs'] - baseline_metrics['lcpMs']:+.0f}); "
            f"TBT {metrics['tbtMs']:.0f} ms ({metrics['tbtMs'] - baseline_metrics['tbtMs']:+.0f}); "
            f"CLS {metrics['cls']:.3f} ({metrics['cls'] - baseline_metrics['cls']:+.3f})"
        )


CHECKERS: dict[str, Callable[[Path, Results], None]] = {
    "syntax": check_syntax,
    "raw-html": check_raw_html,
    "seo": check_seo,
    "accessibility": check_accessibility,
    "resilience": check_resilience,
    "network": check_network,
    "cache": check_cache,
    "performance": check_performance,
}


def selected_groups(requested: Iterable[str]) -> list[str]:
    items = list(requested)
    if not items or "all" in items:
        return list(GROUPS)
    return list(dict.fromkeys(items))


def run_groups(root: Path, groups: Iterable[str]) -> tuple[Results, int]:
    results = Results()
    chosen = list(groups)
    for group in chosen:
        CHECKERS[group](root, results)
        failures = results.failures_for(group)
        if failures:
            print(f"[{group}] FAIL — {len(failures)}/{results.checks[group]} assercao(oes)")
            for failure in failures:
                print(f"  {failure.format()}")
        else:
            print(f"[{group}] PASS — {results.checks[group]} assercao(oes)")
    return results, 1 if results.failures else 0


def self_test(root: Path) -> int:
    """Prova que uma regressao conhecida falha com grupo e arquivo acionaveis."""

    with tempfile.TemporaryDirectory(prefix="phase18-self-test-") as temp:
        fixture_root = Path(temp)
        fixture = fixture_root / BASELINE
        fixture.parent.mkdir(parents=True)
        shutil.copy2(root / BASELINE, fixture)

        payload = json.loads(fixture.read_text(encoding="utf-8"))
        payload["observed"]["scores"]["performance"] = 55
        fixture.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        results, code = run_groups(fixture_root, ["performance"])
        messages = "\n".join(failure.format() for failure in results.failures)
        expected_context = "[performance] build/baseline-v1.6.json"
        if code != 1 or expected_context not in messages:
            print("[self-test] FAIL — a violacao nao gerou exit code 1 com grupo/arquivo")
            return 1
        print("[self-test] PASS — violacao conhecida foi rejeitada com mensagem acionavel")
        return 0


def wait_for_local_server(host: str, port: int, timeout: float = 10.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.25):
                return True
        except OSError:
            time.sleep(0.1)
    return False


def resilience_browser_scenarios(root: Path) -> dict[str, list[str]]:
    """Exercita no-JS e falhas independentes dos aprimoramentos visuais."""

    scenarios = {
        "no-js": {"java_script_enabled": False},
        "main-js": {"block": "**/assets/js/main.js*"},
        "gsap": {"block": "**/assets/vendor/gsap.min.js*"},
        "scroll-trigger": {"block": "**/assets/vendor/ScrollTrigger.min.js*"},
        "brain-particles": {"block": "**/assets/js/brain-particles.js*"},
        "book-3d": {"block": "**/assets/js/book-3d.js*"},
        "canvas-context": {"canvas_failure": True},
    }
    failures: dict[str, list[str]] = {name: [] for name in scenarios}
    install_command = "python -m playwright install chromium"

    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"preflight": [f"Playwright ausente; execute pip install -r requirements-dev.txt e {install_command}"]}

    host, port = "127.0.0.1", 8765
    server: subprocess.Popen[bytes] | None = None
    try:
        if not wait_for_local_server(host, port, timeout=0.3):
            server = subprocess.Popen(
                [sys.executable, "-m", "http.server", str(port), "--bind", host],
                cwd=root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
            if not wait_for_local_server(host, port):
                return {"preflight": ["servidor local nao respondeu em 10 s"]}

        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=True)
            except PlaywrightError:
                return {"preflight": [f"Chromium indisponivel; execute {install_command}"]}

            try:
                for name, options in scenarios.items():
                    context = browser.new_context(
                        viewport={"width": 390, "height": 844},
                        java_script_enabled=options.get("java_script_enabled", True),
                    )
                    page = context.new_page()
                    runtime_errors: list[str] = []
                    page.on("pageerror", lambda error, bucket=runtime_errors: bucket.append(str(error)))

                    if block := options.get("block"):
                        page.route(block, lambda route: route.abort())
                    if options.get("canvas_failure"):
                        page.add_init_script("""
                          (() => {
                            const original = HTMLCanvasElement.prototype.getContext;
                            HTMLCanvasElement.prototype.getContext = function (type, ...args) {
                              if (type === 'webgl' && this.matches('[data-book3d], [data-hero-livro]')) return null;
                              return original.call(this, type, ...args);
                            };
                          })();
                        """)

                    try:
                        response = page.goto(f"http://{host}:{port}/", wait_until="load", timeout=20_000)
                        if response is None or not response.ok:
                            failures[name].append("home nao respondeu HTTP 200")
                            continue

                        if options.get("java_script_enabled") is False:
                            page.wait_for_timeout(200)
                        else:
                            try:
                                page.locator("[data-preloader]").wait_for(state="hidden", timeout=3_500)
                            except PlaywrightTimeoutError:
                                failures[name].append("cortina permaneceu visivel")

                        for selector in ("#metodo h2", "#ebooks h2", "#contato h2", ".hero-actions [data-wa]"):
                            if not page.locator(selector).first.is_visible():
                                failures[name].append(f"conteudo invisivel: {selector}")

                        href = page.locator(".hero-actions [data-wa]").first.get_attribute("href") or ""
                        if not href.startswith("https://wa.me/"):
                            failures[name].append("CTA principal sem href real")

                        visible_posters = page.locator(".hero-obj__poster, .showcase__poster").evaluate_all(
                            """els => els.every(el => {
                              const visible = node => {
                                const s = getComputedStyle(node);
                                return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0;
                              };
                              const canvas = el.previousElementSibling;
                              return visible(el) || (canvas?.classList.contains('is-ready') && visible(canvas));
                            })"""
                        )
                        if not visible_posters:
                            failures[name].append("poster de fallback invisivel")

                        if options.get("java_script_enabled") is False:
                            all_cards = page.locator(".showcase__card").evaluate_all(
                                "els => els.length === 5 && els.every(el => getComputedStyle(el).display !== 'none')"
                            )
                            controls_hidden = page.locator(".showcase__arrow, .showcase__pager, .showcase__nav").evaluate_all(
                                "els => els.every(el => getComputedStyle(el).display === 'none')"
                            )
                            if not all_cards:
                                failures[name].append("publicacoes nao aparecem todas em fluxo")
                            if not controls_hidden:
                                failures[name].append("controles inertes continuam visiveis")

                        failures[name].extend(f"erro runtime: {error}" for error in runtime_errors)
                    except PlaywrightError as exc:
                        failures[name].append(f"Playwright: {str(exc).splitlines()[0]}")
                    finally:
                        context.close()
            finally:
                browser.close()
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)

    return failures


def accessibility_browser_scenarios(root: Path) -> dict[str, list[str]]:
    """Valida nomes, teclado, dialogs e reduced motion no Chromium local."""

    failures: dict[str, list[str]] = {"motion-text": [], "keyboard-dialogs": [], "reduced-motion": []}
    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"preflight": ["Playwright ausente; execute pip install -r requirements-dev.txt"]}

    host, port = "127.0.0.1", 8765
    server: subprocess.Popen[bytes] | None = None
    try:
        if not wait_for_local_server(host, port, timeout=0.3):
            server = subprocess.Popen(
                [sys.executable, "-m", "http.server", str(port), "--bind", host],
                cwd=root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
            if not wait_for_local_server(host, port):
                return {"preflight": ["servidor local nao respondeu em 10 s"]}

        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=True)
            except PlaywrightError:
                return {"preflight": ["Chromium do Playwright indisponivel"]}

            try:
                context = browser.new_context(viewport={"width": 390, "height": 844})
                context.add_init_script("""
                  localStorage.setItem('avila:consentimento', JSON.stringify({
                    versao: 1,
                    escolhas: { essenciais: true, estatisticas: false, marketing: false }
                  }));
                """)
                page = context.new_page()
                page.goto(f"http://{host}:{port}/", wait_until="load", timeout=20_000)
                page.locator("[data-preloader]").wait_for(state="hidden", timeout=4_000)

                generic_labels = page.locator("span[aria-label], em[aria-label]").count()
                hidden_motion = page.locator("[data-motion-title] [aria-hidden='true'], #hero-title > span [aria-hidden='true'], #hero-title > em [aria-hidden='true']").count()
                if generic_labels:
                    failures["motion-text"].append(f"{generic_labels} wrapper(s) generico(s) com aria-label")
                if hidden_motion:
                    failures["motion-text"].append(f"{hidden_motion} palavra(s) removida(s) da arvore acessivel")
                expected_title = "Você não precisa ser outra pessoa. Precisa aprender a lidar com quem você é."
                actual_title = " ".join((page.locator("#hero-title").text_content() or "").split())
                if actual_title != expected_title:
                    failures["motion-text"].append(f"titulo divergente: {actual_title!r}")

                toggle = page.locator(".nav-toggle")
                toggle.focus()
                page.keyboard.press("Enter")
                if toggle.get_attribute("aria-expanded") != "true":
                    failures["keyboard-dialogs"].append("menu nao abre por teclado")
                page.keyboard.press("Escape")
                if toggle.get_attribute("aria-expanded") != "false" or page.evaluate("document.activeElement === document.querySelector('.nav-toggle')") is not True:
                    failures["keyboard-dialogs"].append("Escape nao fecha menu e devolve foco")

                testimonial = page.locator(".testimonial-card").first
                testimonial.focus()
                page.keyboard.press("Enter")
                page.locator(".lightbox.is-open").wait_for(state="visible", timeout=2_000)
                page.locator(".lightbox__close").focus()
                page.keyboard.press("Shift+Tab")
                if not page.evaluate("document.querySelector('.lightbox').contains(document.activeElement)"):
                    failures["keyboard-dialogs"].append("lightbox nao contem o foco")
                page.keyboard.press("Escape")
                if not page.evaluate("document.activeElement === document.querySelector('.testimonial-card')"):
                    failures["keyboard-dialogs"].append("lightbox nao devolve foco ao acionador")

                prefs_trigger = page.locator(".footer-col__botao")
                prefs_trigger.focus()
                page.keyboard.press("Enter")
                page.locator(".prefs.is-visivel").wait_for(state="visible", timeout=2_000)
                page.locator(".prefs__fechar").focus()
                page.keyboard.press("Shift+Tab")
                if not page.evaluate("document.querySelector('.prefs').contains(document.activeElement)"):
                    failures["keyboard-dialogs"].append("preferencias nao contem o foco")
                page.keyboard.press("Escape")
                if page.locator(".prefs").count() or not page.evaluate("document.activeElement === document.querySelector('.footer-col__botao')"):
                    failures["keyboard-dialogs"].append("preferencias nao fecha e devolve foco")
                context.close()

                reduced = browser.new_context(
                    viewport={"width": 390, "height": 844},
                    reduced_motion="reduce",
                )
                reduced.add_init_script("""
                  localStorage.setItem('avila:consentimento', JSON.stringify({
                    versao: 1,
                    escolhas: { essenciais: true, estatisticas: false, marketing: false }
                  }));
                """)
                page = reduced.new_page()
                page.goto(f"http://{host}:{port}/", wait_until="load", timeout=20_000)
                page.locator("[data-preloader]").wait_for(state="hidden", timeout=1_000)
                for selector in ("#hero-title", ".hero-actions [data-wa]", "#metodo h2", "#ebooks h2"):
                    if not page.locator(selector).first.is_visible():
                        failures["reduced-motion"].append(f"estado final invisivel: {selector}")
                reduced.close()
            finally:
                browser.close()
    except PlaywrightError as exc:
        failures.setdefault("preflight", []).append(str(exc).splitlines()[0])
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)

    return failures


def browser_checks(root: Path) -> int:
    """Smoke test local; inclui preflight acionavel do Chromium do Playwright."""

    install_command = "python -m playwright install chromium"
    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[browser] FAIL — Playwright Python nao esta instalado.")
        print("  execute: python -m pip install -r requirements-dev.txt")
        print(f"  depois:  {install_command}")
        return 1

    host, port = "127.0.0.1", 8765
    server: subprocess.Popen[bytes] | None = None
    try:
        already_running = wait_for_local_server(host, port, timeout=0.3)
        if not already_running:
            server = subprocess.Popen(
                [sys.executable, "-m", "http.server", str(port), "--bind", host],
                cwd=root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
            if not wait_for_local_server(host, port):
                print("[browser] FAIL — servidor local nao respondeu em 10 s")
                return 1

        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=True)
            except PlaywrightError as exc:
                print("[browser] FAIL — Chromium do Playwright indisponivel.")
                print(f"  execute: {install_command}")
                print(f"  detalhe: {str(exc).splitlines()[0]}")
                return 1

            failures: list[str] = []
            try:
                page = browser.new_page(viewport={"width": 390, "height": 844})
                console_errors: list[str] = []
                page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
                for route in ("/", "/politica.html"):
                    response = page.goto(f"http://{host}:{port}{route}", wait_until="load", timeout=20_000)
                    if response is None or not response.ok:
                        status = "sem resposta" if response is None else str(response.status)
                        failures.append(f"{route}: HTTP {status}")
                    if not page.title().strip():
                        failures.append(f"{route}: title vazio")
                failures.extend(f"console: {message}" for message in console_errors)
            finally:
                browser.close()

        if failures:
            print(f"[browser] FAIL — {len(failures)} ocorrencia(s)")
            for failure in failures:
                print(f"  [browser] {failure}")
            return 1
        print("[browser] PASS — / e /politica.html responderam sem erro de console")
        return 0
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)


class RedirectTrace(HTTPRedirectHandler):
    """Registra a cadeia e recusa loops ou cadeias acima do teto operacional."""

    def __init__(self) -> None:
        super().__init__()
        self.chain: list[tuple[int, str, str]] = []

    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        self.chain.append((code, request.full_url, new_url))
        if len(self.chain) > MAX_REDIRECTS:
            raise HTTPError(request.full_url, 508, "limite de redirects excedido", headers, file_pointer)
        return super().redirect_request(request, file_pointer, code, message, headers, new_url)


def fetch_with_trace(url: str) -> tuple[int, str, list[tuple[int, str, str]]]:
    """Consulta URL publica com timeout, user-agent explicito e fallback GET."""

    last_error: Exception | None = None
    for method in ("HEAD", "GET"):
        trace = RedirectTrace()
        opener = build_opener(trace)
        request = Request(url, method=method, headers={"User-Agent": "Phase18SEOCheck/1.0"})
        try:
            with opener.open(request, timeout=LIVE_TIMEOUT_SECONDS) as response:
                return response.status, response.geturl(), trace.chain
        except HTTPError as exc:
            last_error = exc
            if method == "HEAD" and exc.code in {403, 405, 501}:
                continue
            raise
        except URLError as exc:
            last_error = exc
            raise
    raise RuntimeError(str(last_error or "request sem resposta"))


def fetch_head_headers(url: str) -> tuple[int, str, dict[str, str]]:
    """Faz HEAD seguindo redirects e devolve headers normalizados."""

    request = Request(url, method="HEAD", headers={"User-Agent": "Phase18CacheCheck/1.0"})
    with urlopen(request, timeout=LIVE_TIMEOUT_SECONDS) as response:
        headers = {key.lower(): value for key, value in response.headers.items()}
        return response.status, response.geturl(), headers


def format_redirect_chain(start: str, chain: list[tuple[int, str, str]], final: str) -> str:
    steps = [start]
    steps.extend(f"--{code}--> {target}" for code, _, target in chain)
    if not chain or chain[-1][2] != final:
        steps.append(f"--> {final}")
    return " ".join(steps)


def local_seo_http_checks(root: Path) -> list[str]:
    """Valida os documentos e o asset pela mesma camada HTTP usada no deploy."""

    failures: list[str] = []
    host, port = "127.0.0.1", 8765
    server: subprocess.Popen[bytes] | None = None
    try:
        if not wait_for_local_server(host, port, timeout=0.3):
            server_code = (
                "import http.server,sys; "
                "http.server.SimpleHTTPRequestHandler.extensions_map['.webp']='image/webp'; "
                "http.server.ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1])),"
                "http.server.SimpleHTTPRequestHandler).serve_forever()"
            )
            server = subprocess.Popen(
                [sys.executable, "-c", server_code, str(port)],
                cwd=root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
            if not wait_for_local_server(host, port):
                return ["servidor local nao respondeu em 10 s"]

        base = f"http://{host}:{port}"
        responses: dict[str, tuple[str, bytes]] = {}
        for route in ("/", "/robots.txt", "/sitemap.xml", f"/{SOCIAL_PATH.as_posix()}"):
            try:
                with urlopen(f"{base}{route}", timeout=10) as response:
                    body = response.read()
                    content_type = response.headers.get_content_type()
                    if response.status != 200:
                        failures.append(f"{route}: HTTP {response.status}")
                    responses[route] = (content_type, body)
            except (HTTPError, URLError, TimeoutError) as exc:
                failures.append(f"{route}: {exc}")

        if home := responses.get("/"):
            html = home[1].decode("utf-8", errors="replace")
            for token in (CANONICAL, SOCIAL_URL, "og:image:width", "twitter:image:alt", '"@graph"'):
                if token not in html:
                    failures.append(f"/: metadado ausente: {token}")
        if robots := responses.get("/robots.txt"):
            if f"Sitemap: {CANONICAL_ORIGIN}/sitemap.xml" not in robots[1].decode("utf-8", errors="replace"):
                failures.append("/robots.txt: sitemap canonico ausente")
        if sitemap_response := responses.get("/sitemap.xml"):
            sitemap_text = sitemap_response[1].decode("utf-8", errors="replace")
            if f"<loc>{CANONICAL}</loc>" not in sitemap_text or f"<loc>{POLICY_CANONICAL}</loc>" not in sitemap_text:
                failures.append("/sitemap.xml: paginas canonicas divergentes")
        if social := responses.get(f"/{SOCIAL_PATH.as_posix()}"):
            try:
                from PIL import Image

                with Image.open(io.BytesIO(social[1])) as image:
                    dimensions = image.size
                    image_format = image.format
                if social[0] != "image/webp":
                    failures.append(f"/{SOCIAL_PATH.as_posix()}: MIME {social[0]!r}; esperado image/webp")
                if dimensions != (1200, 630) or image_format != "WEBP":
                    failures.append(f"/{SOCIAL_PATH.as_posix()}: {dimensions} {image_format}; esperado 1200x630 WEBP")
            except (ImportError, OSError) as exc:
                failures.append(f"/{SOCIAL_PATH.as_posix()}: imagem invalida: {exc}")
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
    return failures


def live_redirect_checks(root: Path) -> int:
    """Confirma edge publico e documentos locais sem exigir deploy do novo head."""

    failures = local_seo_http_checks(root)
    variants = (
        "http://rafaelavilaterapeuta.com.br",
        "http://www.rafaelavilaterapeuta.com.br",
        "https://www.rafaelavilaterapeuta.com.br",
        CANONICAL,
    )
    for variant in variants:
        try:
            status, final, chain = fetch_with_trace(variant)
            diagnostic = format_redirect_chain(variant, chain, final)
            print(f"[live-redirects] {diagnostic} [{status}]")
            if status != 200 or final != CANONICAL:
                failures.append(f"{variant}: esperado {CANONICAL} [200]; obtido {final} [{status}]; cadeia: {diagnostic}")
        except (HTTPError, URLError, TimeoutError, RuntimeError) as exc:
            failures.append(f"{variant}: {exc}")

    if failures:
        print(f"[live-redirects] FAIL — {len(failures)} ocorrencia(s)")
        for failure in failures:
            print(f"  [live-redirects] {failure}")
        return 1
    print("[live-redirects] PASS — edge converge ao HTTPS apex e SEO local responde por HTTP")
    return 0


def live_cache_checks() -> int:
    """Audita apenas o teto documental; demais headers ficam como evidencia da Phase 22."""

    failures: list[str] = []
    max_age_pattern = re.compile(r"max-age\s*=\s*(\d+)", re.IGNORECASE)
    routes = ("/", "/politica.html", "/robots.txt", "/sitemap.xml")
    for route in routes:
        url = f"{CANONICAL_ORIGIN}{route}"
        try:
            status, final, headers = fetch_head_headers(url)
        except (HTTPError, URLError, TimeoutError) as exc:
            failures.append(f"{url}: {exc}")
            continue

        cache_control = headers.get("cache-control", "")
        max_ages = [int(value) for value in max_age_pattern.findall(cache_control)]
        diagnostic = {
            key: headers.get(key, "<ausente>")
            for key in ("cache-control", "age", "etag", "last-modified", "cf-cache-status")
        }
        print(f"[live-cache] {route} [{status}] -> {final} {json.dumps(diagnostic, ensure_ascii=False)}")
        if status != 200:
            failures.append(f"{url}: HTTP {status}")
        if "immutable" in cache_control.lower():
            failures.append(f"{url}: documento marcado immutable")
        if any(value > 86400 for value in max_ages):
            failures.append(f"{url}: max-age acima de 86400 s: {max_ages!r}")

    if failures:
        print(f"[live-cache] FAIL — {len(failures)} ocorrencia(s)")
        for failure in failures:
            print(f"  [live-cache] {failure}")
        return 1
    print("[live-cache] PASS — documentos publicos respeitam o teto de 86400 s")
    return 0


def lighthouse_checks(root: Path) -> int:
    """Executa o LHCI local com teto operacional e encerra sua arvore ao excede-lo."""

    npm = shutil.which("npm")
    if npm is None:
        print("[lighthouse] FAIL — npm nao encontrado; instale Node.js 24")
        return 1

    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    process = subprocess.Popen(
        [npm, "run", "check:lh:core"],
        cwd=root,
        creationflags=creationflags,
    )
    try:
        return process.wait(timeout=LIGHTHOUSE_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        print(f"[lighthouse] FAIL — excedeu {LIGHTHOUSE_TIMEOUT_SECONDS} s; encerrando auditoria local")
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                capture_output=True,
                timeout=15,
                check=False,
            )
        else:
            process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Executa os checks locais da Phase 18.")
    parser.add_argument("--group", action="append", choices=(*GROUPS, "all"), default=[], help="grupo repetivel; padrao: all")
    parser.add_argument("--all", action="store_true", help="executa explicitamente todos os oito grupos")
    parser.add_argument("--self-test", action="store_true", help="injeta uma regressao temporaria e exige falha acionavel")
    parser.add_argument("--browser", action="store_true", help="executa smoke test local com Playwright/Chromium")
    parser.add_argument("--lighthouse", action="store_true", help=f"executa Lighthouse CI com timeout de {LIGHTHOUSE_TIMEOUT_SECONDS} s")
    parser.add_argument("--live-redirects", action="store_true", help="valida edge publico com timeout e SEO no servidor local")
    parser.add_argument("--live-cache", action="store_true", help="faz HEAD nos quatro documentos publicos e bloqueia cache acima de 86400 s")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.self_test:
        return self_test(ROOT)
    if args.browser:
        return browser_checks(ROOT)
    if args.lighthouse:
        return lighthouse_checks(ROOT)
    _, code = run_groups(ROOT, selected_groups(["all"] if args.all else args.group))
    if args.live_redirects:
        code = max(code, live_redirect_checks(ROOT))
    if args.live_cache:
        code = max(code, live_cache_checks())
    return code


if __name__ == "__main__":
    raise SystemExit(main())
