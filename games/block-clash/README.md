# Block Clash

An original PartyBox falling-block versus game. Everyone builds on their own phone while the TV shows every board. Complete rows to defend yourself and send garbage to a chosen rival. This Arcade port recreates studied mechanics with original SVG/CSS and PartyBox sounds; it ships no source-game branding or assets.

## Overview

One match lasts 120 seconds, or ends when at most one player remains. Each player has a 10 by 20 board, the same seeded seven-bag piece sequence, a personal sequence cursor, three next-piece previews, a hold slot and a ghost landing outline. The PartyBox shell owns rules, ready-up and the countdown; live play starts immediately.

Pieces use four SRS orientations with ordered wall/floor kicks, a separate I-piece kick table and a visually unchanged O piece. Gravity advances one row every 650 ms initially, then 550/450/350 ms after 30/60/90 seconds. A grounded piece locks after 500 ms; successful grounded moves/rotations can reset that delay at most 15 times. Hard drop commits the ghost landing immediately.

## Players

2–8 players, including bots. Easy, normal and sharp bots evaluate candidate placements for lines, stack height, holes and surface roughness, then send ordinary movement, rotation and drop inputs. Stronger bots penalize buried holes more; easy bots use seeded variation. No bot receives different pieces or extra attacks. Seats keep their original order on the shared stage.

## Phases

| Phase   | TV                                                                                  | Phone with a TV                                                                | Exit                                        |
| ------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| `play`  | Every named board, score, lines or incoming rows, chosen target and the match clock | Own board, landing outline, next three, hold, target selector and six controls | 120 seconds, at most one alive, or VIP skip |
| `score` | Winner or shared first place and final standings                                    | Your place, score, cleared lines and standings                                 | 6 seconds or VIP skip                       |
| `done`  | Final standings                                                                     | Your place and final standings                                                 | Terminal; `results()` is available          |

### Phone only

The phone is always the precise play surface. `usePhoneOnly()` adds local stage information without telling anyone to look at a TV.

| Phase                           | Phone-only stage                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `play`, alive                   | Own board and controls, score, incoming garbage, target, remaining time, current place and survivors |
| `play`, eliminated or spectator | All boards, survivors, remaining time and standings; no controls                                     |
| `score`                         | Frozen boards and standings, winner announcement and your place if playing                           |
| `done`                          | Frozen boards and final standings; no controls                                                       |

Spectators receive public boards and standings without a private board, hold, next pieces or active buttons. Play is designed for a 390 by 844 phone viewport. The TV stage targets 1920 by 1080; named boards and text accompany player colors, and reduced-motion preferences disable control motion.

## Inputs

Only live, unpaused, surviving players can act. The server validates the input union:

| Input                                                      | Effect                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| `{ type: 'move', direction: 'left' \| 'right' \| 'down' }` | One cell left/right, or one-row soft drop if free            |
| `{ type: 'rotate', direction: 'cw' \| 'ccw' }`             | Quarter-turn using the first fitting SRS candidate           |
| `{ type: 'drop' }`                                         | Hard drop and lock                                           |
| `{ type: 'hold' }`                                         | Store or swap a piece; once per lock; swapped piece respawns |
| `{ type: 'target', playerId }`                             | Select another surviving seat for excess outgoing garbage    |

The six labeled controls are Left, Turn clockwise, Right, Hold, Down and Drop. On the board, tap rotates clockwise, horizontal swipe moves one cell, downward swipe soft-drops and upward swipe rotates counterclockwise. Swipes require 24 px of travel. A hard drop always needs the labeled Drop button; a gesture cannot accidentally commit it. The native rival selector names every eligible target.

## Scoring

Soft drop earns one point per moved row; hard drop earns two per moved row. Automatic gravity earns no drop points. Line-clear points use a fixed multiplier throughout this short match.

| Clear                           | Points                  | Base garbage  |
| ------------------------------- | ----------------------- | ------------- |
| One row                         | 100                     | 0             |
| Two rows                        | 300                     | 1             |
| Three rows                      | 500                     | 2             |
| Four rows                       | 800                     | 4             |
| T-spin, zero/one/two/three rows | 400 / 800 / 1200 / 1600 | 0 / 2 / 4 / 6 |

