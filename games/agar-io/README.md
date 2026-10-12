# Agar.io

A PartyBox cell arena for 2–8 players. Everyone steers a hungry blob around the same field, eats snacks to grow, and swallows smaller rivals. Tap SPLIT for a fast lunge that leaves smaller, more vulnerable pieces. If every piece is swallowed, return in three seconds. Each player's mass at the end of a 90-second round becomes points; the largest total after three rounds wins.

The game recreates the growth-versus-speed and risky-split mechanics studied in Agar.io with original code and graphics. Its match format and numerical balance are designed for eight people sharing a living-room TV. Category: Arcade. Interaction: hold a joystick and tap split.

## Overview

The arena is 160 × 100 units. The shared TV and spectator overview show the whole field; a playing phone follows the center of its own pieces and zooms out as their radii grow. Each seat starts with one 24-mass cell. There are always 96 snacks; each adds 3 mass and is replaced at a seeded position when eaten. When pieces contest a snack, the nearest eligible center wins; negligible position-rounding ties use a seeded choice over canonical cell IDs. Bigger cells move more slowly and reach farther. Walls stop cells without killing them.

A rival can be swallowed only when the attacking **cell** has at least 1.25 times the target's mass and overlaps deeply. Total mass across several pieces does not make a small piece capable of eating a larger one. Equal cells can pass each other safely.

At 48 mass, a cell can split into equal halves. Every eligible piece splits until the player has at most four cells. The new half lunges in the steering direction, so the player must be aiming. Split input has a one-second cooldown. Each new pair has an eight-second merge lock. When every surviving piece is eligible, the pieces gather automatically and merge on overlap. Splitting changes reach and risk, not total mass.

Fully swallowed players return after three seconds with 24 mass at a seeded safe location. A returning cell has two seconds of protection: it can collect snacks, but cannot eat or be eaten by rivals, or split. Initial cells have one second of protection. A phone shows the return countdown rather than asking the room to wait.

## Players

2–8, with bots supported. Every piece carries a centered, outlined name, including every split half, as in the original. Stable player-token colours and numbered standings connect the shared TV to each phone; SVG titles retain the full identity and mass. Long in-cell captions shorten with an ellipsis while preserving the final identifying character; complete names remain in standings and accessible titles. Colour alone never identifies a seat. Larger foreground cells naturally cover smaller pieces and their names.

Bots use public arena information and the same inputs as humans. Easy bots graze nearby snacks with some variation. Normal bots choose nearby food and flee larger threats. Sharp bots look farther ahead for threats, chase edible rivals, and split only when the projected half can eat its target. All strengths steer away from walls when an escape route would otherwise pin them there.

## Party format

If every piece is swallowed, steering stops and the player watches the live arena and leaderboard for three seconds, then automatically returns with 24 mass and a two-second shield in the same round and world. A return scheduled after the shared horn never starts: the player watches until the round ends. There is no early finish or independent retry button.

A live leader can lose mass or transfer it to a rival before the horn; food replenishes, smaller cells move faster, and splitting exposes edible halves. A returning player can therefore recover and affect the lead. Earlier banked points cannot be taken back, and a sufficiently large late deficit may put first place out of reach; that player still contests the remaining places and influences the live arena. Each remaining round restarts everyone's mass while retaining totals.

One 90-second clock ends the round for everyone. Eliminating a player never ends it. Pause holds the shared clock, and VIP skip banks the settled mass for all seats together. The sum of mass at the three horns wins. The final screen names the winner or tied winners on the TV and phones and shows every total and place; ties share rank and win, with no hidden tie-break.

## Phases

The shell handles the match-start introduction. The game begins directly in `play`; each later round resets the arena and mass without resetting banked points.

The third round's score screen announces that final results follow; it never promises a fourth round.

| Phase   | TV                                                                                              | Phone with a TV                                                                                                                                               | Exit                                                                  |
| ------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `play`  | Whole shared arena, inside-name blobs and round food, round clock, live mass and banked points. | Your number, mass, a floating joystick, circular SPLIT button, and a specific reason when split is unavailable; a three-second return countdown if swallowed. | 90 seconds, or VIP skip → `score`.                                    |
| `score` | One complete summary: round-end mass, `+points` and match totals, best first.                   | Your round points and total, full standings; no controls or duplicate arena labels.                                                                           | SDK reading hold, or VIP skip → next `play`, or `done` after round 3. |
| `done`  | Winner or tied winners and final standings.                                                     | Your result, place, and total.                                                                                                                                | Terminal; `results()` is non-null.                                    |

