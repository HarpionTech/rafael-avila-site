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
import json
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable, Iterable


ROOT = Path(__file__).resolve().parent.parent
BASELINE = Path("build/baseline-v1.6.json")
CANONICAL = "https://rafaelavilaterapeuta.com.br/"
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
        parser = parse_html(root / filename, group, results, root)
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


def check_seo(root: Path, results: Results) -> None:
    group = "seo"
    index = parse_html(root / "index.html", group, results, root)
    if index is not None:
        results.assert_true(group, "index.html", "JSON-LD presente", bool(index.json_ld), "nenhum script application/ld+json")
        for position, raw in enumerate(index.json_ld, start=1):
            try:
                parsed = json.loads(raw)
                valid = parsed.get("@context") == "https://schema.org"
                results.assert_true(group, "index.html", f"JSON-LD #{position} parseavel e schema.org", valid, "@context ausente ou incorreto")
            except (json.JSONDecodeError, AttributeError) as exc:
                results.assert_true(group, "index.html", f"JSON-LD #{position} parseavel", False, str(exc))

        canonical_links = [attrs.get("href") for attrs in index.tags("link") if attrs.get("rel") == "canonical"]
        results.assert_true(group, "index.html", "canonical unico no apex HTTPS", canonical_links == [CANONICAL], f"encontrado: {canonical_links!r}")

    robots_path = root / "robots.txt"
    try:
        robots = robots_path.read_text(encoding="utf-8")
        expected = f"Sitemap: {CANONICAL}sitemap.xml"
        results.assert_true(group, "robots.txt", "sitemap canonico", expected in robots, f"esperado {expected}")
    except OSError as exc:
        results.assert_true(group, "robots.txt", "arquivo legivel", False, str(exc))

    sitemap_path = root / "sitemap.xml"
    try:
        xml_root = ET.parse(sitemap_path).getroot()
        namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [node.text for node in xml_root.findall("s:url/s:loc", namespace)]
        results.assert_true(group, "sitemap.xml", "XML parseavel com home canonica", CANONICAL in urls, f"URLs: {urls!r}")
        results.assert_true(group, "sitemap.xml", "somente URLs HTTPS do apex", bool(urls) and all(url.startswith(CANONICAL) for url in urls), f"URLs: {urls!r}")
    except (OSError, ET.ParseError) as exc:
        results.assert_true(group, "sitemap.xml", "XML parseavel", False, str(exc))


def check_accessibility(root: Path, results: Results) -> None:
    group = "accessibility"
    for filename in ("index.html", "politica.html"):
        parser = parse_html(root / filename, group, results, root)
        if parser is None:
            continue
        html_tags = parser.tags("html")
        results.assert_true(group, filename, "idioma pt-BR", len(html_tags) == 1 and html_tags[0].get("lang") == "pt-BR", "atributo lang ausente ou divergente")
        results.assert_true(group, filename, "exatamente um h1", len(parser.tags("h1")) == 1, f"encontrados {len(parser.tags('h1'))}")


def check_resilience(root: Path, results: Results) -> None:
    group = "resilience"
    index_path = root / "index.html"
    try:
        html = index_path.read_text(encoding="utf-8")
        results.assert_true(group, "index.html", "fallback sem JS libera a cortina", ".preloader { display: none !important; }" in html, "regra noscript da cortina ausente")
        results.assert_true(group, "index.html", "fallback sem JS oferece contato real", "<noscript>" in html and "https://wa.me/" in html, "WhatsApp nao encontrado no fallback")
    except OSError as exc:
        results.assert_true(group, "index.html", "arquivo legivel", False, str(exc))


def check_network(root: Path, results: Results) -> None:
    group = "network"
    for filename in ("index.html", "politica.html"):
        path = root / filename
        try:
            html = path.read_text(encoding="utf-8")
            results.assert_true(group, filename, "sem URL HTTP insegura", "http://" not in html, "URL http:// encontrada no documento")
        except OSError as exc:
            results.assert_true(group, filename, "arquivo legivel", False, str(exc))


def check_cache(root: Path, results: Results) -> None:
    group = "cache"
    for filename in ("index.html", "politica.html", "robots.txt", "sitemap.xml"):
        path = root / filename
        try:
            text = path.read_text(encoding="utf-8")
            results.assert_true(group, filename, "sem cache imutavel embutido no documento", "immutable" not in text.lower(), "diretiva immutable pertence apenas a assets versionados")
        except OSError as exc:
            results.assert_true(group, filename, "arquivo legivel", False, str(exc))


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
        ("canonicalUrl",): CANONICAL,
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Executa os checks locais da Phase 18.")
    parser.add_argument("--group", action="append", choices=(*GROUPS, "all"), default=[], help="grupo repetivel; padrao: all")
    parser.add_argument("--self-test", action="store_true", help="injeta uma regressao temporaria e exige falha acionavel")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.self_test:
        return self_test(ROOT)
    _, code = run_groups(ROOT, selected_groups(args.group))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
