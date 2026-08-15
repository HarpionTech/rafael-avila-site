"""Checks determinísticos da Phase 19: baseline visual e pipeline de assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BASELINE = ROOT / "build" / "visual-baseline" / "phase19"
VIEWPORTS = ((390, 844), (430, 932), (768, 1024), (1024, 768), (1440, 900))
RECT_SELECTORS = {
    "header": ".site-header",
    "h1": "#hero-title",
    "lead": ".hero-lead",
    "cta": ".hero-actions .liquid-button-gold",
    "poster": ".hero-obj__poster",
    "metodo": "#metodo",
    "sobre": "#sobre",
    "depoimentos": "#depoimentos",
    "ebooks": "#ebooks",
    "contato": "#contato",
}
SECTION_KEYS = ("metodo", "sobre", "depoimentos", "ebooks", "contato")
GROUPS = ("pipeline", "versioning", "reproducibility")
OUTPUT_PAIRS = (
    ("assets/fontes/fontes.css", "assets/build/fonts.min.css"),
    ("assets/css/style.css", "assets/build/site.min.css"),
    ("assets/js/config.js", "assets/build/config.min.js"),
    ("assets/js/main.js", "assets/build/main.min.js"),
    ("assets/js/book-3d.js", "assets/build/book-3d.min.js"),
    ("assets/js/brain-particles.js", "assets/build/brain-particles.min.js"),
)
VERSIONABLE = re.compile(r"\.(?:avif|css|gif|jpe?g|js|png|svg|webp|woff2?)$", re.IGNORECASE)
HTML_ATTR = re.compile(
    r"\b(href|src|srcset|imagesrcset|data-capa|data-contracapa|data-lombada)=(['\"])(.*?)\2",
    re.IGNORECASE,
)
DETERMINISTIC_STYLE = """
*, *::before, *::after {
  animation: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
  transition: none !important;
}
html { scroll-behavior: auto !important; }
.hero-obj__gl, .showcase__canvas { opacity: 0 !important; }
.hero-obj__poster, .showcase__poster { opacity: 1 !important; }
"""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def wait_for_server(host: str, port: int, timeout: float = 10.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(f"http://{host}:{port}/", timeout=0.5) as response:
                if response.status == 200:
                    return True
        except OSError:
            time.sleep(0.1)
    return False


def start_server() -> tuple[subprocess.Popen[bytes] | None, str]:
    host, port = "127.0.0.1", 8765
    if wait_for_server(host, port, timeout=0.25):
        return None, f"http://{host}:{port}"
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", host],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    if not wait_for_server(host, port):
        server.terminate()
        raise RuntimeError("servidor local não respondeu em 10 s")
    return server, f"http://{host}:{port}"


def stop_server(server: subprocess.Popen[bytes] | None) -> None:
    if server is None:
        return
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait(timeout=5)


def _rounded_rect(rect: dict[str, float]) -> dict[str, float]:
    return {key: round(float(rect[key]), 2) for key in ("x", "y", "width", "height")}


def inspect_page(page, viewport: tuple[int, int]) -> dict[str, object]:
    width, _ = viewport
    result = page.evaluate(
        """({ selectors, sectionKeys, viewportWidth }) => {
          const missing = [];
          const rects = {};
          for (const [name, selector] of Object.entries(selectors)) {
            const node = document.querySelector(selector);
            if (!node) { missing.push(`${name}:${selector}`); continue; }
            const r = node.getBoundingClientRect();
            rects[name] = {
              x: r.x + scrollX, y: r.y + scrollY,
              width: r.width, height: r.height
            };
          }
          const brokenImages = [...document.images]
            .filter(img => (img.currentSrc || img.getAttribute('src')) && img.complete && img.naturalWidth === 0)
            .map(img => img.currentSrc || img.src);
          const root = getComputedStyle(document.documentElement);
          const tokenNames = [
            '--paper', '--paper-light', '--paper-deep', '--ink', '--ink-soft',
            '--dark', '--dark-soft', '--muted', '--bronze', '--bronze-light',
            '--line', '--line-light', '--white'
          ];
          const tokens = Object.fromEntries(tokenNames.map(name => [name, root.getPropertyValue(name).trim()]));
          const fontSelectors = { body: 'body', h1: '#hero-title', lead: '.hero-lead', cta: '.hero-actions .liquid-button-gold' };
          const fonts = Object.fromEntries(Object.entries(fontSelectors).map(([name, selector]) => {
            const node = document.querySelector(selector);
            return [name, node ? getComputedStyle(node).fontFamily : null];
          }));
          const h1 = document.querySelector('#hero-title');
          let h1Lines = 0;
          if (h1) {
            const range = document.createRange();
            range.selectNodeContents(h1);
            const tops = [...range.getClientRects()]
              .filter(r => r.width > 0 && r.height > 0)
              .map(r => Math.round(r.top * 2) / 2);
            h1Lines = new Set(tops).size;
          }
          const sectionOrder = sectionKeys.map(name => ({ name, y: rects[name]?.y ?? null }));
          return {
            brokenImages, documentHeight: document.documentElement.scrollHeight,
            fonts, h1: { lines: h1Lines, height: rects.h1?.height ?? null },
            horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewportWidth,
            missing, rects, sectionOrder, tokens
          };
        }""",
        {"selectors": RECT_SELECTORS, "sectionKeys": SECTION_KEYS, "viewportWidth": width},
    )
    result["rects"] = {name: _rounded_rect(rect) for name, rect in result["rects"].items()}
    result["h1"]["height"] = round(float(result["h1"]["height"]), 2)
    result["sectionOrder"] = [
        {"name": item["name"], "y": round(float(item["y"]), 2)} for item in result["sectionOrder"]
    ]
    result["horizontalOverflow"] = round(float(result["horizontalOverflow"]), 2)
    return result


def assert_page_contract(data: dict[str, object], viewport_name: str) -> None:
    problems: list[str] = []
    if data["missing"]:
        problems.append(f"seletores ausentes: {', '.join(data['missing'])}")
    if data["brokenImages"]:
        problems.append(f"imagens quebradas: {', '.join(data['brokenImages'])}")
    if float(data["horizontalOverflow"]) > 1:
        problems.append(f"overflow horizontal de {data['horizontalOverflow']} px")
    section_y = [float(item["y"]) for item in data["sectionOrder"]]
    if section_y != sorted(section_y) or len(set(section_y)) != len(section_y):
        problems.append("ordem vertical das cinco seções divergiu")
    if int(data["h1"]["lines"]) < 1 or float(data["h1"]["height"]) <= 0:
        problems.append("métrica do H1 inválida")
    if problems:
        raise RuntimeError(f"{viewport_name}: " + "; ".join(problems))


def prepare_page(page, base_url: str, timeout_ms: int) -> dict[str, object]:
    page.add_init_script(
        """localStorage.setItem('avila:consentimento', JSON.stringify({
          versao: 1, escolhas: { essenciais: true, estatisticas: false, marketing: false }
        }));"""
    )
    page.goto(f"{base_url}/", wait_until="load", timeout=timeout_ms)
    page.add_style_tag(content=DETERMINISTIC_STYLE)
    page.evaluate("document.documentElement.classList.remove('preloader-capable'); document.body.classList.remove('esta-carregando')")
    page.evaluate("document.fonts.ready")
    page.evaluate(
        """async () => {
          const step = Math.max(400, innerHeight * .8);
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            scrollTo(0, y);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          }
          scrollTo(0, 0);
          await Promise.all([...document.images].map(img => img.complete
            ? Promise.resolve()
            : new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); })));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }"""
    )
    return inspect_page(page, (page.viewport_size["width"], page.viewport_size["height"]))


def capture_visual_baseline(output: Path, timeout: int, replace: bool) -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[visual-baseline] FAIL — instale Playwright com requirements-dev.txt")
        return 1

    output = output.resolve()
    manifest_path = output / "manifest.json"
    existing = list(output.glob("*.png")) if output.exists() else []
    if (manifest_path.exists() or existing) and not replace:
        print("[visual-baseline] FAIL — baseline já existe; use --replace para sobrescrever")
        return 1
    output.mkdir(parents=True, exist_ok=True)
    if replace:
        for path in (*output.glob("*.png"), manifest_path):
            if path.exists():
                path.unlink()

    server = None
    try:
        server, base_url = start_server()
        manifest: dict[str, object] = {
            "deviceScaleFactor": 1,
            "formatVersion": 1,
            "reducedMotion": "reduce",
            "sourceHashes": {
                "build/baseline-v1.6.json": sha256_file(ROOT / "build" / "baseline-v1.6.json"),
                "assets/css/style.css": sha256_file(ROOT / "assets" / "css" / "style.css"),
                "index.html": sha256_file(ROOT / "index.html"),
            },
            "viewports": {},
        }
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                for width, height in VIEWPORTS:
                    name = f"{width}x{height}"
                    context = browser.new_context(
                        viewport={"width": width, "height": height},
                        device_scale_factor=1,
                        reduced_motion="reduce",
                    )
                    page = context.new_page()
                    data = prepare_page(page, base_url, timeout * 1000)
                    assert_page_contract(data, name)
                    full_path = output / f"{name}-full.png"
                    hero_path = output / f"{name}-hero.png"
                    page.screenshot(path=str(full_path), full_page=True, animations="disabled")
                    page.locator(".hero").screenshot(path=str(hero_path), animations="disabled")
                    from PIL import Image

                    images: dict[str, object] = {}
                    for label, path in (("full", full_path), ("hero", hero_path)):
                        with Image.open(path) as image:
                            dimensions = {"width": image.width, "height": image.height}
                        images[label] = {
                            "bytes": path.stat().st_size,
                            "dimensions": dimensions,
                            "path": relative(path),
                            "sha256": sha256_file(path),
                        }
                    data["images"] = images
                    manifest["viewports"][name] = data
                    context.close()
                    print(f"[visual-baseline] CAPTURE {name}")
            finally:
                browser.close()
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
        print(f"[visual-baseline] PASS — 10 PNGs e manifesto em {relative(output)}")
        return 0
    except Exception as exc:  # noqa: BLE001 - CLI deve converter falha em exit code
        print(f"[visual-baseline] FAIL — {exc}")
        return 1
    finally:
        stop_server(server)


def verify_visual_baseline(manifest_path: Path, timeout: int) -> int:
    try:
        from PIL import Image
        from playwright.sync_api import sync_playwright

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("deviceScaleFactor") != 1 or manifest.get("reducedMotion") != "reduce":
            raise RuntimeError("modo determinístico ausente do manifesto")
        for source, digest in manifest.get("sourceHashes", {}).items():
            if Path(source).is_absolute() or not re.fullmatch(r"[0-9a-f]{64}", digest):
                raise RuntimeError("rastreabilidade dos fontes inválida")
        expected_names = {f"{width}x{height}" for width, height in VIEWPORTS}
        if set(manifest.get("viewports", {})) != expected_names:
            raise RuntimeError("conjunto de viewports divergente")
        for name, entry in manifest["viewports"].items():
            for label in ("full", "hero"):
                image_info = entry["images"][label]
                image_path = ROOT / image_info["path"]
                if not image_path.is_file() or image_path.stat().st_size <= 0:
                    raise RuntimeError(f"{name}/{label}: PNG ausente ou vazio")
                if sha256_file(image_path) != image_info["sha256"]:
                    raise RuntimeError(f"{name}/{label}: SHA-256 divergente")
                with Image.open(image_path) as image:
                    dimensions = {"width": image.width, "height": image.height}
                if dimensions != image_info["dimensions"]:
                    raise RuntimeError(f"{name}/{label}: dimensões divergentes")

        server, base_url = start_server()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                try:
                    for width, height in VIEWPORTS:
                        name = f"{width}x{height}"
                        context = browser.new_context(
                            viewport={"width": width, "height": height},
                            device_scale_factor=1,
                            reduced_motion="reduce",
                        )
                        page = context.new_page()
                        current = prepare_page(page, base_url, timeout * 1000)
                        assert_page_contract(current, name)
                        recorded = manifest["viewports"][name]
                        for key in ("fonts", "tokens", "h1", "rects", "sectionOrder"):
                            if current[key] != recorded[key]:
                                raise RuntimeError(f"{name}: contrato {key} divergiu")
                        context.close()
                finally:
                    browser.close()
        finally:
            stop_server(server)
        print("[visual-baseline] PASS — hashes, dimensões e geometria conferem")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"[visual-baseline] FAIL — {exc}")
        return 1


def load_asset_manifest() -> dict[str, object]:
    manifest_path = ROOT / "build" / "asset-manifest.json"
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def run_local(command: list[str], timeout: int) -> tuple[int, str]:
    result = subprocess.run(
        command,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    output = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
    return result.returncode, output


def pipeline_checks(timeout: int) -> list[str]:
    failures: list[str] = []
    npm = shutil.which("npm")
    if npm is None:
        return ["npm não encontrado"]
    try:
        manifest = load_asset_manifest()
    except (OSError, json.JSONDecodeError) as exc:
        return [f"manifesto inválido: {exc}"]
    assets = manifest.get("assets", {})
    if manifest.get("algorithm") != "sha256":
        failures.append("algorithm do manifesto não é sha256")
    if list(assets) != sorted(assets):
        failures.append("chaves do manifesto não estão ordenadas")
    for public_name, entry in assets.items():
        if Path(public_name).is_absolute() or "\\" in public_name or ".." in Path(public_name).parts:
            failures.append(f"caminho público inseguro: {public_name}")
            continue
        if not re.fullmatch(r"[0-9a-f]{12}", str(entry.get("sha256", ""))):
            failures.append(f"hash inválido: {public_name}")
        emitted = str(entry.get("emitted", ""))
        source = str(entry.get("source", ""))
        if Path(emitted).is_absolute() or Path(source).is_absolute():
            failures.append(f"manifesto contém caminho absoluto: {public_name}")
        asset_path = ROOT / emitted
        if not asset_path.is_file():
            failures.append(f"asset emitido ausente: {emitted}")
            continue
        if asset_path.stat().st_size != entry.get("bytes"):
            failures.append(f"tamanho divergente: {emitted}")
        if sha256_file(asset_path)[:12] != entry.get("sha256"):
            failures.append(f"SHA-256 divergente: {emitted}")
    for source_name, output_name in OUTPUT_PAIRS:
        source_path, output_path = ROOT / source_name, ROOT / output_name
        if not output_path.is_file():
            failures.append(f"output obrigatório ausente: {output_name}")
        elif output_path.stat().st_size >= source_path.stat().st_size:
            failures.append(f"output não minificou: {output_name}")
        elif re.search(rb"sourceMappingURL|[A-Za-z]:\\", output_path.read_bytes()):
            failures.append(f"output contém sourcemap/caminho absoluto: {output_name}")
    code, output = run_local([npm, "run", "build:check"], timeout)
    if code:
        failures.append(f"npm run build:check retornou {code}: {output}")
    return failures


def _is_external(value: str) -> bool:
    return bool(re.match(r"^(?:[a-z]+:|//|#|/)", value, re.IGNORECASE))


def _split_candidate(value: str) -> tuple[str, str]:
    match = re.match(r"^(.*?)(\s+\d+(?:\.\d+)?[wx])$", value, re.IGNORECASE)
    return (match.group(1), match.group(2)) if match else (value, "")


def versioning_checks() -> list[str]:
    failures: list[str] = []
    manifest = load_asset_manifest()
    assets = manifest["assets"]
    for html_name in ("index.html", "politica.html"):
        html = (ROOT / html_name).read_text(encoding="utf-8")
        if "?v=2026" in html:
            failures.append(f"{html_name}: timestamp manual remanescente")
        for match in HTML_ATTR.finditer(html):
            attribute, value = match.group(1).lower(), match.group(3)
            candidates = value.split(",") if "srcset" in attribute else [value]
            for candidate in candidates:
                url, _descriptor = _split_candidate(candidate.strip())
                if not url or _is_external(url):
                    continue
                clean = url.split("?", 1)[0]
                if not VERSIONABLE.search(clean):
                    continue
                if url.count("?v=") != 1:
                    failures.append(f"{html_name}: versão ausente/duplicada em {url}")
                    continue
                version = url.split("?v=", 1)[1]
                entry = assets.get(clean)
                if not entry:
                    failures.append(f"{html_name}: {clean} não existe no manifesto")
                elif version != entry["sha256"]:
                    failures.append(f"{html_name}: versão divergente em {clean}")
        for source_name, output_name in OUTPUT_PAIRS:
            if source_name in html and output_name != "assets/build/brain-particles.min.js":
                failures.append(f"{html_name}: aponta para fonte em vez de minificado: {source_name}")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    config_position = index.find("assets/build/config.min.js?v=")
    controller_position = index.find("assets/build/main.min.js?v=")
    if config_position < 0 or controller_position < 0 or config_position >= controller_position:
        failures.append("ordem CONFIG → main não foi preservada")
    for script in re.finditer(r"<script\b(?![^>]*type=['\"]application/ld\+json['\"])[^>]*\bsrc=['\"][^'\"]+['\"][^>]*>", index, re.IGNORECASE):
        if not re.search(r"\bdefer\b", script.group(0), re.IGNORECASE):
            failures.append(f"script sem defer: {script.group(0)}")
    fonts_css = (ROOT / "assets/build/fonts.min.css").read_text(encoding="utf-8")
    for url in re.findall(r"url\((?:['\"])?([^)'\"]+)", fonts_css, re.IGNORECASE):
        clean = url.split("?", 1)[0].replace("../fontes/", "assets/fontes/")
        version = url.split("?v=", 1)[1] if "?v=" in url else ""
        if clean not in assets or assets[clean]["sha256"] != version:
            failures.append(f"fonts.min.css: fonte sem versão válida: {url}")
    for output_name in ("assets/build/config.min.js", "assets/build/main.min.js", "assets/build/book-3d.min.js"):
        source = (ROOT / output_name).read_text(encoding="utf-8")
        for match in re.finditer(r"assets/[^'\"`\s]+?\.(?:avif|gif|jpe?g|png|svg|webp|woff2?)(?:\?v=([0-9a-f]{12}))?", source, re.IGNORECASE):
            clean = match.group(0).split("?", 1)[0]
            if not match.group(1) or clean not in assets or assets[clean]["sha256"] != match.group(1):
                failures.append(f"{output_name}: referência runtime sem versão válida: {match.group(0)}")
    return failures


def reproducibility_snapshot() -> dict[str, str]:
    allowlist = [ROOT / "build" / "asset-manifest.json", ROOT / "index.html", ROOT / "politica.html"]
    allowlist.extend(sorted((ROOT / "assets" / "build").rglob("*")))
    return {
        relative(path): sha256_file(path)
        for path in allowlist
        if path.is_file()
    }


def reproducibility_checks(timeout: int) -> list[str]:
    failures: list[str] = []
    npm = shutil.which("npm")
    if npm is None:
        return ["npm não encontrado"]
    output_dir = ROOT / "build" / "_phase19"
    output_dir.mkdir(parents=True, exist_ok=True)
    snapshots: list[dict[str, str]] = []
    for label in ("before", "after"):
        code, output = run_local([npm, "run", "build"], timeout)
        if code:
            return [f"build {label} retornou {code}: {output}"]
        snapshot = reproducibility_snapshot()
        snapshots.append(snapshot)
        (output_dir / f"repro-{label}.json").write_text(
            json.dumps(snapshot, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
    if snapshots[0] != snapshots[1]:
        before, after = snapshots
        changed = sorted({*before, *after} - {name for name in before if before.get(name) == after.get(name)})
        failures.append("snapshots divergentes: " + ", ".join(changed))
    return failures


def run_groups(groups: list[str], timeout: int) -> int:
    selected = list(GROUPS) if not groups or "all" in groups else list(dict.fromkeys(groups))
    all_failures: list[str] = []
    for group in selected:
        if group == "pipeline":
            failures = pipeline_checks(timeout)
        elif group == "versioning":
            failures = versioning_checks()
        else:
            failures = reproducibility_checks(timeout)
        if failures:
            print(f"[{group}] FAIL — {len(failures)} ocorrência(s)")
            for failure in failures:
                print(f"  [{group}] {failure}")
            all_failures.extend(failures)
        else:
            print(f"[{group}] PASS")
    return int(bool(all_failures))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Checks locais da Phase 19.")
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--capture-visual-baseline", action="store_true")
    action.add_argument("--verify-visual-baseline", action="store_true")
    parser.add_argument("--group", action="append", choices=(*GROUPS, "all"), default=[])
    parser.add_argument("--output", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE / "manifest.json")
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--timeout", type=int, default=120)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.capture_visual_baseline:
        return capture_visual_baseline(args.output, args.timeout, args.replace)
    if args.verify_visual_baseline:
        return verify_visual_baseline(args.baseline.resolve(), args.timeout)
    return run_groups(args.group, args.timeout)


if __name__ == "__main__":
    raise SystemExit(main())