Every phase has a state fixture. The engine's play deadline re-arms every 200 ms, while the public deadline is the round's end. The game therefore advances and ends without input from any phone.

### Phone only

With no TV (`ctx.presence.phoneOnly`), or for a player who cannot see it (`canSeeTv: false`), the phone carries the public arena and becomes the stage. It never asks the player to look at a TV. The client uses the SDK's `usePhoneOnly` / provider behavior.

| Phase   | Phone-only stage                                                                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `play`  | Personal follow camera, inside names, score at upper left, leaderboard upper right, floating joystick and circular split over the field. A returning player keeps watching the arena with their return countdown. |
| `score` | Your round gain and banked total, complete compact standings. No repeated scene labels compete with the summary.                                                                                                  |
| `done`  | Winner/tie line, your result and complete compact final standings.                                                                                                                                                |

A spectator or permanently departed seat watches the stage without joystick or split controls, including in a room with a TV. The 390 × 844 play layout reserves space for the arena and thumb controls without scrolling; eight-player score/done layouts use compact standings.

## Inputs

- `{ type: 'steer', x, y }`: finite numbers from -1 to 1. The server normalizes a diagonal vector to length one; a zero vector stops ordinary movement. Releasing the joystick sends zero. Keyboard directions provide the same inputs.
- `{ type: 'split' }`: uses the current nonzero steering direction. Ignored during protection, cooldown, at the four-cell cap, below the threshold, or outside play.

Only connected playing members can send inputs. Unknown players, spectators, departed seats, malformed/non-finite controls, stale inputs, and inputs after the round deadline cannot steer or create mass. The phone explains disabled split states: grow one blob to 48 mass, steer to aim, spawn shield, cooling down, or four blobs maximum. The growth threshold applies to one piece, not the player's combined mass.

## Scoring

Round points are `floor(sum of the player's surviving cell masses)` at the horn. Losing one piece reduces that remaining mass; the mass of a swallowed piece transfers to its eater. All split pieces count once. A player awaiting respawn at the deadline has zero round mass. There is no kill bonus or peak-mass bonus.

Match points are the sum of the three round scores. Equal totals share rank and the win; no hidden tie-break is applied. A VIP skip banks the mass reached when skipped, and ending early banks the current settled round once. A leave or kick arriving at or after the unpaused horn banks that horn's mass before retiring the seat; a pre-horn departure forfeits current mass. Later connection churn cannot bank twice.

Each score summary uses `readingMs(wordCount(...), { ui: true })` from the SDK, with a 6.5-second minimum. The hold covers the longest complete TV/phone summary and reserves an Offline/Left word for every seat. Eight ordinary one-word names hold for 33,552 ms; eight maximally word-dense legal 16-codepoint names hold for 57,794 ms. Even the latter keeps all three 90-second rounds and three holds within 443,382 ms, below the manifest's doubled 600,000 ms estimate. VIP skip remains available.

## Edge cases

