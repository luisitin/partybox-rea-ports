# Bonk.io

## Overview

A PartyBox platform brawler for 2–8 numbered balls. Hold a direction to move, tap Jump from a platform and hold Heavy just before contact to trade mobility for stronger bumps and resistance. Push rivals off; the last ball standing wins the round. All artwork is original SVG. The official name follows the owner's JOBS naming table.

## Players

2–8 humans or bots. Five rounds, one point for each round win, most wins takes the match. Everyone returns for the next round unless they permanently leave. Bots use public platform and ball geometry with easy, normal and sharp strategies. English only. No runtime network calls or dependencies beyond the real SDK and React.

## Phases

| Phase | Exit                                       | TV                                                                            | Phone with a TV                                                    |
| ----- | ------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ready | 3 seconds or VIP skip                      | Arena, numbered seats, start countdown and controls reminder                  | Your number and how to move, jump and time Heavy                   |
| play  | Last standing, no survivors, or 30 seconds | Live platform battle, shrinking-edge warning, clock and eight-seat score rail | Four controls, heavy/movement status, living count and round clock |
| score | 4 seconds or VIP skip                      | Frozen arena, round winner/draw and accumulated round wins                    | Your round result and match standings; arena for stage phones      |
| done  | Terminal                                   | Winner/shared winners, final arena and all standings                          | Your final rank and all standings with the public arena            |

## Phone-only and remote rooms

| Viewer                      | Stage                                                    | Controls                                          |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Phone-only player           | Live arena, numbered balls and public round/hazard clock | Hold Left/Right, tap Jump, hold Heavy while alive |
| Player unable to see the TV | Same stage as phone-only                                 | Same controls                                     |
| Spectator                   | Public arena and standings in every room                 | None                                              |
| Permanently departed seat   | Public arena and truthful watching status                | None                                              |

Stage screens never point at a TV. Numbers, movement direction and heavy outlines distinguish seats/states without relying on colour. Out players follow the current round and return at the next start. The phone never predicts physics or scores.

## Inputs

`{type:'control', move:-1|0|1, heavy:boolean, jump:boolean}`. Left/right are held; holding both means neutral. Jump is a tap request, not an airborne flight button. Heavy lasts while held. Controls release on pointer cancellation/lost capture, blur, pause, round changes and elimination. Keyboard arrows/A/D move, Up/W jumps and X/Shift holds Heavy. The server validates phase, player membership and event time. Repeated unchanged controls do not starve the physics timer.

## Scoring

Only the sole survivor earns one point. A simultaneous fall of the remaining balls is a draw, zero points. A hard timeout with multiple living balls gives each survivor one point; this explicit fallback has no seat-order tiebreaker. All scores count round wins, never damage or fall order. Equal final scores share rank and first place. VIP skip judges the currently settled arena: a sole survivor earns one, multiple survivors before the cap are a zero-point draw. VIP end preserves already awarded match points.

## Edge cases

Physics uses fixed 40 ms steps with 10 ms contact substeps, deterministic shared contact/fall decisions and bounded finite state. Judged stage snapshots occur every 80 ms; bodies and numbered labels ease together between received poses over 80 ms during unpaused play, without prediction or client physics. Pause, other phases and reduced motion snap immediately. Bots target one decision per 200 ms bucket, independently of stage updates; the 80 ms grid quantizes scheduled decision spacing to 160/240 ms. Normal mass is 1, acceleration 480, horizontal speed 250 and jump impulse 360; Heavy uses mass 4, acceleration 190, speed 140 and jump impulse 230. Gravity is 950; contact restitution is 0.65. Arena units are authored, not calibrated metres. The arena is 960 × 540 with radius-28 balls. Platforms begin shrinking after 15 seconds and disappear at 28 seconds; the 30-second cap prevents a stalled round. These timings, motion coefficients, arenas and five-round format are authored living-room adaptations, not measured original values.

A temporary disconnect releases movement, Heavy and queued jump but keeps the ball in the judged arena. Gravity and rivals still affect it; reconnect restores its current position or out status, with no mid-round revival. Permanent leave/kick removes the ball and excludes it from later rounds; stable slot numbers and final results retain the seat. Pause releases controls and freezes physics/clocks; resume shifts absolute clocks by exactly the held duration. Lifecycle releases record active-time input barriers, including between physics steps; paused drops use the frozen instant so fresh controls work immediately after resume. A disconnected room still finishes on timers. Stale timers and inputs cannot change a frozen verdict.

## Settings

None. Every match uses the same five-round format and timing rules.

## Content

Authored symmetric platform layouts and original SVG balls/platforms. No downloaded maps, skins, logos, sprites, music or sounds. `content/schema.ts` contains no external packs. The SDK supplies sound cues.

## Sources

See [RESEARCH.md](../../jobs/P23-bonk-io/RESEARCH.md) and [SOURCES.md](../../jobs/P23-bonk-io/SOURCES.md). The [official site](https://bonk.io/) describes eight-player push-off survival and the heavy trade-off; independent community gameplay documentation and [iogames.onl](https://iogames.onl/bonkio) corroborate movement, jumping, Heavy and last-standing play. Public client material is inspected read-only, never copied. Original live play, audio playback and exact parameter measurements were unavailable; [ASSUMPTIONS.md](../../jobs/P23-bonk-io/ASSUMPTIONS.md) records those limits and the authored choices.
