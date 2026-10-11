# Octo Rally

## Overview

P21 Pong Party, reimagined as an original one-minute paddle survival game. An octagon is the shared arena; each player guards one numbered edge. Slide a phone control to intercept balls. A miss costs one of five lives. One ball begins the rally, then another joins at 15, 30, and 45 seconds. The last paddle standing wins immediately; at 60 seconds, remaining lives lead and saves break ties. Interaction type: slide.

The PartyBox shell owns joining, rules, READY, and the opening countdown. `init` begins `play` directly. The port recreates general paddle mechanics with original SVG/CSS art and SDK sound cues.

## Players

2–8, simultaneous. Each occupied edge is spread around the eight sides; two players get opposite edges. Every unused side reflects the balls. A seat eliminated at zero lives becomes a reflective wall too. Player numbers, names, life counts, and OUT labels accompany the player-colour tokens.

Bots predict the earliest incoming ball, including ricochets from empty walls. Easy bots have shorter prediction, slower reach, and wider error; normal bots balance anticipation and imperfect aim; sharp bots predict farther with precise aim. Bots see only the public arena and never use future launch angles. Spectators can watch the arena and scores without a slider.

## Phases

| Phase   | TV                                                                                  | Phone with TV                                                 | Exit                                     |
| ------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| `play`  | Octagon, numbered paddles, balls, readable life/saves standings and 60-second clock | Own paddle number and orientation, lives, saves, large slider | One survivor, 60-second cap, or VIP skip |
| `score` | Frozen arena and ranked results                                                     | Own result, lives/saves, final standings                      | 6 seconds or VIP skip                    |
| `done`  | Winner/tie and final standings                                                      | Own rank and final standings                                  | Terminal; shell results remain available |

### Phone only and remote seats

| Phase   | Phone-only stage                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------- |
| `play`  | Live arena above the slider, labelled own edge and lives; eliminated seats and spectators keep watching |
| `score` | Frozen arena, winner/tie, and compact eight-seat standings                                              |
| `done`  | Final arena, winner/tie, own rank, and full final standings                                             |

`usePhoneOnly` / `PhoneOnlyProvider` selects the phone-only layout. A player with `canSeeTv: false` gets the same stage even in a TV room. The public world is carried to every phone, preserving the stage through refresh. No phone-only instruction points to a TV. The play layout fits 390×844 without scrolling, including the controls; TV designs target 1920×1080 with body text at least 32px and a 96px timer.

## Inputs

`{ type: 'move', position: number }`, with a finite position in `[0, 1]`, during `play`. Position follows the arrow shown for the player's numbered side. Native range input supports touch, mouse, and arrow keys. The server advances the arena to the input time before changing the paddle. Spectators, eliminated seats, invalid values, stale inputs, and other-phase inputs cannot move a paddle.

## Scoring

Match score = `1000 × remaining lives + saves`, with saves capped at 999. One life therefore outweighs all possible save bonuses. A ball deflected by your paddle adds one save; a ball passing your guard removes exactly one life and re-serves from the centre after a 700ms grace. No points are awarded for a wall bounce. Equal life/save totals share the rank. Every starting seat stays in final results, including disconnected and departed players.

## Edge cases

- Physics runs on a fixed 20ms grid. Swept intersections with the inset octagon include ball radius and prevent tunnelling through a paddle or wall. Corner contacts are resolved in a bounded loop. Paddle positions are clamped by the schema and checked again in the reducer.
- The engine wakes every 100ms while the visible clock points at the match end. Catching up in one large timer or many small timers gives the same physics state. Ball count is bounded at four; rally speed is capped.
- A pause settles play up to the hold time. Resume shifts the match origin/end by the hold duration, so motion and pending serves retain their remaining time. Timers and slider inputs are ignored while paused.
- Refresh restores the same paddle, position, lives, and arena. Disconnect does not reset a paddle or block the clock: it stays where it was until the player returns. Permanent departure is also non-blocking.
- Every active ball and paddle is public. Views omit RNG and seed-drawn future launch angles. All views are safe for unknown ids and prototype-shaped ids.
- VIP skip freezes and scores the current arena; skip from `score` completes. VIP end always yields complete results. Terminal state ignores unrelated input and stale timers.

## Settings

None. Match length, lives, and ball schedule are fixed for consistent party pacing. The shell's bot strength applies to the strategy. English only; arcade category, no minigame registration.

## Content

No text packs. Arena geometry is original and fixed; launch directions are drawn from the SDK seed. `content/schema.ts` exports empty `packs`. Fixtures cover all three phases, with `done.json` obtained by continuing `score.json`.

## Sources

Primary materials inspected 2026-10-11:

- [PPong developer listing and live client](https://niko-game.itch.io/ppong): individual guarded regions, lives, bot practice, survivor finish.
- [Warlords original Atari manual](https://www.atariage.com/2600/manuals_old/warlords.html): one-axis shields, missed-ball danger, survivor finish; independently supports the defensive survival loop.
- [Octopong designer notes](https://www.i-volve.net/gd/mind-fragments/octopong): proposed octagonal one-eighth-per-player arena; the octagon is also prescribed by P21.
- [PonGo developer repository](https://github.com/lguibr/pongo): shared edge defence, empty-wall ricochets, multiball, contact-angle returns, reconnect.
- [PONG developer repository](https://github.com/Gr33nOps/pong): touch-drag controls and rally acceleration; independently supports the one-axis control and rising pressure.

Exact lives, timings, fixed arena, spawn schedule, and score weights are original PartyBox choices. See `jobs/P21-pong-party/RESEARCH.md` for evidence pairs, access limits, source inspection, and the living-room translation. All shipped art is inline SVG/CSS; sounds are SDK cues. No original code, assets, music, logos, or trademarks ship in the port.
