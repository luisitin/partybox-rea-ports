# P08 Hole Swallow research

Checked 2026-10-11. Sources are linked in SOURCES.md. No original code, art,
sound, font, logo or map was copied. This is source research; a live session
of the original was not played or timed during this research pass.

## Evidence and limits

| Mechanic                                                               | Evidence                                                                                   | PartyBox decision                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Swallow city props to grow; growth unlocks larger objects              | Developer App Store description [S1], independent firsthand city walkthrough [S3]          | Keep the readable progression from tiny props to trees, cars and buildings                   |
| Larger holes can swallow smaller rivals                                | Official PC publisher description [S2], firsthand play reports [S3, S5]                    | Keep PvP, with an explicit size margin so ties never eat each other                          |
| Original classic round lasts two minutes and final score ranks players | Two independent 2018 firsthand reviews [S3, S6]                                            | The binding P08 job changes this to exactly 90 seconds                                       |
| Dense clusters matter more than chasing isolated targets               | Two independent firsthand strategy reports [S3, S4]                                        | Give every starting sector a reachable small-prop cluster; vary city routes by seed          |
| Being swallowed temporarily stops eating                               | Independent firsthand reports [S3, S5] describe a few seconds                              | Short respawn with a clear countdown and brief protection; exact duration is original tuning |
| Cars become useful before buildings                                    | Independent firsthand reports [S3, S4] place cars at levels 3–4, thin buildings at level 5 | Use discrete tiers and show the next edible class on the phone                               |

## Size thresholds studied

[S4] reports historical cumulative growth thresholds of 10, 27, 51, 82,
120, 165, 217 and 246 points for levels 2–9. These exact values have only
one verified indexed source, so they are historical observations, not an
assertion about the current product. [S3] independently confirms 10 points
for level 2, cars at levels 3–4 and thin buildings at level 5. It reports
roughly 3 points for cars and 4 for a narrow building segment; [S4] agrees.

The important threshold behavior is a change in what fits, not a merely
larger drawing. A just-too-large target wastes time; growing opens a richer
route. Original 3D objects can catch or topple [S3, S4]. The port should use
deterministic footprint containment instead of reproducing a physics engine.
Its exact radii, reward curve and rival margin are PartyBox balancing choices.

## Round feel and living-room adaptation

Start with quick clusters that immediately teach steering and collection.
Then switch the valuable targets from street furniture to parked cars to
buildings. A visible size increase, target disappearing into the hole and
short points feedback make every gain legible. Keep the whole shared city
on the TV; each hole needs a number or letter as well as a player color.
The phone needs one joystick, score, size, next target and respawn status.
Phone-only rooms need the city above the joystick; spectators get the city
without controls. Instructions must make sense without mentioning a TV.

Source [S1] describes increasing crunch feedback; no sound sample or timing
was measured. Use only SDK cues, preferably a quiet swallow cue and a
clearer growth cue, with reduced-motion-friendly visual feedback.

## Public client inspection

The public https://holeio.com page was fetched read-only and its
https://holeio.com/b/4/gameWebGL.js loader inspected. It loads Unity data,
framework and WASM bundles; loader metadata identifies DRA.RU, not VOODOO.
No size algorithm is exposed there, so this browser variant is not treated
as the canonical original or as a threshold source. No bundle assets were
downloaded into the repo.

A separate public educational implementation [S7] was read for comparison:
objects carry a required level, scoring is a separate table, and swallowed
objects shrink while moving to the hole. Its values and code were not used.
It demonstrates an approachable 2D implementation, not original behavior.
