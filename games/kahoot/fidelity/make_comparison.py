"""Render the four attributed semantic comparisons without cropping either source.

Run only after root has refreshed the five captures under fidelity/ours/.
Requires the already available Pillow package; launches no browser or game process.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
WIDTH = 2240
MARGIN = 64
GAP = 48
PANEL_WIDTH = (WIDTH - 2 * MARGIN - GAP) // 2
BACKGROUND = "#f4f2f7"
INK = "#241b35"
MUTED = "#514761"
BORDER = "#c9c2d2"

COMPARISONS = [
    {
        "moment": "1. Team Talk - host screen",
        "original": "original/official-2019-team-talk.png",
        "ours": "groups-teams-talk-tv.png",
        "original_label": "Official Unconference guide, August 2019 - historical Team Talk",
        "ours_label": "P02 authored quiz - discussion phase, TV",
        "note": (
            "Whole source images. The original has two populated alternatives and question media; "
            "our authored question has four alternatives. Compare the prompt, clock, answer count "
            "and options placement; this is not a current live original capture."
        ),
        "image_height": 600,
    },
    {
        "moment": "2. Team Scoreboard - host screen",
        "original": "original/official-2021-team-scoreboard-composite.jpg",
        "ours": "groups-teams-standings-tv.png",
        "original_label": "Official product announcement, September 2021 - marketing composite",
        "ours_label": "P02 authored quiz - standings phase, TV",
        "note": (
            "Whole published composite retained: host scoreboard, joined phone and illustrated "
            "guests. Its host region is the semantic comparison; the complete composite is not "
            "a single TV viewport. Names, question content and PartyBox plumbing differ."
        ),
        "image_height": 600,
    },
    {
        "moment": "3. Team Result - phone beside the TV",
        "original": "original/official-team-phone-receipts.png",
        "ours": ["groups-teams-standings-phone-tv.png", "groups-teams-incorrect-phone-tv.png"],
        "original_label": "Official support guide - two result phones, screenshot dated October 2021",
        "ours_label": "P02 authored quiz - correct/incorrect teammates, TV-visible setting",
        "note": (
            "Whole original correct/incorrect phone pair versus two complete port phones. "
            "Each pair shares its team gain and footer total despite different personal verdicts. "
            "Compare the percentage/gain panel and identity bar; the original pair is not one viewport."
        ),
        "image_height": 960,
    },
    {
        "moment": "4. Answer Results - host screen",
        "original": "original/official-answer-results.png",
        "ours": "groups-teams-revealed-result-tv.png",
        "original_label": "Official hosting guide - complete host result image inspected October 2026",
        "ours_label": "P02 authored quiz - answer results before explanation, TV",
        "note": (
            "Whole images. Compare the top prompt, centered vertical shape/count/check bars and "
            "four bottom alternatives. The original has two correct alternatives; our authored "
            "schema has one. The following explanation beat is a PartyBox reading adaptation, "
            "not an observed native sequence. No native motion or audio identity is claimed."
        ),
        "image_height": 600,
    },
]


def font_path(requested: Path | None, bold: bool = False) -> Path:
    if requested is not None:
        if not requested.is_file():
            raise FileNotFoundError(f"Font does not exist: {requested}")
        return requested
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    windows = Path("C:/Windows/Fonts") / name
    if windows.is_file():
        return windows
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu")
        / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("No readable font found. Pass --font with a TrueType font path.")


def wrapped(draw: ImageDraw.ImageDraw, value: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in value.split():
        candidate = f"{line} {word}".strip()
        if line and draw.textbbox((0, 0), candidate, font=font)[2] > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def text_block(
    draw: ImageDraw.ImageDraw,
    value: str,
    xy: tuple[int, int],
    font: ImageFont.FreeTypeFont,
    width: int,
    line_height: int,
    fill: str = INK,
) -> int:
    x, y = xy
    for line in wrapped(draw, value, font, width):
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height
    return y


def place_complete_image(
    canvas: Image.Image,
    path: Path,
    box: tuple[int, int, int, int],
) -> dict:
    with Image.open(path) as opened:
        original = opened.convert("RGB")
    left, top, right, bottom = box
    scale = min((right - left) / original.width, (bottom - top) / original.height)
    size = (max(1, round(original.width * scale)), max(1, round(original.height * scale)))
    resized = original.resize(size, Image.Resampling.LANCZOS)
    x = left + ((right - left) - size[0]) // 2
    y = top + ((bottom - top) - size[1]) // 2
    canvas.paste(resized, (x, y))
    return {
        "file": str(path.relative_to(ROOT)).replace("\\", "/"),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "native_pixels": [original.width, original.height],
        "display_pixels": list(size),
        "display_origin": [x, y],
        "crop": None,
        "scale_percent": round(scale * 100, 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", type=Path, help="Optional TrueType font for both weights")
    args = parser.parse_args()
    paths = [
        path
        for row in COMPARISONS
        for path in [ROOT / row["original"]] + [
            ROOT / "ours" / name
            for name in (row["ours"] if isinstance(row["ours"], list) else [row["ours"]])
        ]
    ]
    missing = [str(path.relative_to(ROOT)) for path in paths if not path.is_file()]
    if missing:
        raise SystemExit("Missing refreshed comparison input(s):\n" + "\n".join(missing))
    normal_path = font_path(args.font)
    bold_path = font_path(args.font, bold=True)
    title_font = ImageFont.truetype(str(bold_path), 40)
    heading_font = ImageFont.truetype(str(bold_path), 32)
    label_font = ImageFont.truetype(str(bold_path), 26)
    body_font = ImageFont.truetype(str(normal_path), 25)
    small_font = ImageFont.truetype(str(normal_path), 23)
    # Allocate the complete page, then remove only unused page whitespace at the end.
    canvas = Image.new("RGB", (WIDTH, 5200), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    y = text_block(
        draw,
        "Kahoot! teams - published original / PartyBox port",
        (MARGIN, 40),
        title_font,
        WIDTH - 2 * MARGIN,
        52,
    )
    y = text_block(
        draw,
        "Same semantic moments; complete input images, proportional scaling, no source cropping. "
        "Static evidence does not establish current live, motion or audio fidelity. "
        "See REFERENCES.md and the ranked GAPS.md.",
        (MARGIN, y + 12),
        body_font,
        WIDTH - 2 * MARGIN,
        34,
        MUTED,
    ) + 34
    manifest = {
        "generator": "make_comparison.py",
        "font": str(normal_path),
        "bold_font": str(bold_path),
        "policy": "Complete source images; no image cropping; proportional LANCZOS scaling.",
        "comparisons": [],
    }
    for row in COMPARISONS:
        draw.text((MARGIN, y), row["moment"], font=heading_font, fill=INK)
        y += 52
        ours = row["ours"] if isinstance(row["ours"], list) else [row["ours"]]
        sources = [[ROOT / row["original"]], [ROOT / "ours" / name for name in ours]]
        labels = [row["original_label"], row["ours_label"]]
        record = {"moment": row["moment"], "note": row["note"], "images": []}
        panel_bottom = y + 138 + row["image_height"] + 68
        for index, (paths, label) in enumerate(zip(sources, labels)):
            x = MARGIN + index * (PANEL_WIDTH + GAP)
            draw.rounded_rectangle(
                (x, y, x + PANEL_WIDTH, panel_bottom),
                radius=12,
                fill="white",
                outline=BORDER,
                width=2,
            )
            draw.text(
                (x + 20, y + 16),
                "PUBLISHED ORIGINAL" if index == 0 else "PARTYBOX PORT",
                font=label_font,
                fill=INK,
            )
            text_block(draw, label, (x + 20, y + 58), small_font, PANEL_WIDTH - 40, 30, MUTED)
            image_gap = 16
            image_width = (PANEL_WIDTH - 32 - image_gap * (len(paths) - 1)) // len(paths)
            captions = []
            for offset, path in enumerate(paths):
                image_x = x + 16 + offset * (image_width + image_gap)
                placement = place_complete_image(
                    canvas,
                    path,
                    (image_x, y + 138, image_x + image_width, y + 138 + row["image_height"]),
                )
                record["images"].append(placement)
                native = placement["native_pixels"]
                display = placement["display_pixels"]
                captions.append(
                    f"{native[0]} x {native[1]} → {display[0]} x {display[1]} px "
                    f"({placement['scale_percent']:.1f}%)."
                )
            caption = "Native → displayed: " + " / ".join(captions) + " Whole images."
            text_block(
                draw, caption, (x + 20, panel_bottom - 60), small_font, PANEL_WIDTH - 40, 29, MUTED
            )
        y = text_block(
            draw,
            row["note"],
            (MARGIN, panel_bottom + 18),
            small_font,
            WIDTH - 2 * MARGIN,
            32,
            MUTED,
        ) + 38
        manifest["comparisons"].append(record)
    canvas = canvas.crop((0, 0, WIDTH, y))
    output = ROOT / "side-by-side.png"
    canvas.save(output, optimize=True)
    manifest["output_pixels"] = [canvas.width, canvas.height]
    manifest["output_sha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
    (ROOT / "side-by-side.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote {output.name} ({canvas.width} x {canvas.height}) and side-by-side.json")


if __name__ == "__main__":
    main()
