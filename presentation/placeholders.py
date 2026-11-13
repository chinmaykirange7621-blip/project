"""Generate clean 1600px-wide labeled placeholder PNGs for Slide 7 screenshot slots.

Each placeholder is inserted inside a native PowerPoint rounded browser frame as a
real <p:pic> element so the presenter can Right-click -> Change Picture without
breaking the layout. Zero fake UI data is drawn.
"""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def create_placeholder_image(
    out_path: Path,
    slot_num: int,
    title: str,
    route: str,
    rec_size: str = "1440 x 900 (or 1600px+ 16:10)",
    width: int = 1600,
    height: int = 1000,
) -> None:
    img = Image.new("RGB", (width, height), (14, 21, 50))
    draw = ImageDraw.Draw(img)

    # Subtle grid lines
    step = 80
    for x in range(0, width, step):
        draw.line([(x, 0), (x, height)], fill=(24, 34, 76), width=1)
    for y in range(0, height, step):
        draw.line([(0, y), (width, y)], fill=(24, 34, 76), width=1)

    # Dashed-style outer inset border
    pad = 42
    draw.rounded_rectangle(
        [(pad, pad), (width - pad, height - pad)],
        radius=28,
        outline=(59, 130, 246),
        width=4,
    )

    # Center badge (crisp & readable even in Slide 7 2x2 thumbnails)
    f_badge = _load_font(42, bold=True)
    f_title = _load_font(66, bold=True)
    f_sub = _load_font(40, bold=False)
    f_hint = _load_font(34, bold=True)

    badge_text = f"INSERT SCREENSHOT {slot_num}  •  PLACEHOLDER"
    bw = draw.textlength(badge_text, font=f_badge) + 84
    bx0 = (width - bw) / 2
    by0 = 195
    draw.rounded_rectangle(
        [(bx0, by0), (bx0 + bw, by0 + 84)],
        radius=42,
        fill=(37, 99, 235),
    )
    draw.text((width / 2, by0 + 42), badge_text, fill=(255, 255, 255), font=f_badge, anchor="mm")

    draw.text((width / 2, 390), title, fill=(255, 255, 255), font=f_title, anchor="mm")
    draw.text((width / 2, 495), f"Route: {route}", fill=(147, 197, 253), font=f_sub, anchor="mm")
    draw.text((width / 2, 575), f"Recommended Capture: {rec_size}", fill=(203, 213, 225), font=f_sub, anchor="mm")

    draw.rounded_rectangle(
        [(width / 2 - 630, 695), (width / 2 + 630, 795)],
        radius=20,
        fill=(22, 32, 72),
        outline=(123, 63, 242),
        width=4,
    )
    draw.text(
        (width / 2, 745),
        "PowerPoint: Right-click this image -> Change Picture -> This Device",
        fill=(221, 214, 254),
        font=_load_font(31, bold=True),
        anchor="mm",
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(out_path), format="PNG", optimize=True)


def generate_all_placeholders(out_dir: Path) -> dict[int, Path]:
    specs = [
        (1, "Home / Landing Page", "http://localhost:5173/", "1440 x 900 Desktop"),
        (2, "AI Chat Interface (Sample Query)", "http://localhost:5173/chat", "1440 x 900 Desktop"),
        (3, "Deterministic Eligibility Result", "http://localhost:5173/eligibility", "1440 x 900 Desktop"),
        (4, "Scholarship Detail & Official Citations", "http://localhost:5173/scholarships/aicte-pragati-degree", "1440 x 900 or 390 x 844"),
    ]
    paths: dict[int, Path] = {}
    for num, title, route, rec in specs:
        p = out_dir / f"placeholder_slot_{num}.png"
        create_placeholder_image(p, num, title, route, rec)
        paths[num] = p
    return paths
