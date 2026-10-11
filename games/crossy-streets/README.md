# Crossy Streets

## Overview

A 60-second distance race on one seeded 15-cell-wide crossing map. Tap a direction to hop a cell, dodge moving traffic, ride moving logs, and use grassy islands as checkpoints. An eagle catches racers who do not reach a new furthest row for eight seconds. A crash costs one second and returns you to the last grassy checkpoint; your best distance stays. All eight people keep playing until the clock ends. This is an original PartyBox adaptation of endless crossing mechanics, with original geometric art and the SDK's sounds.

## Players

2–8, anywhere. Players share a public map and may occupy the same cell without blocking one another. Numbered racers and colours match on both surfaces. Bots support easy, normal and sharp strengths: they compare legal hops, predict car collisions and log support, favour new progress, and retreat or wait when the next hop is unsafe. The stronger levels react more frequently and take fewer detours.

## Phases

| Phase   | TV                                                                                              | Phone with a TV                                                                                     | Exit                                |
| ------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `play`  | Shared map around the leading row, numbered racers, eight-player distance rail, 60-second clock | Personal crossing map, racer number, best distance, four hop buttons, eagle warning and crash cause | 60 seconds or VIP Finish race       |
| `score` | Frozen map, final distances and winning names                                                   | Own best and complete final distance list                                                           | 8 seconds or VIP Show final results |
| `done`  | Final map and tied or sole winner                                                               | Own best and final distance list                                                                    | Terminal; results available         |

The shell owns the initial rules, READY and countdown; this game begins in play without repeating them. During play the engine wakes every 200 ms and checks each intervening 50 ms collision sample. Views expose the full round deadline rather than the next simulation wake.

### Phone only

| Phase   | Phone stage                                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `play`  | Actual crossing map around your row and column, your number, best distance, countdown, eagle warning, crash cause and four direction buttons |
| `score` | Frozen map and all final distances, your row marked                                                                                          |
| `done`  | Final map, winner, own best and all final distances                                                                                          |

The SDK PhoneOnlyProvider/usePhoneOnly boundary selects the stage. A remote player who cannot see the TV gets it too. Spectators see the public map and standings without controls. No phone-only screen points at a TV.

## Inputs

`{ type: 'hop', dir: 'up' | 'down' | 'left' | 'right' }`. A hop enters a neighbouring cell immediately, with destination collision checked before awarding progress. Minimum interval is 240 ms, quantized to the next available 50 ms judged sample (250 ms in ordinary play). The phone sends one input per tap, or non-repeating arrow/WASD key. Trees and top/bottom bounds reject a hop. Sideways edges can kill. Disconnected players, unknown players and spectators cannot move. Late packets before the last judged time are ignored.

## Scoring

Score is the highest safely reached row (starting row zero). Lethal hops do not score. Retreats, lateral moves and replaying old rows do not score or renew the eagle allowance. A crash never reduces score. The furthest row at 60 seconds wins; equal distances share rank and victory. Live TV distances are public, so phones never reveal anything ahead of the stage. Results include every original player, including leavers, with finite scores.

## Edge cases

- Grass has visible blocking trees, with a clear middle column. The first three rows are safe; rest islands occur at least every four rows. The same seeded 256-row course is generated once for everyone. At a maximum of four hops per second, nobody can exhaust it in 60 seconds.
- Cars and logs move continuously in cells per second, wrap outside the map and are judged at 50 ms intervals. A river supports the entire racer radius; while supported, its current carries the racer. Falling off the map or missing a log gives an explicit cause.
- Eagle allowance renews only on a new best row. Respawning grants 2.2 seconds of eagle protection without rewriting the progress timestamp, allowing a real attempt to get moving again.
- Refresh reads the current server racer, checkpoint, distance and warning. A disconnected racer remains in the simulation; the race never waits for their phone.
- Pause settles to the pause instant, then holds inputs, collisions and private relative clocks. Resume shifts the absolute start/end by the held duration. Stale timers cannot move the phase. A skip while paused resumes before finishing; end produces results immediately.
- Every map and racer field is public. Views omit the private PRNG and full off-camera generation data; unknown viewers get no personal racer. State and views remain JSON-safe.
- The TV camera follows progress; trailing positions remain on the rail. Phone stages follow each viewer independently and never impose a death because another player moved the camera.

## Settings

No game settings: one 60-second race. Bot strength is the shell's standard easy/normal/sharp setting. English-only Arcade edition.

## Content

No word packs. `content/schema.ts` exports empty packs. Roads, cars, trees, logs and numbered geometric racers are original inline SVG/CSS. Presentation uses PartyBox tokens for colour, spacing, typography and motion; arrow buttons are keyboard accessible and exceed 44 px. Reduced-motion OS and in-app settings disable button transitions. No runtime requests, tracking, ripped assets or new dependencies.

## Sources

[Official product](https://www.crossyroad.com/) and [original-developer GDC slides](https://media.gdcvault.com/gdc2015/presentations/Hall_Matthew_Crossy_Road_Whale.pdf) establish the endless crossing premise and procedural/tap-swipe design. Independent firsthand [TouchArcade](https://toucharcade.com/2014/11/21/crossy-road-review/) and [Pocket Gamer](https://www.pocketgamer.com/crossy-road/review/) launch reviews corroborate cardinal hops, random crossings, distance chasing and eagle pressure. [lowthergv's public remake client](https://github.com/lowthergv/crossy) was inspected for generation/movement invariants; it is not proprietary-original evidence and no code was copied.

Exact original timing and lane probabilities were not measured. The race duration, eagle threshold, checkpoints, respawns and shared non-colliding racers are documented adaptations. Direct original play was unavailable because no browser-control surface is connected. Full evidence and provenance: `jobs/P14-crossy-streets/RESEARCH.md`, `SOURCES.md`, `ASSUMPTIONS.md`.
