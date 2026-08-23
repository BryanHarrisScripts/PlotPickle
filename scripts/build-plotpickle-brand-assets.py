"""Build web-sized PlotPickle v2 brand assets from checked-in master PNGs."""

from pathlib import Path
from typing import Tuple

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "brand-sources"
PUBLIC = ROOT / "public"

SMALL_ICON_SIZES = (16, 32, 48, 64)
LARGE_ICON_SIZES = (128, 180, 192, 512)

MATTE_BLACK = (9, 10, 11)
DRAGON_OLIVE = (117, 128, 74)
NIB_GOLD = (196, 168, 106)
NIB_HIGHLIGHT = (224, 207, 154)


def resized(source: Path, destination: Path, size: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        output = image.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
        output.save(destination, "PNG", optimize=True)


def simplified_mark(size: int) -> Image.Image:
    """Draw the small-size companion to public/favicon.svg.

    The detailed generated dragon is the right master at application and PWA
    sizes, but its nib and compass disappear in a mechanical 16px downsample.
    Supersampling this deliberately broad ouroboros-and-nib silhouette keeps
    the same identity legible from 16px through 64px without a network or SVG
    rendering dependency.
    """

    supersampling = 8
    canvas_size = size * supersampling
    scale = canvas_size / 64

    def point(x: float, y: float) -> Tuple[int, int]:
        return round(x * scale), round(y * scale)

    def box(left: float, top: float, right: float, bottom: float) -> Tuple[int, int, int, int]:
        return (*point(left, top), *point(right, bottom))

    image = Image.new("RGB", (canvas_size, canvas_size), MATTE_BLACK)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        box(0, 0, 64, 64),
        radius=round(12 * scale),
        fill=MATTE_BLACK,
    )

    ring_width = max(1, round(7 * scale))
    draw.ellipse(box(8, 8, 56, 56), outline=DRAGON_OLIVE, width=ring_width)
    # A broad head/arrow at the top-right makes the cycle readable even at 16px.
    draw.polygon(
        [point(39, 10), point(52, 11), point(48, 23), point(44, 17), point(37, 16)],
        fill=DRAGON_OLIVE,
    )

    nib = [point(32, 17), point(42, 34), point(32, 50), point(22, 34)]
    draw.polygon(nib, fill=NIB_GOLD)
    draw.line(nib + [nib[0]], fill=NIB_HIGHLIGHT, width=max(1, round(1.5 * scale)), joint="curve")
    draw.ellipse(box(29.5, 30.5, 34.5, 35.5), fill=MATTE_BLACK)
    draw.line([point(32, 35), point(32, 44)], fill=MATTE_BLACK, width=max(1, round(2 * scale)))

    return image.resize((size, size), Image.Resampling.LANCZOS)


def save_simplified_mark(destination: Path, size: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    simplified_mark(size).save(destination, "PNG", optimize=True)


def portrait_avatar(source: Path, destination: Path, size: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        # The generated master deliberately retains Sage's hands and story
        # magic. The in-app 68px portrait needs a tighter face/upper-torso crop.
        cropped = image.convert("RGB").crop((202, 18, 1052, 868))
        output = cropped.resize((size, size), Image.Resampling.LANCZOS)
        output.save(destination, "PNG", optimize=True)


def main() -> None:
    portrait = SOURCE / "sage-brinewick-v2-master.png"
    mark = SOURCE / "plotpickle-ouroboros-v2-master.png"
    if not portrait.is_file() or not mark.is_file():
        raise SystemExit("The Sage and PlotPickle v2 master PNGs must exist in docs/brand-sources.")

    portrait_avatar(portrait, PUBLIC / "assets" / "sage-brinewick-v2.png", 768)
    resized(mark, PUBLIC / "brand" / "plotpickle-ouroboros-v2.png", 800)

    favicon_directory = PUBLIC / "brand" / "favicon"
    for size in SMALL_ICON_SIZES:
        save_simplified_mark(favicon_directory / f"plotpickle-ouroboros-v2-{size}.png", size)
    for size in LARGE_ICON_SIZES:
        resized(mark, favicon_directory / f"plotpickle-ouroboros-v2-{size}.png", size)

    simplified_mark(256).save(
        favicon_directory / "plotpickle-ouroboros-v2.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    print("Built Sage portrait, PlotPickle mark and favicon derivatives from local master assets.")


if __name__ == "__main__":
    main()
