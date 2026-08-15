"""Gera o preview social 1200x630 a partir de fotografias reais versionadas.

O arquivo final combina a fotografia aprovada de Rafael com o ambiente da hero e
as fontes locais do site. Nao cria logotipo, simbolo, iniciais-marca ou rosto.

Uso:
  python build/social.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
PROFILE = ASSETS / "perfil.png"
BACKGROUND = ASSETS / "hero-1920.webp"
NEWSREADER = ASSETS / "fontes" / "newsreader-v26-cy9afjocx1hbuyalurk4397yja.woff2"
IBM_PLEX = ASSETS / "fontes" / "ibmplexsans-v23-zyxzkvelmyyaje8bplhncwdkr932-g7dytd-dmu1syxekyy.woff2"
OUTPUT = ASSETS / "social" / "rafael-avila-1200x630.webp"

SIZE = (1200, 630)
MAX_BYTES = 300 * 1024
SAFE_X = 76


def require_inputs() -> None:
    missing = [path for path in (PROFILE, BACKGROUND, NEWSREADER, IBM_PLEX) if not path.is_file()]
    if missing:
        labels = ", ".join(str(path.relative_to(ROOT)) for path in missing)
        raise SystemExit(f"[SOCIAL] entrada(s) ausente(s): {labels}")


def horizontal_gradient(width: int, height: int, stops: tuple[tuple[int, int, int, int], ...]) -> Image.Image:
    """Cria um gradiente RGBA deterministico a partir de paradas igualmente espacadas."""

    pixels: list[tuple[int, int, int, int]] = []
    segments = len(stops) - 1
    for x in range(width):
        position = x / max(width - 1, 1) * segments
        segment = min(int(position), segments - 1)
        amount = position - segment
        left, right = stops[segment], stops[segment + 1]
        pixels.append(tuple(round(a + (b - a) * amount) for a, b in zip(left, right)))
    row = Image.new("RGBA", (width, 1))
    row.putdata(pixels)
    return row.resize((width, height))


def compose() -> Image.Image:
    require_inputs()

    with Image.open(BACKGROUND) as source:
        background = ImageOps.fit(source.convert("RGB"), SIZE, method=Image.Resampling.LANCZOS, centering=(0.55, 0.5))
    background = ImageEnhance.Contrast(background).enhance(1.08).convert("RGBA")
    background.alpha_composite(Image.new("RGBA", SIZE, (5, 14, 12, 112)))

    with Image.open(PROFILE) as source:
        portrait = ImageOps.fit(
            source.convert("RGB"),
            (585, 630),
            method=Image.Resampling.LANCZOS,
            centering=(0.54, 0.43),
        ).convert("RGBA")
    portrait = ImageEnhance.Color(portrait).enhance(0.90)
    portrait = ImageEnhance.Contrast(portrait).enhance(1.04)
    portrait_mask = horizontal_gradient(
        portrait.width,
        portrait.height,
        ((0, 0, 0, 0), (0, 0, 0, 220), (0, 0, 0, 255)),
    ).getchannel("A")
    portrait.putalpha(portrait_mask)
    background.alpha_composite(portrait, (615, 0))

    shade = horizontal_gradient(
        SIZE[0],
        SIZE[1],
        ((2, 11, 9, 248), (2, 11, 9, 214), (2, 11, 9, 48), (2, 11, 9, 0)),
    )
    background.alpha_composite(shade)

    draw = ImageDraw.Draw(background)
    label_font = ImageFont.truetype(str(IBM_PLEX), 25)
    title_font = ImageFont.truetype(str(NEWSREADER), 66)
    service_font = ImageFont.truetype(str(IBM_PLEX), 28)

    bronze = "#c58a4b"
    paper = "#f2eadc"
    muted = "#d6cbbb"
    draw.rounded_rectangle((SAFE_X, 92, SAFE_X + 82, 98), radius=3, fill=bronze)
    draw.text((SAFE_X, 126), "RAFAEL ÁVILA", font=label_font, fill=bronze, spacing=2)

    lines = ("Você não precisa", "ser outra pessoa.")
    y = 186
    for line in lines:
        draw.text((SAFE_X, y), line, font=title_font, fill=paper, stroke_width=0)
        y += 72

    draw.text((SAFE_X, 380), "Terapia comportamental online", font=service_font, fill=muted)
    draw.text((SAFE_X, 427), "Breve, prática e objetiva.", font=service_font, fill=muted)
    draw.line((SAFE_X, 512, 540, 512), fill=(197, 138, 75, 120), width=1)
    draw.text((SAFE_X, 536), "rafaelavilaterapeuta.com.br", font=label_font, fill=paper)

    return background.convert("RGB")


def save(image: Image.Image) -> tuple[int, int]:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    chosen_quality = 84
    for quality in range(chosen_quality, 59, -2):
        image.save(OUTPUT, "WEBP", quality=quality, method=6, exact=True, exif=b"", xmp=b"")
        if OUTPUT.stat().st_size <= MAX_BYTES:
            return quality, OUTPUT.stat().st_size
    raise SystemExit(f"[SOCIAL] saida excede {MAX_BYTES} bytes mesmo em qualidade 60")


def main() -> None:
    image = compose()
    if image.size != SIZE:
        raise SystemExit(f"[SOCIAL] dimensao inesperada: {image.size}; esperado: {SIZE}")
    quality, file_size = save(image)
    with Image.open(OUTPUT) as generated:
        if generated.size != SIZE:
            raise SystemExit(f"[SOCIAL] arquivo salvo com dimensao inesperada: {generated.size}")
    print(
        f"[SOCIAL] {OUTPUT.relative_to(ROOT)} {SIZE[0]}x{SIZE[1]} "
        f"{file_size / 1024:.1f} KiB q={quality}"
    )


if __name__ == "__main__":
    main()
