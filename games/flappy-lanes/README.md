# Flappy Lanes

An original PartyBox one-tap flight race for 2-8 players. Drawn gliders fly through arch gates
in separate lanes on the same seeded course. Last alive wins the round; accumulated survival
points decide the match. Category: Arcade. Three rounds are the default.

## Overview

Tap once to rise, then let gravity bring the glider down through the next opening. Holding
does not flap repeatedly. Fixed gate spacing and seeded gap heights are identical for every
lane. A gate or boundary collision ends that attempt. A round ends with at most one survivor
or at 45 seconds, then shows scores for eight seconds. The shell owns initial READY/countdown;
the game starts directly in `play`. Three capped rounds take at most 159 seconds; six take
318 seconds, within twice the manifest's three-minute estimate. Pauses and setup are excluded.

## Players

2-8, including bot seats. Lane names, numbers and matching colours identify racers without
colour alone. Easy, normal and sharp bots sample current motion and the next visible gate
when externally polled; they have no autonomous ticks or hidden-course advantage. The job's
simulation polls every 100 ms. Sharp predicts 180 ms ahead, normal 140 ms with small aim
variation, and easy 50 ms with wider variation and occasional missed decisions.

## Phases

| Phase   | TV                                                                  | Phone with a TV                                                                      | Exit                                                            |
| ------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `play`  | Live lanes, names/numbers, OUT labels, gate counts, round and clock | Your lane/status/count; large FLAP button while alive, elimination feedback when out | At most one alive, 45 s or VIP skip → `score`                   |
| `score` | Frozen stage, round gains and totals; ties shown together           | Your round gain, total and round result                                              | 8 s or VIP skip → next `play`; after configured rounds → `done` |
| `done`  | Winner or shared winners and standings                              | Your place, points and match result                                                  | Terminal; `results()` is non-null                               |

### Phone-only and remote play

With `ctx.presence.phoneOnly` or `canSeeTv: false`, the phone is also the stage. Spectators
receive the stage without buttons. These screens never direct anyone toward a TV.

| Phase   | Phone stage                                                                           |
| ------- | ------------------------------------------------------------------------------------- |
| `play`  | Visible course, racers and alive/out status, your lane marked; FLAP below while alive |
| `score` | Frozen stage, round result, your gain/total and compact standings                     |
| `done`  | Final stage, winner/tie and standings with your place marked                          |

Play fits 390×844 without scrolling; the action stays within thumb reach. At 1920×1080 the
TV uses four-by-two panels for eight racers. Decorative motion respects reduced motion.
A paired controller can omit stage data to keep updates small.

## Inputs

`{ type: 'flap' }` during `play` resets upward velocity, with 120 ms between accepted flaps.
Unknown players, spectators, dead racers, other phases and paused inputs are ignored. Time
comes from `event.now`: advance flight and resolve collision before applying a later flap.

## Flight and course

These are PartyBox approximations, not original-game measurements. Positive y points down.

| Parameter                  | Game units                                      |
| -------------------------- | ----------------------------------------------- |
| Viewport and glider        | 140×100; fixed x 28; radius 3                   |
| Initial flight             | y 50; velocity -18/s                            |
| Gravity, flap and fall cap | 80/s²; flap resets to -28/s; downward cap 48/s  |
| Gate and speed             | Width 12; opening 38; scroll 26/s               |
| First gate                 | x 125; gap centre y 50                          |
| Spacing                    | 58, approximately 2.23 s                        |
| Later centres              | Seeded y 30-70; neighbouring changes at most 12 |

The glider's full collision radius must fit through the opening. Gates beyond the visible
horizon are omitted from views, and bots use only the next visible gate.

## Scoring

One round point per rival who died strictly before you. Deaths on the same physics sample
tie; survivors at the cap tie and beat eliminated racers. The match score sums the configured
rounds; equal totals share rank and victory. Public `passed` counts gates for skill feedback;
it never contributes match points or breaks a survival tie.

## Edge cases

- Same seed and events reproduce every lane's course and physics; RNG lives in state.
- Simultaneous final crashes tie; player-array order cannot determine the winner.
- Idle/disconnected gliders continue under gravity. Rejoin restores the current lane,
  without a safer reset or waiting for a missing phone.
- Pause freezes flight; resume shifts flight and phase clocks by the paused duration.
- Dead racers and spectators cannot flap; stale timers and unrelated events do not advance rounds.
- Future gates stay hidden in every view; bots sample only current motion and visible gates.
- VIP skip scores the current survival state; VIP end produces terminal results.

## Settings

| Key      | Type   | Default | Range       |
| -------- | ------ | ------- | ----------- |
| `rounds` | number | 3       | 1-6, step 1 |

Course parameters, round cap and survival scoring are fixed. The room supplies bot skill,
pause, sound and reduced-motion preferences.

## Content

No word/question packs; `content/schema.ts` validates empty packs. Courses are seeded,
the interface is English only, gliders/arches are original inline SVG using PartyBox tokens,
and feedback uses the SDK. No source-game assets or runtime network calls are shipped.

## Sources

Details: [RESEARCH.md](../../jobs/P12-flappy-lanes/RESEARCH.md),
[SOURCES.md](../../jobs/P12-flappy-lanes/SOURCES.md), [ASSUMPTIONS.md](../../jobs/P12-flappy-lanes/ASSUMPTIONS.md).

- [Harvard CS50](https://cs50.harvard.edu/extension/games/2026/spring/notes/1/) and [Raspberry Pi / Wireframe](https://www.raspberrypi.com/news/recreate-flappy-birds-flight-mechanic-wireframe-29/): independent primary recreation sources for flight, course, scoring and collision.
- [TIME's 2014 firsthand review](https://time.com/4034/no-you-dont-have-to-play-flappy-bird/): original observed difficulty and feedback.
- [FlapPyBird archive](https://github.com/sourabhv/FlapPyBird/blob/038359dc6122f8d851e816ddb3e7d28229d585e5/flappy.py): clone parameter comparisons; no copied code/assets.
- [Bay Tek arcade manual](https://www.betson.com/wp-content/uploads/wpallimport/files/redemption-service-manuals/flappy-bird-game-service-manual-baytek-games.pdf): arcade one-button and gap-difficulty corroboration.

The mobile original was not played firsthand here; exact original physics remain unproven.
