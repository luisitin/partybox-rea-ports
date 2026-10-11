# Colour Gate

## Overview

One-tap colour-match racing for a TV and phones. Everyone climbs an identical seeded course in a separate lane: tap to bounce, hover below a moving gate, and cross when its symbol matches your ball. Each clear automatically changes your colour. A wrong match or fall costs 1.2 seconds, then returns you to your checkpoint. Three 45-second races reward the farthest climb. All geometry and code are original.

## Players

2-8, including bots. Everyone plays simultaneously. Bots predict their next crossing and hover while waiting; easy, normal and sharp strengths have different timing error rates. A dropped phone keeps its checkpoint and progress; reconnecting resumes the same race. Timers finish rounds independently of connected seats.

## Phases

| Phase   | TV                                                                         | Phone with TV                                                  | Exit                            |
| ------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| `play`  | All lanes, current shapes, next moving gates, gate counts, 45-second clock | Current symbol, progress, matching cue and a large TAP surface | 45 s or VIP skip                |
| `score` | Frozen lanes, round gains and total standings                              | Round points and running total                                 | 6 s or VIP skip                 |
| `done`  | Winner or tied leaders and final standings                                 | Personal rank, total and winner                                | Terminal; results are available |

The shell owns rules, READY and the initial countdown. This game starts directly in `play`.

### Phone only

| Phase   | Phone as the stage                                                          |
| ------- | --------------------------------------------------------------------------- |
| `play`  | Your live lane, gate matching cue, clock, compact opponent progress and TAP |
| `score` | Round gains and compact standings for every player                          |
| `done`  | Winner, your rank and the final standings                                   |

The same stage appears for remote seats that cannot see the TV. Spectators get a public lane and standings without a TAP control. No screen requires an absent TV.

## Inputs

`{ type: 'tap' }` sets upward velocity to 105 course units/s. Inputs at least 140 ms apart are accepted, while holding does not repeat. Gravity is 420 units/s². Two taps/s hovers; a faster cadence climbs. Unknown, spectator, disconnected, stale and paused inputs are ignored.

## Scoring

Each cleared gate is 100 points. The highest fraction reached toward the next gate adds 0-99 points, so a partial climb cannot beat one additional clear. Round points add once when the score reveal opens; the largest match total wins, with equal totals sharing a rank. Crashes retain cleared gates and highest reached progress. Finishing early through VIP End banks the current climb.

## Edge cases

- Collision is judged on a fixed 20 ms grid. Taps are applied at the last judged grid sample; the host's `event.now` is the only time source.
- A gate is a moving four-segment horizontal strip. Its center crossing symbol is `floor(offset + direction × elapsed / beatMs) mod 4`, including reverse movement. Contact is checked when the ball crosses upward through its plane. Cleared gates are safe to recross.
- Gates are 120 units apart. Every clear moves the checkpoint to 90 units below that gate. A crash waits 1200 ms, resets the ball to its checkpoint, and waits safely for the next tap.
- The starting pad also waits safely for the first tap. Falling below the checkpoint after launching crashes. No elimination creates a long wait.
- All lanes share the same seeded gate sequence, initial colour and motion clock. There is no hidden information; controller views differ only in their own runner, role and final rank.
- A pause holds physics and shifts the round's start/end by the held duration. Skip while paused resumes before settling. Stale phase timers and early timer delivery are ignored.
- State uses no runtime I/O, network, timers or unseeded randomness. The 64-gate course bounds state size; normal racing cannot exhaust it.

## Settings

| Key      | Type   | Default | Range |
| -------- | ------ | ------- | ----- |
| `rounds` | number | 3       | 1-3   |

## Content

No question packs, external assets or runtime downloads. Four token colours each carry a distinct shape and name. Seeded course generation varies tempo (650-950 ms per segment), motion direction, initial offset and the next colour. English only; SDK words and sound cues integrate with the shell.

## Sources

The original's tap-to-rise and match-colour rules are corroborated by [Common Sense Media](https://www.commonsensemedia.org/app-reviews/color-switch) and [Code Rewind](https://www.coderewind.com/2016/04/game-color-switch/); colour changers by [Level Winner](https://www.levelwinner.com/color-switch-tips-tricks-strategy-guide-a-look-at-endless-and-challenge-modes/) and [Cody's 2016 review](https://codygreviews.blogspot.com/2016/08/). Hover advice appears independently in [Pocket Gamer](https://www.pocketgamer.com/color-switch/pocket-gamers-ultimate-guide-to-color-switch/) and Level Winner. The original public client and exact physics were unavailable: these constants, checkpoint retries, timed lanes and scoring are independent PartyBox tuning. Detailed evidence and limitations are in `jobs/P18-colour-gate/RESEARCH.md` and `SOURCES.md`.
