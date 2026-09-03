#!/usr/bin/env python3
"""Build deterministic, preview-only web thumbnails from canonical card art."""

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
CARD_SIZE = (360, 540)
COLLECTION_SIZE = (480, 480)
WATERMARK = "MIRROR//LOOP · PREVIEW"


def fit(source: Path, output: Path) -> None:
    image = Image.open(source).convert("RGB")
    image.thumbnail(CARD_SIZE, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", CARD_SIZE, (8, 11, 21))
    canvas.paste(
        image,
        ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2),
    )
    draw_preview_mark(canvas)
    canvas.save(output, "WEBP", quality=78, method=6, exif=b"")


def draw_preview_mark(image: Image.Image) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    band_height = max(28, image.height // 10)
    draw.rectangle(
        (0, image.height - band_height, image.width, image.height),
        fill=(4, 6, 14, 205),
    )
    font = ImageFont.load_default(size=max(12, image.width // 20))
    draw.text(
        (image.width // 2, image.height - band_height // 2),
        WATERMARK,
        anchor="mm",
        fill=(241, 190, 97, 235),
        font=font,
    )
    image.paste(overlay, mask=overlay.getchannel("A"))


def collection(edition: str, insight: bool) -> None:
    canvas = Image.new("RGB", COLLECTION_SIZE, (8, 11, 21))
    positions = [(27, 42), (134, 33), (241, 42), (348, 33)]
    for arc, (left, top) in zip((1, 4, 8, 12), positions):
        source = OUTPUT / f"arc-{arc:02d}-{edition}.webp"
        image = Image.open(source).convert("RGB")
        image.thumbnail((126, 219), Image.Resampling.LANCZOS)
        canvas.paste(image, (left, top))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 308, 480, 480), fill=(12, 16, 29))
    color = (241, 190, 97)
    title = "144 CARDS"
    subtitle = f"{edition.upper()} {'INSIGHT' if insight else 'VISUAL'} EDITION"
    font = ImageFont.load_default(size=36)
    small = ImageFont.load_default(size=21)
    draw.text((240, 353), title, anchor="mm", fill=color, font=font)
    draw.text((240, 408), subtitle, anchor="mm", fill=(245, 240, 230), font=small)
    draw_preview_mark(canvas)
    suffix = "insight" if insight else "visual"
    canvas.save(
        OUTPUT / f"collection-{edition}-{suffix}.webp",
        "WEBP",
        quality=80,
        method=6,
        exif=b"",
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