- Physics runs on a fixed 100 ms grid. Time comes only from events; every snack replacement and spawn draw advances `state.rng`. The same initial seed and event sequence produce the same state.
- Movement speed is `max(6, 20 × (mass / 24)^-0.23)` units/s. Radius is `min(24, 0.55 × sqrt(mass))` units. Split launch adds 55 units/s and retains 78% of that extra velocity each physics step. These are house values, not original-server claims.
- Rival eating requires `big.mass >= small.mass × 1.25` and center distance `< bigRadius - 0.35 × smallRadius`. For eligible unprotected rivals, the same overlap threshold also applies to their minimum relative separation during a physics step, so a lunge can swallow prey crossed between sampled positions. Sibling merging/separation happens first. Rival eligibility then uses one shared frame snapshot: the nearest eligible predator wins, with negligible geometry ties resolved by state RNG over canonical IDs. Increasing-mass ownership chains transfer every original mass exactly once. New rival mass gains enable further catches on the next 100 ms frame. A cell already eaten cannot be credited again.
- Same-owner pieces cannot eat one another as rivals. Before their locks end they separate on overlap; afterward they gather at up to 8 units/s toward siblings and merge on overlap. Merge preserves mass and uses a mass-weighted position.
- A protected cell still eats snacks. Its protection blocks rival eating in both directions, and its ring marks the protection. The phone's SPLIT reason shows "Spawn shield" when a piece has reached 48 mass and protection is the blocking condition; below that growth threshold it instead shows "Grow one blob to 48 mass".
- Respawns sample eight seeded candidate locations and choose the one with the most clearance from existing cells. Protection covers a crowded arena when no fully clear spot exists.
- Pause first settles play at the pause instant, then clears every seat's steering vector. Resume moves the round's absolute start/end clocks forward; relative split, merge, shield, and respawn times remain frozen during the pause. Ordinary movement resumes only after fresh steering input. Releases and newer neutral input retain their event-time barrier, so older delayed controls cannot restart motion.
- A disconnected seat stops steering and its cells remain in the arena. The match does not wait; every connection event restores its current mass and position with neutral steering until fresh input, including refresh during disconnect grace without an earlier drop. Split velocity and cooldown survive the release. A permanently departed seat loses its current pieces and pending respawn, keeps banked points (including a horn already reached), never resumes control after connection churn and never enters later rounds.
- Nothing in the arena is secret. TV and phone-only views expose the same public world. A phone with a TV receives its own status and public mass/score summaries, without the arena payload. RNG and server input histories are not views.
- The final horn settles only to 90 seconds, even when a timer event arrives late. Score screens ignore ordinary game inputs, and terminal state cannot reopen play.

## Settings

None. Three rounds of 90 seconds are fixed by P05. The room's standard pause, skip, mute, reduced-motion, and bot-strength controls remain available.

## Content

No packs or external content. `content/schema.ts` exports an empty pack list; the seed creates original snack locations. English only. Arena art is code-drawn using PartyBox colours, spacing and motion tokens. During live unpaused play, bodies, inside names and radii interpolate received poses over the classic original's 120 ms smoothstep. Frozen phases, pause, app motion-off and OS reduced motion use immediate poses. The personal camera's settled target uses the archived original's mean owned-cell center and `min(64 / sum original radii, 1)^0.25 × max(height / 965, width / 1920)`; `10 / 0.55` converts world units. CSS camera transitions approximate its frame-recursive smoothing without per-frame JavaScript. This presentation never predicts collisions or changes server physics. Audio uses existing PartyBox synthesized cues, with no sound per snack and no imported original audio.

## Sources

[Miniclip's official controls guide](https://support.miniclip.com/hc/en-us/articles/4404685562641-How-to-start-playing-Agar-io), [Android Authority's hands-on review](https://www.androidauthority.com/hands-on-with-agar-io-631445/) and [Pocket Gamer's played review](https://www.pocketgamer.com/agar-io/review/) corroborate growth, larger cells moving more slowly, the mobile joystick and the separate split button. [Phandroid's first-hand review](https://phandroid.com/2015/07/15/agar-io-for-android-review/) corroborates the half-mass directional launch and its risk. Delayed reunion is cross-checked against the [historical first-hand mechanics notebook](https://windfis.ch/git/agario-bot/plain/reversing_game_mechanics/game_mechanics.txt?h=pathfinding) and [GIGAZINE's played report](https://gigazine.net/gsc_news/en/20150828-agar-io-review).

The r1-local upgrade read the [publisher's mobile screenshots](https://play.google.com/store/apps/details?id=com.miniclip.agar.io) and the [archived May 1, 2015 original client](https://github.com/Tombez/official-agar.io-client-by-matheus-valadares/blob/4e25418ae81043f391557422a5ee19f3f0c2e588/2015-05-01/main_out.js). A single owned Chrome reached a CloudFront403 page, so no fresh live original play or listening is claimed. Reference renderer screenshots use authored matched packet fixtures through that pinned original client, outside shipped runtime code; they establish rendering, not original-server physics or the opaque current2026 camera. Fidelity evidence and remaining limitations are in [fidelity/GAPS.md](fidelity/GAPS.md).

Historical speed and merge reports conflict, so exact original constants are not claimed. The full two-source fact matrix, access attempts, audio limits, and tuning rationale are in [RESEARCH.md](../../jobs/P05-blob-arena/RESEARCH.md); attribution/provenance is in [SOURCES.md](../../jobs/P05-blob-arena/SOURCES.md), with explicit deviations in [ASSUMPTIONS.md](../../jobs/P05-blob-arena/ASSUMPTIONS.md). No source code or assets were copied.
