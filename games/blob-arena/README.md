# Blob Arena

A PartyBox cell arena for 2–8 players. Everyone steers a hungry blob around the same field, eats snacks to grow, and swallows smaller rivals. Tap SPLIT for a fast lunge that leaves smaller, more vulnerable pieces. If every piece is swallowed, return in three seconds. Each player's mass at the end of a 90-second round becomes points; the largest total after three rounds wins.

The game recreates the growth-versus-speed and risky-split mechanics studied in Agar.io with original code and graphics. Its match format and numerical balance are designed for eight people sharing a living-room TV. Category: Arcade. Interaction: hold a joystick and tap split.

## Overview

The arena is 160 × 100 units and remains fully visible. Each seat starts with one 24-mass cell. There are always 96 snacks; each adds 3 mass and is replaced at a seeded position when eaten. Bigger cells move more slowly and reach farther. Walls stop cells without killing them.

A rival can be swallowed only when the attacking **cell** has at least 1.25 times the target's mass and overlaps deeply. Total mass across several pieces does not make a small piece capable of eating a larger one. Equal cells can pass each other safely.

At 48 mass, a cell can split into equal halves. Every eligible piece splits until the player has at most four cells. The new half lunges in the steering direction, so the player must be aiming. Split input has a one-second cooldown. Each new pair has an eight-second merge lock. When every surviving piece is eligible, the pieces gather automatically and merge on overlap. Splitting changes reach and risk, not total mass.

Fully swallowed players return after three seconds with 24 mass at a seeded safe location. A returning cell has two seconds of protection: it can collect snacks, but cannot eat or be eaten by rivals, or split. Initial cells have one second of protection. A phone shows the return countdown rather than asking the room to wait.

## Players

2–8, with bots supported. Every cell carries its player's number/name as well as a stable player-token colour; colour alone never identifies a seat. Player numbering is the same on the TV and phone.

Bots use public arena information and the same inputs as humans. Easy bots graze nearby snacks with some variation. Normal bots choose nearby food and flee larger threats. Sharp bots look farther ahead for threats, chase edible rivals, and split only when the projected half can eat its target. All strengths steer away from walls when an escape route would otherwise pin them there.

## Phases

The shell handles the match-start introduction. The game begins directly in `play`; each later round resets the arena and mass without resetting banked points.

The third round's score screen announces that final results follow; it never promises a fourth round.

| Phase   | TV                                                                                              | Phone with a TV                                                                                                                           | Exit                                                             |
| ------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `play`  | Whole arena, numbered/name-labelled blobs and snacks, round clock, live mass and banked points. | Your number, mass, joystick, SPLIT button, and a specific reason when split is unavailable; a three-second return countdown if swallowed. | 90 seconds, or VIP skip → `score`.                               |
| `score` | Frozen arena, round-end mass, `+points` and match totals, best first.                           | Your round points and total; no controls.                                                                                                 | 6.5 seconds, or VIP skip → next `play`, or `done` after round 3. |
| `done`  | Winner or tied winners and final standings.                                                     | Your result, place, and total.                                                                                                            | Terminal; `results()` is non-null.                               |

Every phase has a state fixture. The engine's play deadline re-arms every 200 ms, while the public deadline is the round's end. The game therefore advances and ends without input from any phone.

### Phone only

With no TV (`ctx.presence.phoneOnly`), or for a player who cannot see it (`canSeeTv: false`), the phone carries the public arena and becomes the stage. It never asks the player to look at a TV. The client uses the SDK's `usePhoneOnly` / provider behavior.

| Phase   | Phone-only stage                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `play`  | Live full arena, round timer, your mass, joystick and split. A returning player keeps watching the arena with their return countdown. |
| `score` | Frozen arena, your round gain and banked total, compact standings.                                                                    |
| `done`  | Winner/tie line, your result, compact final standings and arena.                                                                      |

A spectator watches the stage without joystick or split controls. The 390 × 844 play layout reserves space for the arena and thumb controls without scrolling; eight-player score/done layouts use compact standings.

## Inputs

- `{ type: 'steer', x, y }`: finite numbers from -1 to 1. The server normalizes a diagonal vector to length one; a zero vector stops ordinary movement. Releasing the joystick sends zero. Keyboard directions provide the same inputs.
- `{ type: 'split' }`: uses the current nonzero steering direction. Ignored during protection, cooldown, at the four-cell cap, below the threshold, or outside play.

