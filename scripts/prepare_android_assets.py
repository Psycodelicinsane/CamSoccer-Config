"""Apply CamSoccer branding to the generated Android resources (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
source = Image.open(ROOT / "public" / "pwa-512.png").convert("RGBA")
DENSITIES = {
    "mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216),
    "xxhdpi": (144, 324), "xxxhdpi": (192, 432),
}

for density, (launcher_size, foreground_size) in DENSITIES.items():
    folder = RES / f"mipmap-{density}"
    icon = source.resize((launcher_size, launcher_size), Image.Resampling.LANCZOS)
    icon.save(folder / "ic_launcher.png", optimize=True)
    mask = Image.new("L", (launcher_size, launcher_size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, launcher_size, launcher_size), fill=255)
    round_icon = Image.new("RGBA", (launcher_size, launcher_size), (8, 13, 18, 255))
    round_icon.paste(icon, (0, 0), mask)
    round_icon.save(folder / "ic_launcher_round.png", optimize=True)
    foreground = Image.new("RGBA", (foreground_size, foreground_size), (0, 0, 0, 0))
    inner = int(foreground_size * 0.72)
    logo = source.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (foreground_size - inner) // 2
    foreground.alpha_composite(logo, (offset, offset))
    foreground.save(folder / "ic_launcher_foreground.png", optimize=True)

font_path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
for splash_path in RES.glob("drawable*/splash.png"):
    old = Image.open(splash_path)
    width, height = old.size
    splash = Image.new("RGB", (width, height), "#080d12")
    draw = ImageDraw.Draw(splash)
    logo_size = max(72, int(min(width, height) * 0.25))
    logo = source.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    logo_y = int(height * 0.40 - logo_size / 2)
    splash.paste(logo, ((width - logo_size) // 2, logo_y), logo)
    title_size = max(18, int(min(width, height) * 0.052))
    subtitle_size = max(8, int(title_size * 0.28))
    try:
        title_font = ImageFont.truetype(str(font_path), title_size)
        subtitle_font = ImageFont.truetype(str(font_path), subtitle_size)
    except OSError:
        title_font = subtitle_font = ImageFont.load_default()
    title = "CAMSOCCER"
    subtitle = "BROADCAST CLUB"
    title_box = draw.textbbox((0, 0), title, font=title_font)
    draw.text(((width - (title_box[2] - title_box[0])) / 2, logo_y + logo_size + title_size * 0.65), title, font=title_font, fill="#f3f6f4")
    subtitle_box = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    draw.text(((width - (subtitle_box[2] - subtitle_box[0])) / 2, logo_y + logo_size + title_size * 1.75), subtitle, font=subtitle_font, fill="#b9ed73")
    splash.save(splash_path, optimize=True)

print("Android launcher and splash branding updated")
