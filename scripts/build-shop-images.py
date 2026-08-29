#!/usr/bin/env python3
"""Build deterministic web thumbnails from the canonical app card previews."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CARD_IMAGES = (
    ROOT.parent
    / "aitrailblazerGENI"
    / "MirrorLoop"
    / "Resources"
    / "MirrorLoopCards"
    / "Images"
)
OUTPUT = ROOT / "web" / "images" / "shop"
HERO = ROOT / "web" / "images" / "arc01-card-012-arrival.webp"


def fit(source: Path, output: Path) -> None:
    image = Image.open(source).convert("RGB")
    image.thumbnail((480, 720), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (480, 720), (8, 11, 21))
    canvas.paste(
        image,
        ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2),
    )
    canvas.save(output, "WEBP", quality=84, method=6)


def collection(edition: str, insight: bool) -> None:
    canvas = Image.new("RGB", (800, 800), (8, 11, 21))
    positions = [(58, 70), (248, 55), (438, 70), (628, 55)]
    for arc, (left, top) in zip((1, 4, 8, 12), positions):
        source = OUTPUT / f"arc-{arc:02d}-{edition}.webp"
        image = Image.open(source).convert("RGB")
        image.thumbnail((220, 430), Image.Resampling.LANCZOS)
        canvas.paste(image, (left, top))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 570, 800, 800), fill=(12, 16, 29))
    color = (241, 190, 97)
    title = "144 CARDS"
    subtitle = f"{edition.upper()} {'INSIGHT' if insight else 'VISUAL'} EDITION"
    font = ImageFont.load_default(size=48)
    small = ImageFont.load_default(size=26)
    draw.text((400, 620), title, anchor="mm", fill=color, font=font)
    draw.text((400, 690), subtitle, anchor="mm", fill=(245, 240, 230), font=small)
    suffix = "insight" if insight else "visual"
    canvas.save(
        OUTPUT / f"collection-{edition}-{suffix}.webp",
        "WEBP",
        quality=86,
        method=6,
    )


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for arc in range(1, 13):
        for edition in ("mono", "color"):
            candidates = sorted(
                CARD_IMAGES.glob(f"{edition}-ARC{arc:02d}-card-*.webp")
            )
            source = HERO if arc == 1 and edition == "color" else candidates[0]
            fit(source, OUTPUT / f"arc-{arc:02d}-{edition}.webp")
    for edition in ("mono", "color"):
        collection(edition, insight=False)
        collection(edition, insight=True)


if __name__ == "__main__":
    main()
