# Reproduce the static comparison sheet

`make_comparison.py` builds `side-by-side.png` from three complete official reference images and four matching port captures: seven input images in total. The third comparison retains the complete original correct/incorrect phone pair and publishes both complete port phones. It uses the Pillow package already available on the owner's desktop; it installs nothing and launches no browser or game process. Run it only after root refreshes the port captures for the current implementation.

Copy the fresh matching files from `jobs/P02-quiz-rush-teams/media/` into `games/kahoot/fidelity/ours/`, retaining these names:

| Published original                                     | Port capture and matching semantic moment                                                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `original/official-2019-team-talk.png`                 | `ours/groups-teams-talk-tv.png`: TV discussion before answers open                                                                                              |
| `original/official-2021-team-scoreboard-composite.jpg` | `ours/groups-teams-standings-tv.png`: TV team standings after scoring                                                                                           |
| `original/official-team-phone-receipts.png`            | `ours/groups-teams-standings-phone-tv.png` and `ours/groups-teams-incorrect-phone-tv.png`: correct and incorrect teammates' post-verdict receipts beside the TV |

The incorrect port phone is copied from `jobs/P02-quiz-rush-teams/media/groups-teams-standings-wrong-phone-tv.png`. Both port receipts come from the same first scored question and show the same 50% team accuracy, +498 team gain and shared 498 footer total despite different personal verdicts and contributions.

Run from the repo root in PowerShell:

```powershell
python games/kahoot/fidelity/make_comparison.py
```

If the `python` alias is unavailable, use the installed Python 3 executable. The generator finds Windows Segoe UI, then Linux DejaVu Sans; an explicit `--font C:/path/to/font.ttf` overrides the font. Regenerating with the same inputs, Pillow version and font produces the same sheet. Font selection is recorded in `side-by-side.json`.

The generator refuses to render if any input is missing. It preserves each complete source image, fits it proportionally into its panel, and prints both native and display dimensions. It does not crop, recolour or draw over any screenshot. The only crop operation trims unused page whitespace after composition. `side-by-side.json` records every input's SHA256, dimensions, placement and explicit `crop: null`, plus the output hash. Full original sources remain in `original/` with attribution in [REFERENCES.md](REFERENCES.md).

The 2019 discussion screenshot is historical; the 2021 scoreboard image is a marketing composite, and the official receipt image contains two phones. These are labeled on the sheet rather than presented as equivalent single-device camera captures. Authored question content, participant names, PartyBox palette and shell plumbing differ. The sheet compares three semantic moments, with both personal outcomes represented in the receipt moment; it does not demonstrate current original playback, answer-window or podium fidelity, animation timing or audio. Keep the ranked [GAPS.md](GAPS.md) honest after inspecting the freshly rendered sheet.

After root confirms the inputs are current, render once and inspect `side-by-side.png` at readable scale. Root owns the final capture/render sequence and any changes to the remaining fidelity gaps.

Root regenerated the October 12 comparison from the four current port captures and the three complete official references. The authoritative dimensions, placement, seven input hashes and output hash are recorded in `side-by-side.json`; the earlier six-input sheet is historical.

Read-only human inspection covered all 23 TV PNGs and all 11 updated beside-TV result frames in the job media folder. The complete official correct/incorrect pair and both corresponding port receipts were reviewed individually. The port now has the source's centered verdict/glyph/card hierarchy, gain below the gauge, shared team-score footer and a truthful current-place status. VIP controls fit above full 35-character names. Final-ready static frames retain score placeholders, but their `nextAt + 100` timestamps are beyond the current automatic deadline; a usable live group-only final Next window remains pending pacing work. All 120 current captures have zero clipping/overflow or receipt-geometry failures. The known static receipt gap is closed; remaining pacing, bot, countdown and late-join candidates and unmeasured original playback remain in [GAPS.md](GAPS.md) and the job's KEEP GOING record.
