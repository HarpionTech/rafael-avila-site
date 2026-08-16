"""Matriz local e deterministica para GA4/Meta subordinados ao consentimento.

Os scripts de terceiros sao interceptados pelo Playwright e respondidos localmente:
nenhuma execucao deste arquivo envia telemetria real.
"""

from __future__ import annotations

import json
import re
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
BASE_COMMIT = "0887ce3"
PROVIDERS = ("googletagmanager.com", "google-analytics.com", "facebook.net", "facebook.com")
ALLOWED_PARAMS = {"position", "product"}
FORBIDDEN_FRAGMENTS = (
    "5548991947402",
    "gostaria de marcar",
    "wa.me",
    "hotmart.com",
    "href",
    "text",
    "telefone",
    "diagnostico",
    "terapeutico",
)


def fail(message: str) -> None:
    raise AssertionError(message)


def git_show(path: str) -> str:
    result = subprocess.run(
        ["git", "show", f"{BASE_COMMIT}:{path}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode:
        fail(result.stderr.strip() or f"git show falhou para {path}")
    return result.stdout


def extract_function(source: str, name: str) -> str:
    marker = f"function {name}("
    start = source.find(marker)
    if start < 0:
        fail(f"funcao {name} ausente")
    brace = source.find("{", start)
    depth = 0
    quote = None
    escaped = False
    for index in range(brace, len(source)):
        char = source[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "'\"`":
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[start:index + 1]
    fail(f"funcao {name} incompleta")


def static_contract() -> None:
    current_main = (ROOT / "assets/js/main.js").read_text(encoding="utf-8")
    if extract_function(current_main, "setupPreloader") != extract_function(git_show("assets/js/main.js"), "setupPreloader"):
        fail("setupPreloader() mudou em relacao a 27a209f")

    current_html = (ROOT / "index.html").read_text(encoding="utf-8")
    base_html = git_show("index.html")
    block = re.compile(r'<div class="preloader"[\s\S]*?(?=\n\s*<header)')
    if not block.search(current_html) or block.search(current_html).group(0) != block.search(base_html).group(0):
        fail("markup da cortina mudou em relacao a 27a209f")

    css_diff = subprocess.run(
        ["git", "diff", "--quiet", BASE_COMMIT, "--", "assets/css/style.css"],
        cwd=ROOT,
        check=False,
    )
    if css_diff.returncode:
        fail("CSS visual/preloader mudou em relacao a 27a209f")

    config = (ROOT / "assets/js/config.js").read_text(encoding="utf-8")
    ga4 = re.search(r"ga4Id\s*:\s*'([^']*)'", config)
    meta = re.search(r"metaPixelId\s*:\s*'([^']*)'", config)
    if not ga4 or not meta:
        fail("ga4Id e metaPixelId precisam existir em config.js como literal simples")
    # Vazio e um estado valido — e o que mantem a medicao inerte. O que nao pode e
    # um valor malformado: ele carrega, mede para lugar nenhum e o problema so
    # aparece semanas depois, com o relatorio vazio.
    if ga4.group(1) and not re.fullmatch(r"G-[A-Z0-9]{6,12}", ga4.group(1)):
        fail(f"ga4Id fora do formato G-XXXXXXX: {ga4.group(1)!r}")
    if meta.group(1) and not re.fullmatch(r"\d{15,16}", meta.group(1)):
        fail(f"metaPixelId fora do formato (15-16 digitos): {meta.group(1)!r}")

    # config.js e a UNICA fonte. ID repetido em outro arquivo cria a pior falha
    # possivel: trocar o valor no lugar obvio e a pagina continuar medindo para o
    # antigo, escondido em algum outro ponto.
    for caminho in ("assets/js/tracking.js", "assets/js/main.js", "index.html"):
        texto = (ROOT / caminho).read_text(encoding="utf-8")
        achado = re.search(r"G-[A-Z0-9]{6,12}\b|\b\d{15,16}\b", texto)
        if achado:
            fail(f"{caminho} tem ID de medicao embutido: {achado.group(0)}")

    if not (ROOT / "assets/js/tracking.js").is_file():
        fail("assets/js/tracking.js ainda nao existe")


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_server(url: str) -> None:
    for _ in range(60):
        try:
            with urlopen(url, timeout=0.4) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.1)
    fail("servidor local nao iniciou")


def stored_choice(choice: dict[str, bool] | None) -> str:
    if choice is None:
        return "localStorage.removeItem('avila:consentimento')"
    payload = json.dumps({"escolhas": {"essenciais": True, **choice}, "versao": 1, "em": "2026-08-15T00:00:00.000Z"})
    return f"localStorage.setItem('avila:consentimento', {json.dumps(payload)})"


def scenario(page, base_url: str, name: str, ga4: str, meta: str, choice: dict[str, bool] | None):
    requests: list[str] = []
    page.on("request", lambda request: requests.append(request.url) if any(host in request.url for host in PROVIDERS) else None)

    # A pagina serve o config MINIFICADO (pipeline content-addressed da phase 19);
    # e esse arquivo que precisa ser interceptado, nao a fonte.
    config_source = (ROOT / "assets/build/config.min.js").read_text(encoding="utf-8")
    override = f"\nwindow.CONFIG.medicao = {{ ga4Id: {json.dumps(ga4)}, metaPixelId: {json.dumps(meta)} }};\n"
    page.route("**/assets/build/config.min.js*", lambda route: route.fulfill(status=200, content_type="application/javascript", body=config_source + override))
    page.route("https://www.googletagmanager.com/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body="/* stub GA4 local */"))
    page.route("https://connect.facebook.net/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body="/* stub Meta local */"))
    page.route("https://www.google-analytics.com/**", lambda route: route.fulfill(status=204, body=""))
    page.route("https://www.facebook.com/**", lambda route: route.fulfill(status=204, body=""))
    page.add_init_script(stored_choice(choice))
    page.goto(f"{base_url}/index.html?tracking-test={name}", wait_until="domcontentloaded")
    page.wait_for_timeout(300)
    snapshot = page.evaluate("""() => ({
      dataLayer: Array.isArray(window.dataLayer) ? window.dataLayer.map(x => Array.from(x)) : [],
      fbq: window.fbq && Array.isArray(window.fbq.queue) ? window.fbq.queue.map(x => Array.from(x)) : [],
      scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean),
      api: window.SiteTracking ? window.SiteTracking.estado() : null
    })""")
    return requests, snapshot


def provider_requests(requests: list[str], provider: str) -> list[str]:
    if provider == "ga4":
        return [url for url in requests if "googletagmanager.com" in url or "google-analytics.com" in url]
    return [url for url in requests if "facebook.net" in url or "facebook.com" in url]


def count_command(queue: list[list], name: str) -> int:
    return sum(1 for item in queue if name in item)


def count_measurements(data_layer: list[list], fbq_queue: list[list]) -> tuple[int, int]:
    """Comandos que de fato MEDEM, separados dos que administram consentimento."""
    ga4 = sum(1 for command in data_layer if command and command[0] == "event")
    meta = sum(1 for command in fbq_queue if command and command[0] in ("track", "trackCustom"))
    return ga4, meta


def assert_no_provider(requests: list[str], label: str) -> None:
    if requests:
        fail(f"{label}: houve request de provedor: {requests}")


def browser_contract() -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        fail(f"Playwright Python ausente: {exc}")

    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-u", "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        wait_server(f"{base_url}/index.html")
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)

            def run(name: str, ga4: str, meta: str, choice):
                context = browser.new_context()
                page = context.new_page()
                result = scenario(page, base_url, name, ga4, meta, choice)
                return context, page, *result

            context, page, requests, snap = run("sem-decisao", "G-TEST12345", "123456789012345", None)
            assert_no_provider(requests, "sem decisao")
            if snap["api"] and (snap["api"].get("ga4") or snap["api"].get("meta")):
                fail("adaptador inicializou sem decisao")
            context.close()

            for label, ga4, meta in (("vazios", "", ""), ("invalidos", "UA-123", "pixel-abc")):
                context, page, requests, snap = run(label, ga4, meta, {"estatisticas": True, "marketing": True})
                assert_no_provider(requests, label)
                context.close()

            context, page, requests, snap = run("estatisticas", "G-TEST12345", "123456789012345", {"estatisticas": True, "marketing": False})
            if len(provider_requests(requests, "ga4")) != 1 or provider_requests(requests, "meta"):
                fail(f"estatisticas segmentadas incorretamente: {requests}")
            if count_command(snap["dataLayer"], "config") != 1 or count_command(snap["dataLayer"], "page_view") != 1:
                fail(f"GA4 nao inicializou/page_view exatamente uma vez: {snap['dataLayer']}")
            context.close()

            context, page, requests, snap = run("marketing", "G-TEST12345", "123456789012345", {"estatisticas": False, "marketing": True})
            if len(provider_requests(requests, "meta")) != 1 or provider_requests(requests, "ga4"):
                fail(f"marketing segmentado incorretamente: {requests}")
            if count_command(snap["fbq"], "init") != 1 or count_command(snap["fbq"], "PageView") != 1:
                fail(f"Meta nao inicializou/PageView exatamente uma vez: {snap['fbq']}")
            context.close()

            context, page, requests, snap = run("completo", "G-TEST12345", "123456789012345", {"estatisticas": True, "marketing": True})
            page.evaluate("""() => {
              Consentimento.registra({ estatisticas: true, marketing: true });
              Consentimento.registra({ estatisticas: true, marketing: true });
              const prevent = event => event.preventDefault();
              document.addEventListener('click', prevent, true);
              document.querySelector('[data-track-event="whatsapp_click"]').click();
              document.querySelector('[data-track-event="hotmart_click"]').click();
            }""")
            page.wait_for_timeout(100)
            final = page.evaluate("""() => ({
              dataLayer: window.dataLayer.map(x => Array.from(x)),
              fbq: window.fbq.queue.map(x => Array.from(x)),
              estado: window.SiteTracking.estado()
            })""")
            if len(provider_requests(requests, "ga4")) != 1 or len(provider_requests(requests, "meta")) != 1:
                fail(f"loaders duplicados no consentimento completo: {requests}")
            if count_command(final["dataLayer"], "page_view") != 1 or count_command(final["fbq"], "PageView") != 1:
                fail("PageView duplicada")
            # `default=str` porque o gtag('js', new Date()) chega como datetime pelo
            # Playwright; vira o ISO e segue valendo para a varredura de fragmentos.
            serialized = json.dumps(final, ensure_ascii=False, default=str).lower()
            if any(fragment in serialized for fragment in FORBIDDEN_FRAGMENTS):
                fail(f"payload contem dado proibido: {serialized}")
            params = []
            for queue in (final["dataLayer"], final["fbq"]):
                for command in queue:
                    for item in command:
                        if isinstance(item, dict):
                            params.append(item)
            for payload in params:
                unknown = set(payload) - ALLOWED_PARAMS - {"send_page_view", "analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"}
                if unknown:
                    fail(f"chaves fora da allowlist: {sorted(unknown)}")

            before = count_measurements(final["dataLayer"], final["fbq"])
            page.evaluate("""() => {
              Consentimento.registra({ estatisticas: false, marketing: false });
              document.querySelector('[data-track-event="whatsapp_click"]').click();
              document.querySelector('[data-track-event="hotmart_click"]').click();
            }""")
            revogado = page.evaluate("""() => ({
              dataLayer: window.dataLayer.map(x => Array.from(x)),
              fbq: window.fbq.queue.map(x => Array.from(x))
            })""")
            after = count_measurements(revogado["dataLayer"], revogado["fbq"])
            if after != before:
                fail("revogacao nao bloqueou novos eventos imediatamente")
            # A revogacao PRECISA falar com os provedores — `consent update` no GA4 e
            # `consent revoke` no Pixel. Contar o tamanho bruto das filas puniria
            # justamente o sinal que interrompe a medicao, entao a comparacao acima
            # olha so os comandos que MEDEM.
            if not any(command[:2] == ["consent", "update"] for command in revogado["dataLayer"]):
                fail("GA4 nao recebeu consent update na revogacao")
            if not any(command[:2] == ["consent", "revoke"] for command in revogado["fbq"]):
                fail("Pixel nao recebeu consent revoke na revogacao")
            context.close()
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill()


def main() -> int:
    try:
        static_contract()
        browser_contract()
    except AssertionError as exc:
        print(f"FALHOU: {exc}")
        return 1
    print("OK: tracking inerte, consentido, idempotente e sem payload sensivel")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
