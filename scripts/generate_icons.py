"""Regenerate the local CamSoccer icons (requires Pillow, not needed at runtime)."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)
S = 3
image = Image.new("RGB", (512 * S, 512 * S), "#080d12")
draw = ImageDraw.Draw(image)

def box(coords):
    return tuple(int(value * S) for value in coords)

def rounded(coords, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box(coords), radius=radius * S, fill=fill, outline=outline, width=width * S)

def ellipse(coords, fill):
    draw.ellipse(box(coords), fill=fill)

def polygon(points, fill):
    draw.polygon([(int(x * S), int(y * S)) for x, y in points], fill=fill)

rounded((38, 38, 474, 474), 88, "#111c24", "#293b45", 8)
rounded((161, 104, 254, 167), 18, "#b9ed73")
rounded((118, 145, 377, 367), 36, "#b9ed73")
polygon([(365, 216), (440, 176), (467, 176), (467, 336), (440, 336), (365, 296)], "#b9ed73")
ellipse((170, 180, 322, 332), "#142019")
ellipse((190, 200, 302, 312), "#f5cf68")
for points in [
    [(246,218),(271,236),(261,266),(231,266),(221,236)],
    [(192,248),(221,236),(231,266),(209,288),(184,275)],
    [(300,248),(308,275),(283,288),(261,266),(271,236)],
    [(209,288),(231,310),(222,339),(194,321)],
    [(283,288),(298,321),(270,339),(261,310)],
]:
    polygon(points, "#142019")
ellipse((140, 175, 160, 195), "#ff5d73")

for size, name in [(512, "pwa-512.png"), (192, "pwa-192.png"), (180, "apple-touch-icon.png")]:
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(PUBLIC / name, optimize=True)
print("Generated CamSoccer PNG icons in public/")