Only connected playing members can send inputs. Unknown players, spectators, departed seats, malformed/non-finite controls, stale inputs, and inputs after the round deadline cannot steer or create mass. The phone explains disabled split states: grow one blob to 48 mass, steer to aim, spawn shield, cooling down, or four blobs maximum. The growth threshold applies to one piece, not the player's combined mass.

## Scoring

Round points are `floor(sum of the player's surviving cell masses)` at the horn. Losing one piece reduces that remaining mass; the mass of a swallowed piece transfers to its eater. All split pieces count once. A player awaiting respawn at the deadline has zero round mass. There is no kill bonus or peak-mass bonus.

Match points are the sum of the three round scores. Equal totals share rank and the win; no hidden tie-break is applied. A VIP skip banks the mass reached when skipped, and ending early banks the current settled round once.

## Edge cases

- Physics runs on a fixed 100 ms grid. Time comes only from events; every snack replacement and spawn draw advances `state.rng`. The same initial seed and event sequence produce the same state.
- Movement speed is `max(6, 20 × (mass / 24)^-0.23)` units/s. Radius is `min(24, 0.55 × sqrt(mass))` units. Split launch adds 55 units/s and retains 78% of that extra velocity each physics step. These are house values, not original-server claims.
- Rival eating requires `big.mass >= small.mass × 1.25` and center distance `< bigRadius - 0.35 × smallRadius`. Collision order is stable by cell id. A cell already eaten cannot be credited again.
- Same-owner pieces cannot eat one another as rivals. Before their locks end they separate on overlap; afterward they gather at up to 8 units/s toward siblings and merge on overlap. Merge preserves mass and uses a mass-weighted position.
- A protected cell still eats snacks. Its protection blocks rival eating in both directions; its ring and phone label mark the protection.
- Respawns sample eight seeded candidate locations and choose the one with the most clearance from existing cells. Protection covers a crowded arena when no fully clear spot exists.
- Pause settles play at the pause instant. Resume moves the round's absolute start/end clocks forward; relative split, merge, shield, and respawn times remain frozen during the pause.
- A disconnected seat stops steering and its cells remain in the arena. The match does not wait; reconnect restores the seat's current mass, position, and controls. A permanently departed player no longer respawns or enters later rounds.
- Nothing in the arena is secret. TV and phone-only views expose the same public world. A phone with a TV receives its own status and public mass/score summaries, without the arena payload. RNG and server input histories are not views.
- The final horn settles only to 90 seconds, even when a timer event arrives late. Score screens ignore ordinary game inputs, and terminal state cannot reopen play.

## Settings

None. Three rounds of 90 seconds are fixed by P05. The room's standard pause, skip, mute, reduced-motion, and bot-strength controls remain available.

## Content

No packs or external content. `content/schema.ts` exports an empty pack list; the seed creates original snack locations. English only. Arena art is code-drawn using PartyBox colours, type, spacing, and motion tokens. Reduced motion removes decorative transitions; state and gameplay remain readable. Audio uses the existing PartyBox synthesized cues, with no sound per snack and no imported original audio.

## Sources

[Miniclip's official controls guide](https://support.miniclip.com/hc/en-us/articles/4404685562641-How-to-start-playing-Agar-io), its [archived tips](https://miniclip783.rssing.com/chan-25840256/latest.php), and [Komarek's independent guide](https://jirikomarek.net/web/how-to-play-agar-io-skins-controls-description/) establish the growth/slowness and split/reunion tradeoffs. [The splitting wiki](https://agario.fandom.com/wiki/Splitting) supplies a second authored split account. Current HTML and public client wrappers were inspected read-only at [agar.io](https://agar.io/); interactive play was unavailable through the research tool.

Historical speed and merge reports conflict, so exact original constants are not claimed. The full two-source fact matrix, access attempts, audio limits, and tuning rationale are in [RESEARCH.md](../../jobs/P05-blob-arena/RESEARCH.md); attribution/provenance is in [SOURCES.md](../../jobs/P05-blob-arena/SOURCES.md), with explicit deviations in [ASSUMPTIONS.md](../../jobs/P05-blob-arena/ASSUMPTIONS.md). No source code or assets were copied.
