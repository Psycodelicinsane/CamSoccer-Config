"""Generate the static Google Play feature graphic (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets"
OUT.mkdir(exist_ok=True)
W, H = 1024, 500
image = Image.new("RGB", (W, H), "#080d12")
pixels = image.load()
for y in range(H):
    for x in range(W):
        glow = max(0, 1 - (((x - 210) / 520) ** 2 + ((y - 220) / 440) ** 2))
        pixels[x, y] = (int(8 + glow * 13), int(13 + glow * 24), int(18 + glow * 20))
draw = ImageDraw.Draw(image)
for x in range(0, W, 40):
    draw.line((x, 0, x, H), fill=(14, 24, 30), width=1)
for y in range(0, H, 40):
    draw.line((0, y, W, y), fill=(14, 24, 30), width=1)

# Broadcast framing motif.
for points in [((28, 78), (28, 28), (78, 28)), ((946, 28), (996, 28), (996, 78)), ((28, 422), (28, 472), (78, 472)), ((946, 472), (996, 472), (996, 422))]:
    draw.line(points, fill=(76, 104, 88), width=3, joint="curve")

source_icon = Image.open(ROOT / "public" / "pwa-512.png").convert("RGBA")
source_icon.save(OUT / "icon-512.png", optimize=True)
icon = source_icon.resize((278, 278), Image.Resampling.LANCZOS)
image.paste(icon, (62, 113), icon)

font_dir = Path("/usr/share/fonts/truetype/dejavu")
def font(name, size):
    try:
        return ImageFont.truetype(str(font_dir / name), size)
    except OSError:
        return ImageFont.load_default()

small = font("DejaVuSans-Bold.ttf", 16)
title = font("DejaVuSans-Bold.ttf", 62)
subtitle = font("DejaVuSans.ttf", 25)
badge = font("DejaVuSans-Bold.ttf", 18)

draw.rounded_rectangle((387, 79, 619, 111), radius=7, fill=(28, 44, 34), outline=(71, 102, 64), width=1)
draw.ellipse((402, 91, 410, 99), fill="#b9ed73")
draw.text((421, 87), "BROADCAST CLUB", font=small, fill="#b9ed73")
draw.text((382, 135), "CAMSOCCER", font=title, fill="#f3f6f4", stroke_width=1, stroke_fill="#f3f6f4")
draw.rectangle((387, 216, 473, 222), fill="#b9ed73")
draw.text((387, 248), "Tú diriges la retransmisión.", font=subtitle, fill="#c5d0d5")
draw.text((387, 283), "La audiencia decide.", font=subtitle, fill="#c5d0d5")
draw.text((387, 357), "CARRERA  ·  COPA  ·  ARCADE", font=badge, fill="#f5cf68")
draw.text((387, 398), "Offline · Sin anuncios", font=small, fill="#7f929c")
image.save(OUT / "feature-graphic.png", optimize=True)
print("Store icon and 1024x500 feature graphic generated")
