"""QA contact sheets from existing screenshots; Pillow is already installed on this desktop."""
import json
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw

job = Path(__file__).resolve().parent
frames = json.loads((job / "media/capture-manifest.json").read_text(encoding="utf-8"))
output = Path(tempfile.mkdtemp(prefix="pb-r1-kahoot-review-"))
for offset in range(0, len(frames), 8):
    sheet = Image.new("RGB", (1600, 1020), "#e6e6e6")
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames[offset : offset + 8]):
        x, y = (index % 4) * 400, (index // 4) * 510
        shot = Image.open(job / "media" / (frame["name"] + ".png")).convert("RGB")
        shot.thumbnail((392, 472))
        sheet.paste(shot, (x + (400 - shot.width) // 2, y + 28))
        label = frame["name"].replace("upgrade-", "")
        draw.text((x + 4, y + 3), label, fill="black")
    path = output / f"sheet-{offset // 8 + 1:02}.png"
    sheet.save(path)
    print(path)