A T-spin requires a T piece, a successful rotation marker and at least three blocked corners around its center. A successful move, soft drop or gravity step clears that marker; hard drop preserves it. This port treats qualifying spins alike; there is no mini-spin distinction or perfect-clear bonus. A combo adds 50 points for each extra consecutive line-clearing lock and `floor(combo / 2)` attack rows, where the first clear has combo zero. A lock without a clear resets the combo. Back-to-back four-row or T-spin clears award 1.5 times base points and one extra attack row; a nonclearing lock preserves that chain, while an ordinary one/two/three-row clear breaks it.

Attacks cancel the sender's pending garbage first. Only the remainder is sent to their chosen rival. Pending garbage is capped at 20 rows; after cancellation, at most eight rows rise on a lock, each with one seeded hole. Any leftover rows remain pending. A clear can both cancel trouble and send the excess, and combo attacks can make a single-row clear offensive.

Surviving players rank above eliminated players. Survivors compare block score; eliminated players compare survival duration, then block score. Equal criteria share a rank, with stable player-ID order only for display. Final results preserve every initial player, including disconnected and departed seats.

## Edge cases

- A blocked spawn or a locked block above the visible board eliminates that player. Before garbage lifts a row, occupied cells at the top eliminate the seat rather than being silently discarded.
- Attacks to a lost target redirect deterministically to the first other survivor in seat order. Players cannot choose themselves, eliminated seats or spectators as targets.
- Disconnect does not pause a board: server gravity and garbage continue. Refresh reads the same authoritative board, hold and target; the game never waits for a missing phone. A permanent leave or kick immediately eliminates the seat.
- Pause freezes inputs and gravity and shifts gameplay clocks on resume. VIP skip advances the current phase, and VIP end produces final results.
- Stale timers, unknown IDs and wrong-phase inputs are ignored. Invalid targets never switch the chosen rival; processing a live player's input can still advance due gravity. Old input timestamps cannot act on newer pieces. The reducer is pure: time comes from events and randomness from seeded state.
- Views expose public boards but omit the piece seed, future sequence cursors, RNG state, bot plans and rivals' private hold/next data.
- Eliminated players stay on the stage and can watch the remaining match. Simultaneous elimination can leave no survivors and shared placement.

## Settings

No game settings. The match limit, board size and attack rules are fixed; the room's standard bot-strength setting selects easy, normal or sharp behavior.

## Content

No word or asset packs. `content/schema.ts` exports empty `packs`; piece order and garbage holes are generated from the seed. English only. Boards and previews are original SVG/CSS using PartyBox tokens. Line clears use the SDK's existing feedback sound and haptics; phase sounds are silence, reveal and win.

## Sources

Research combines independent public implementations with original manuals and research; no source code or assets were copied. Complete findings, source records and limitations: [job research](../../jobs/P11-tetris-clash/RESEARCH.md), [source record](../../jobs/P11-tetris-clash/SOURCES.md).

- [Official rules](https://tetris.com/about) and [licensed Xbox gameplay/battle help](https://dlassets-ssl.xboxlive.com/public/content/6d185ef8-47b0-4a7d-9ba0-1f101bb9735c/GameManual/d9dfafb5-55ed-44b1-87b3-6548439d292d/en-GB/index.html): basic loop, controls, attacks and cancellation.
- [Demaine, Hall and Li, SRS section](https://erikdemaine.org/papers/TetrisPieces_FUN2024/paper.pdf), [public SRS summary](https://tetris.wiki/Super_Rotation_System) and [simonlc rotation source](https://raw.githubusercontent.com/simonlc/tetr.js/master/piece.js): rotation and kick behavior.
- [simon-hng piece generator](https://raw.githubusercontent.com/simon-hng/tetris-rs/main/src/tetromino.rs) and [mingli1 board source](https://raw.githubusercontent.com/mingli1/tetris/master/core/src/com/mygdx/game/Grid.kt): independent seven-bag and versus checks.
- [simon-hng scoring source](https://raw.githubusercontent.com/simon-hng/tetris-rs/main/src/game.rs) and [Columbia project report](https://www.cs.columbia.edu/~sedwards/classes/2025/4840-spring/reports/Tetris-report.pdf): independent normal-clear scoring checks.

This is a documented PartyBox rules variant, not a claim of official guideline certification. Original live-play/audio timings were not measured during source research; local verification is recorded in the job's VERIFY.md.
