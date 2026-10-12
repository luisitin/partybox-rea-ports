# Reproduce the static comparison sheet

`make_comparison.py` builds `side-by-side.png` from three complete official reference images and three matching port captures. It uses the Pillow package already available on the owner's desktop; it installs nothing and launches no browser or game process. Run it only after root refreshes the port captures for the current implementation.

Copy the fresh matching files from `jobs/P02-quiz-rush-teams/media/` into `games/kahoot/fidelity/ours/`, retaining these names:

| Published original                                     | Port capture and matching semantic moment                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `original/official-2019-team-talk.png`                 | `ours/groups-teams-talk-tv.png`: TV discussion before answers open                               |
| `original/official-2021-team-scoreboard-composite.jpg` | `ours/groups-teams-standings-tv.png`: TV team standings after scoring                            |
| `original/official-team-phone-receipts.png`            | `ours/groups-teams-standings-phone-tv.png`: one player's post-verdict team receipt beside the TV |

Run from the repo root in PowerShell:

```powershell
python games/kahoot/fidelity/make_comparison.py
```

If the `python` alias is unavailable, use the installed Python 3 executable. The generator finds Windows Segoe UI, then Linux DejaVu Sans; an explicit `--font C:/path/to/font.ttf` overrides the font. Regenerating with the same inputs, Pillow version and font produces the same sheet. Font selection is recorded in `side-by-side.json`.

The generator refuses to render if any input is missing. It preserves each complete source image, fits it proportionally into its panel, and prints both native and display dimensions. It does not crop, recolour or draw over any screenshot. The only crop operation trims unused page whitespace after composition. `side-by-side.json` records every input's SHA256, dimensions, placement and explicit `crop: null`, plus the output hash. Full original sources remain in `original/` with attribution in [REFERENCES.md](REFERENCES.md).

The 2019 discussion screenshot is historical; the 2021 scoreboard image is a marketing composite, and the official receipt image contains two phones. These are labeled on the sheet rather than presented as equivalent single-device camera captures. Authored question content, participant names, PartyBox palette and shell plumbing differ. The sheet compares the three semantic moments; it does not demonstrate current original playback, answer-window or podium fidelity, animation timing or audio. Keep the ranked [GAPS.md](GAPS.md) honest after inspecting the freshly rendered sheet.

After root confirms the inputs are current, render once and inspect `side-by-side.png` at readable scale. Root owns the final capture/render sequence and any changes to the remaining fidelity gaps.

Rendered review on October 12, 2026: the fresh three-input sheet is 2240x3500 pixels and 1,073,429 bytes. Captions, proportional scaling and complete source images were visually inspected; all six input hashes and the output hash match `side-by-side.json`. The output hash is `d63031ef7e67acbd6c07e331cb48bb2e52594ca3819190ecadc250836e649f71`.

Read-only human inspection covered all 23 fresh TV PNGs in the job media folder: 12 team phases, 10 room-vote phases and the two-team discussion variant. No clipping, HUD collision or premature podium total was visible. The saved layout measurements independently report zero clipping/overflow and a minimum 36 px game-text size across those TV frames. The original row geometry and team percentage panel are now represented, while the original phone's lower verdict/panel placement and persistent bottom identity/score still visibly differ. This closes no complete fidelity claim; root maintains the remaining ranked gaps.
