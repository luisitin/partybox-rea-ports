# Skyline Stack

## Overview

A one-tap, simultaneous tower race. Each player builds a separate skyline for exactly 45 seconds. The phone shows the moving block and a DROP BLOCK button; the TV compares all towers. Overhang is cut away, perfect drops recover footprint, and the highest tower wins. All art is original SVG geometry. English only; Arcade category.

## Players

2–8, local or remote, with or without a TV. Three bot strengths watch the same public slider: easy accepts a wider timing window and sometimes hesitates; normal aims close to center; sharp aims for the perfect window. Spectators see the stage without controls.

Bots account for the engine's 50 ms observations: sharp chooses the nearest visible crossing within half a tick, and any remaining error still trims width at the actual event time. Seeded measurements after tuning average 16.874 / 22 / 65 best floors for easy / normal / sharp, respectively.

## Phases

| Phase   | TV                                                                          | Phone with a TV                                                                       | Exit                          |
| ------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| `play`  | Eight numbered tower bays, heights, names, best heights, shared large clock | Own live tower, floor/best counters, perfect/trim feedback, DROP BLOCK or BUILD AGAIN | 45 seconds or VIP Finish race |
| `score` | Frozen best towers and ranked heights                                       | Own best height and race verdict                                                      | 6 seconds or VIP Show results |
| `done`  | Winner/tie and final best towers                                            | Place and best floors                                                                 | Terminal; results non-null    |

The shell owns rules, ready-up and the opening countdown. Play starts immediately after that countdown. There is one race, with no duplicate opening phase.

### Phone only

| Phase   | Phone-only / remote phone                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| `play`  | Own timing stage, live clock, all eight named best heights in a compact two-column roster, drop/retry control |
| `score` | Best tower, roster and frozen heights; no controls                                                            |
| `done`  | Winner or tie, own place, best tower and all ranked heights; no controls                                      |

`ctx.presence.phoneOnly` persists in state. `usePhoneOnly()` and the pushed `stage` flag support both no-TV rooms and `canSeeTv: false` remote players. A spectator receives the whole stage in a phone-only room and never sees a drop/retry button.

## Inputs

- `{ type: 'drop', attempt, level }`: current attempt and floor serial. Only the authoritative event time judges alignment.
- `{ type: 'restart', attempt }`: start a fresh tower after a miss and a 650 ms feedback beat. Best height persists.
- Unknown, disconnected, stale-attempt, stale-level, pre-clock, post-race and duplicate inputs are ignored. A block must have slid for at least 300 ms before landing.

## Scoring

Score = the greatest number of floors successfully placed in one attempt. The foundation is not a floor. A retry cannot add floors from separate attempts. Equal heights share rank and victory; perfect drops affect width, never the score directly. Results retain every initial player, including leavers.

## Edge cases

- Base footprint is 80 × 80 world units. Motion alternates x/z. The slider bounces ±96 units around the top's center at `min(170, 90 + 2 × floors)` units/s. Direction at each floor is shared and seeded. Position is an analytic triangle wave, independent of timer cadence.
- At most 2.6 units of error (or 6% of the active dimension, whichever is smaller) snaps to the supporting center. Non-perfect overlap shrinks the active dimension by the absolute error and moves the surviving center by half the signed error. Under four units of support ends the attempt.
- The third consecutive perfect drop, and every perfect after it, restores eight units on the active axis, capped at 80. A non-perfect or missed drop resets the streak.
- Input serials prevent a delayed packet from dropping the next block or restarting the next attempt. The 300 ms minimum blocks rapid spam. The 45-second cap bounds attempts and height; only the latest 12 blocks are retained for rendering, including saved best-tower blocks.
- A pause freezes the shared race, slider, cooldown and retry beat. Resume shifts every clock. A skip while paused follows the SDK's resume-before-skip order.
- Disconnects preserve the tower; the clock continues. Refresh/rejoin receives the current attempt, floor, motion origin and best height. The game never waits for a missing player.
- Every floor, height and slider is public. Views exclude the PRNG state and input/event history. A TV-room phone receives only its own tower; a stage phone receives all public towers.
- Reduced motion retains essential slider motion while suppressing decorative feedback. Text, outlines, numbering and block shapes carry every state independently of color and sound.

## Settings

None. One 45-second race keeps every room on the same rules.

## Content

No packs or downloaded assets. `content/schema.ts` exports empty `packs`. The SDK supplies original synthesized feedback cues; silent play has the same information.

## Sources

Original mechanic research: [148Apps guide](https://www.148apps.com/stack/stack-guide-how-to-build-a-great-tower/), [MacSources first-person review](https://macsources.com/stack-ios-game-review-by-ketchapp-and-kchlab/), and [Movie TV Tech Geeks review](https://www.movietvtechgeeks.com/p/old-man-mobile-game-review-stack). Public independent [recreation source](https://github.com/zurkon/playstack) was read to understand overlap geometry; no code/assets copied. Exact original tolerance and streak count were not verifiable. All numerical rules above are documented PartyBox choices. Research, attribution and limitations: `jobs/P16-stack-tower/RESEARCH.md`, `SOURCES.md` and `ASSUMPTIONS.md`.
