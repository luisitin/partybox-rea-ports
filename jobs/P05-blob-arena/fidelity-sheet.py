"""Arrange required original/ours evidence without resizing or changing any frame."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
folder = root / "games" / "agar-io" / "fidelity"
scenes = ("start", "growth", "split", "edge", "long-name")
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20)
sheet = Image.new("RGB", (810, 10 + 540 * len(scenes)), "#ffffff")
draw = ImageDraw.Draw(sheet)
for index, scene in enumerate(scenes):
    top = 10 + index * 540
    draw.text((10, top), f"Original archive: {scene}", font=font, fill="#111111")
    draw.text((410, top), f"PartyBox: {scene}", font=font, fill="#111111")
    for column, prefix in enumerate(("original", "ours")):
        with Image.open(folder / f"{prefix}-{scene}.png") as frame:
            if frame.size != (390, 500):
                raise ValueError(f"Unexpected viewport in {prefix}-{scene}: {frame.size}")
            sheet.paste(frame.convert("RGB"), (10 + column * 400, top + 30))
sheet.save(folder / "side-by-side.png", optimize=True)
print(f"Wrote {folder / 'side-by-side.png'} (unchanged390x500 frames)")
