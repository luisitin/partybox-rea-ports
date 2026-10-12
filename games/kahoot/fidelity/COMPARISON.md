# Reproduce the static comparison sheet

`make_comparison.py` builds `side-by-side.png` from four complete official reference images and five matching port captures: nine inputs and four semantic moments. It uses installed Pillow, installs nothing and launches no browser or game process. Root owns capture/render sequencing.

Copy these current files from `jobs/P02-quiz-rush-teams/media/` into `games/kahoot/fidelity/ours/`:

| Published original                                     | Matching port capture                                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `original/official-2019-team-talk.png`                 | `ours/groups-teams-talk-tv.png`: discussion before answers open                                                              |
| `original/official-2021-team-scoreboard-composite.jpg` | `ours/groups-teams-standings-tv.png`: team standings after scoring                                                           |
| `original/official-team-phone-receipts.png`            | `ours/groups-teams-standings-phone-tv.png` and `ours/groups-teams-incorrect-phone-tv.png`: correct/wrong teammates beside TV |
| `original/official-answer-results.png`                 | `ours/groups-teams-revealed-result-tv.png`: native vertical-bar response chart before the separate explanation               |

The incorrect phone source is `media/groups-teams-standings-wrong-phone-tv.png`. Both phones are from the same scored question: personal +996/+0, shared 50% correctness, +498 team gain and footer 498, with complete 40-character identities. Numerical differences from the original pair's +484 are authored-question/scoring differences; shared-score semantics are the comparison.

Run from the repo root in PowerShell:

```powershell
python games/kahoot/fidelity/make_comparison.py
```

If the alias is unavailable, use installed Python 3. Font fallback is Windows Segoe UI then Linux DejaVu Sans; `--font C:/path/to/font.ttf` overrides it. Same inputs/Pillow/font reproduce the sheet, and the manifest records fonts.

The generator rejects missing inputs, preserves every complete screenshot, scales proportionally and labels native/display dimensions. It does not crop, recolour or draw on any source. Only unused composed-page whitespace is trimmed. `side-by-side.json` records nine input hashes, placement, dimensions, explicit `crop: null` and the output hash. Full sources and attribution remain in [REFERENCES.md](REFERENCES.md).

The refreshed sheet is 2240×4478; its SHA256 is `5a338f18efa27c68f97e514c7bd400fcc243db6162617bc4166154eaf7a7b1a5`. The agent inspected the whole sheet and checked all nine input/output hashes. This is agent static review, not owner approval. The previous seven-input sheet is historical.

The 2019 discussion image is historical; the 2021 scoreboard is a marketing composite, and the receipt source is a two-phone pair. The complete 2876×1576 host result image has two correct alternatives; this authored four-choice schema has one. Creation date/team-playthrough provenance is unestablished. Our following full explanation is a PartyBox reading adaptation, not an observed native sequence.

PartyBox palette/shell/phone plumbing, names and authored question content differ. No original assets are imported by runtime code. The sheet does not demonstrate open-answer/podium playback, motion, exact timing or audio identity. [GAPS.md](GAPS.md) separates corrected static gaps, explicit adaptations, research limits and pending current-source release checks.
