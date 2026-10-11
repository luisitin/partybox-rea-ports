"""Compose the actual captured phase pages for a single visual inspection."""
from pathlib import Path
from PIL import Image, ImageDraw

folder = Path(__file__).parent / "media"
sheet = Image.new("RGB", (1260, 1350), (15, 16, 32))
draw = ImageDraw.Draw(sheet)
positions = [(0, 640), (650, 195), (855, 195), (1060, 195)]
for row, phase in enumerate(["guess", "reveal", "done"]):
    for col, mode in enumerate(["tv", "phone", "phone-only", "spectator"]):
        x, width = positions[col]
        draw.text((x, row * 450), f"{phase} / {mode}", fill="white")
        with Image.open(folder / f"{phase}-{mode}.png") as screen:
            height = 360 if mode == "tv" else 422
            sheet.paste(screen.resize((width, height)), (x, row * 450 + 24))
sheet.save(folder / "contact-sheet.png")
