# Doodle Climb

## Overview

An automatic-bounce climbing race with original vector art. Every player steers through the same seeded platform route on an independent screen. Bounce up, wrap around either edge and catch a spring. Three rounds, each capped at 60 seconds; the greatest combined height wins. The shell owns the initial instructions and countdown; play starts immediately.

## Players

2–8 players. Bots support easy, normal and sharp: all plan descending landings from their visible camera; easy aims imperfectly, normal tracks centres, sharp stops within a safe platform margin. Players never collide or move each other's camera. A phone always shows its own route, so steering remains possible away from a TV.

## Phases

| Phase   | TV                                                                   | Phone with TV                              | Exit                            |
| ------- | -------------------------------------------------------------------- | ------------------------------------------ | ------------------------------- |
| `play`  | Every climber side by side, names, height, alive/out and round clock | Your climbing scene, height, two hold pads | All fall, round cap or VIP skip |
| `score` | Frozen scenes and round heights plus match totals                    | Your gained height and match standings     | 5 s or VIP skip                 |
| `ready` | Next round's new route and rematch countdown                         | Your new scene; next round announcement    | 2.5 s or VIP skip               |
| `done`  | Winner/tied leaders and final standings                              | Your rank, total and final standings       | Terminal; results available     |

### Phone only

| Phase   | Phone without TV                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `play`  | Own stage above hold controls, your current height and room progress; spectators see stage and standings without buttons |
| `score` | Round gained height and every player's total                                                                             |
| `ready` | Next round's route and countdown                                                                                         |
| `done`  | Winner, own rank and full standings                                                                                      |

`usePhoneOnly()` follows the SDK provider; no phone-only screen points at a TV. Spectators receive the public stage and cannot steer. A fallen climber watches the remaining players until the next round.

## Inputs

`{ type: 'steer', dir: -1 | 0 | 1 }`: hold left, release/neutral, hold right. Both held means neutral. Keyboard arrows or A/D work too. Pointer cancellation, focus loss and a new phase clear held controls. Unknown players, spectators, dead/disconnected players, stale inputs and off-phase inputs cannot steer.

## Scoring

Round points = `floor(maximum world height)`; falling never removes height. Match points are the sum of round heights. Ties share their rank, including first place. End/skip during play settles the current physics before crediting it once. Ending during a score screen never credits again.

## Edge cases

- Physics uses fixed 20 ms samples, gravity 600, ordinary bounce 330, spring bounce 440 and horizontal speed 150 world units/s. Platform collisions only apply while falling across their top. These are original port constants.
- Width is 240 units, viewport height 320. Horizontal position wraps. A camera follows the player's maximum height, with its bottom at `max(0, peak - 180)`; falling more than 24 below that bottom ends the run. Rival cameras are independent.
- Every route starts with a full-width floor. Consecutive gaps are 45–64, centres differ by at most 65 around the wrap, widths shrink gradually from 76 to 44. The ordinary bounce apex is 90.75, leaving every next ledge vertically reachable. Springs have a coil silhouette and an upward arrow as well as a different token colour.
- All seats start at the same position with identical physics. One course is generated per round from `state.rng`; different seeds/rounds vary it. No code or assets from the original are copied.
- A disconnect releases steering immediately; automatic bouncing and the round clock continue. Reconnect restores the same climber. Leaving for good ends that run but keeps its score/rank. The game never waits for a phone.
- Pause settles play at the pause event and holds input/timers. Resume moves both the start/end clocks by the pause length; skip while paused uses the same shift. Late timer delivery judges intervening fixed samples, so it cannot tunnel through platforms.
- Views omit PRNG state and platforms beyond any visible player's camera. Bots only use their own visible route. The phone cannot reveal the future course.
- All states/views are JSON, with no runtime network calls. Reduced motion disables decorative transitions; game positions remain readable.

## Settings

| Key       | Default | Range               |
| --------- | ------- | ------------------- |
| `rounds`  | 3       | 1–3                 |
| `seconds` | 60      | 30–60 in 15 s steps |

## Content

Procedurally generated original routes; normal and spring platforms. Empty content pack schema. English only. Inline SVG climbers/platforms use PartyBox tokens; sound uses existing SDK cues. No external art, fonts, audio or added dependencies.

## Sources

The original's automatic bounce, tilt steering, upward camera, fall death, springs and height competition were studied from [Lima Sky's official listing](https://apps.apple.com/us/app/doodle-jump-insanely-good/id456355158), [Macworld's firsthand review](https://www.macworld.com/article/198325/doodlejump.html), [Pocket Gamer's review](https://www.pocketgamer.com/doodle-jump/review-8982/) and [The en's wrap description](https://the-en.com/2011/06/04/wp7-game-review-doodle-jump/amp/). The [public JavaScript recreation](https://github.com/takosenpai2687/doodle-jump) was read and played as a mechanics comparison; no code or assets were copied. Native numeric physics/timings were unavailable; this port's constants and multiplayer pacing are original. Full evidence, version differences and provenance: `jobs/P15-doodle-climb/{RESEARCH,SOURCES,ASSUMPTIONS}.md`.
