# 2048

## Overview

A fast living-room adaptation of the sliding number puzzle studied for P09.
Everyone plays a 4 × 4 board on their phone while the TV shows the whole race.
Swipe or tap an arrow: every tile slides toward that edge, equal pairs merge once,
and one new tile arrives after a changed move. First to 2048 wins; otherwise the
highest merge score after 180 seconds wins. Original implementation and numeric art.

## Players

2–8, including bots. Easy bots choose a legal direction; normal bots preserve
space, smooth rows and corner tiles; sharp bots add two-ply visible-board planning.
Bots cannot see future spawns. Three strengths and every supported player count
are covered by seeded completion simulations. Spectators see the public race.

## Phases

| Phase    | TV                                                                     | Phone with TV                                                                                               | Exit                                                   |
| -------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `play`   | All boards, names, merge scores, large best tiles, race clock and goal | Own board, SCORE/BEST, best tile, place, timer; swipe and arrow controls                                    | First 2048, deadline, every board blocked, or VIP skip |
| `reveal` | Ranked name, score and best-tile summaries; winner and reason          | Target/all-blocked racers retain their final board and overlay for 3 s, then every final place; no controls | Full reading-safe hold after the payoff or VIP skip    |
| `done`   | Final score and best-tile summaries, winner and ranking                | Final result and ranking                                                                                    | Terminal; `results()` available                        |

The SDK shell gives rules, readiness and its opening countdown. Play begins
immediately; the game does not add another countdown.
Final TV summaries replace board maps, keeping all places, scores and best tiles
visible with Bot/Away identity. The result hold covers the complete TV and phone
copy without counting tile cells that are no longer on screen.
The 3-second terminal beat preserves the original 1,200 ms overlay delay and
800 ms fade, followed by a visible second. Pause and refresh preserve its deadline.

### Phone only

| Phase    | Phone is the stage                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------- |
| `play`   | Own board and controls with clock, goal, rank and race standings; spectator sees boards without buttons |
| `reveal` | Own terminal board payoff where applicable, then winner, reason, own result and all eight standings     |
| `done`   | Final result and all eight standings                                                                    |

The SDK `usePhoneOnly` hook selects stage context. Remote and phone-only play
never need TV instructions. A blocked racer keeps their own board under the
original-timed Game over overlay and retains their score in the race.

## Inputs

`{ type: 'move', dir: 'up' | 'down' | 'left' | 'right', move: number }`.
`move` must match the phone's last accepted move count. Unknown/spectator,
disconnected, stale, paused, late and too-fast inputs are ignored. Changed moves
are separated by at least 150 ms; no-ops spend no move, draw or score.
The server computes every merge; the phone sends only direction and version.
Phone input accepts arrows/WASD/HJKL, arrow buttons and dominant-axis swipes longer
than 10 px. The main phone board stays 280 px square in both room modes.
SCORE and BEST retain the original top-right slots; BEST is a device-local
personal merge-score record, independent of authoritative race scoring.

## Scoring

Each merge earns its resulting tile value: 2+2 gives 4 points, 4+4 gives 8.
Tiles spawned free earn no points. A new tile cannot merge again on the same move.
At timeout, all-blocked finish or host stop, scores rank descending; equal scores
share a place. Biggest tile is display metadata, not a timeout tiebreaker.
A target finisher outranks non-finishers regardless of merge score. Results retain
actual merge points and include every original player, even one who left.

## Edge cases

- All players start on identical boards. Seeded value/location-rank draws are
  shared by successful move number, so event interleaving does not change luck.
  The empty cells depend on choices; different choices can produce different boards.
- Two initial tiles; each spawn is 2 with probability 90%, otherwise 4, placed
  by an equally weighted empty-cell rank. No-op swipes never add a tile.
- A full board with an equal neighbor is still playable. A board with no legal
  direction is blocked. When all racers block, the results beat starts immediately.
- Future draws, RNG and cooldown clocks are absent from TV/controller views;
  everyone may see current boards. Views are safe for arbitrary viewer IDs.
- Refresh restores board and move number. Disconnect never resets score or
  holds the race; a return resumes that seat until the deadline.
- Pause shifts the deadline and accepted-move clocks. Old timer instances do
  nothing. Terminal payoff time also pauses. Inputs at the exact deadline close
  the race without accepting a move.
- 1,200 accepted moves bounds play; with the cooldown, normal 3-minute play
  reaches the clock first. A first accepted target merge freezes the whole race.

## Settings

| Key       | Type   | Default | Range           |
| --------- | ------ | ------- | --------------- |
| `seconds` | number | 180     | 60–180, step 60 |

## Content

No packs or external assets. English only. The room seed generates numbers.
Color, type and motion use `design/tokens.css`; numbers and words identify states.
Reduced motion disables decorative transforms. No runtime network calls.

## Sources

Research: [original creator's engine](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/js/game_manager.js)
and [independent engine](https://github.com/nneonneo/2048-ai/blob/41e298f4571a9505e421e3a19af7a1cb372a368c/2048.cpp)
agree on initial tiles, four directions, once-per-move merges, spawning and scoring.
The pinned classic release was played in a fresh headless profile with ordinary
arrow inputs. Matched board/score screenshots, ranked visual gaps and the comparison
are in [fidelity/](fidelity/GAPS.md). The hosted URL now redirects to a redesigned
2026 site; the studied classic revision remains the explicit reference.
Original travel/merge feedback is 100/200 ms, score feedback 600 ms. Authored CSS
derives those timings and original square geometry from PartyBox tokens.
Measured probes, source-specific timings, living-room decisions and limitations:
[RESEARCH.md](../../jobs/P09-2048-race/RESEARCH.md) and
[SOURCES.md](../../jobs/P09-2048-race/SOURCES.md). No upstream implementation or
runtime assets are copied; original screenshots are review evidence only.
