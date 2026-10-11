# Tile Tempo

## Overview

A thirty-second race for fast, careful thumbs. Every phone receives the same seeded four-column note sequence. Tap the dark note marked ♪ in the bottom row; each correct tap moves the next row down and earns one tile. A wrong column ends your run, and the tiles already earned still count. The TV shows everyone's count, pace and status. Most tiles wins; equal counts tie.

The race is self-paced: rows advance on accepted taps, and an untouched note does not cause a separate miss penalty. Interaction type: tap. Original CSS art and PartyBox cues; no borrowed songs, logos or assets.

## Players

2-8 simultaneous players, including bots. Every player gets the same sequence and shared clock. Spectators watch the stage without controls. Bots read their own current note, use seeded occasional mistakes and vary pace by room strength: easy, normal and sharp. No player can change the race rules after it starts.

## Phases

| Phase   | TV                                                                       | Phone with a TV                                                     | Exit                                     |
| ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------- |
| `ready` | Rule, roster and 3-2-1 countdown                                         | Rule, first four rows and countdown; controls locked                | 3 s or VIP skip → `play`                 |
| `play`  | Shared time left, every player's tiles, tiles/s and Running / Out status | Own count, clock and next four rows; tap only the marked bottom row | 30 s, everyone out or VIP skip → `score` |
| `score` | Winner or tie and final standings                                        | Own result and final count; no controls                             | 6 s or VIP skip → `done`                 |
| `done`  | Final winner or tie and standings                                        | Final place and count                                               | Terminal: `results()` is non-null        |

### Phone only

When `ctx.presence.phoneOnly` is true, or a player's `canSeeTv` is false, their phone includes the public stage and never asks them to look at a TV.

| Phase   | Phone as stage                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `ready` | Rule, countdown and the public roster above the preview                                                                   |
| `play`  | Shared countdown, compact public race standings and own four-row tapping board; after a wrong tap, the live stage remains |
| `score` | Winner/tie, own result and all final standings                                                                            |
| `done`  | Winner/tie, own place and final standings                                                                                 |

A spectator sees the same public race information with no tapping board or buttons. Upcoming notes belong only to the owning controller; the TV and spectator stage show counts, pace and status.

## Inputs

`{ type: 'tap', column: 0 | 1 | 2 | 3, row: number }` during `play`. Columns run left to right. `row` is the nonnegative absolute index of the current row and equals the player's tile count.

A valid correct column earns exactly one tile. A valid wrong column ends only that player's run. Duplicate, stale and future-row inputs are ignored, as are inputs outside play, from spectators, from disconnected players or after a run ends. Inputs at or after the shared deadline cannot score. A tap from an older per-player event time is ignored. Invalid inputs are rejected by the schema or ignored safely by the reducer.

## Scoring

One point per correctly tapped tile; no combos, multipliers or survival bonuses. `results()` ranks by this count alone. Equal counts share the same rank, including zero-tile results.

Pace is average tiles per second: accepted tiles divided by elapsed run time. A running player's pace uses the current elapsed time; an out player's pace freezes at the time of the wrong tap. Zero elapsed time displays zero pace. Pace explains the race and never changes rank or breaks a tie.

## Edge cases

- A row-indexed input cannot score twice. A delayed duplicate cannot accidentally fail the next row.
- The round ends immediately when every run is out; one remaining runner still has the full clock to chase the leader's count.
- A disconnected player's earned tiles and current row remain. The clock continues; a refresh or reconnect restores that state. The game never waits beyond the common deadline.
- Time comes only from events, randomness only from state.rng. Identical seeds and event streams produce identical states. Views expose no RNG or full note track.
- The play phase wakes every 100 ms so it ends even if nobody taps. The visible deadline is the shared race end, not the next engine wake-up.
- Pause/resume moves the race's timestamps by the paused duration. It does not consume race time or lower a stopped player's pace.
- VIP skip moves ready to play, ends play using the counts earned so far, and moves score to done. Final results are scored once.
- The phone play screen is sized for 390 × 844 without scrolling; status uses words and symbols as well as colour. Reduced motion suppresses decorative movement.

## Settings

None. The round is always one thirty-second race. The room's bot-strength setting controls bot reaction pace and error frequency.

## Content

No authored packs. `content/schema.ts` exports empty `packs`; `server/content.ts` creates the shared note sequence with the SDK seeded PRNG. English only. All graphics use original CSS and `--pb-*` design tokens.

## Sources

The dark-only tapping rule is documented by the [original publisher](https://apps.apple.com/us/app/piano-tiles/id848160327) and the independent [SunFounder reconstruction](https://docs.sunfounder.com/projects/esp32-starter-kit/en/latest/scratch/18_tap_tile.html). A maximum-tile thirty-second Zen challenge is independently documented in a [2014 hands-on report](https://www.droidforums.net/threads/free-game-dont-tap-the-white-tile.267570/) and a [separate developer's 2014 listing](https://apps.apple.com/us/app/dont-tap-the-white-tile-hd/id861890667).

The [ToolGenie browser reconstruction](https://toolgenie.org/dont-touch-white-tile) and its public client were inspected for four-lane layout, count feedback and failure. No live play-through was possible because the available computer-use inventory contained no enabled browser. Its exact movement and hit window were not copied. Full corroboration, deliberate adaptations and access limits: [RESEARCH.md](../../jobs/P19-piano-tiles-race/RESEARCH.md), [SOURCES.md](../../jobs/P19-piano-tiles-race/SOURCES.md) and [ASSUMPTIONS.md](../../jobs/P19-piano-tiles-race/ASSUMPTIONS.md).
