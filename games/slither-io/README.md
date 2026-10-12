# Slither.io

## Overview

The PartyBox Slither.io port uses original implementation and art. Everyone moves continuously on the same 160 × 100 map. Eat sparks, spend size to sprint past rivals, and make them hit your body. A crashed snake becomes food and returns after two seconds. Three 90-second rounds; size at each round end becomes match points. The official name follows the owner's naming table; no original assets or code are used.

## Players

2–8, local or remote; bots supported at easy, normal and sharp strengths. Each snake has a consistent number and player-token colour. The shell teaches the three rules and counts down before init: this game starts immediately in play. Bots seek food while avoiding walls and bodies; sharp bots look farther and sprint toward valuable corpse food on clear routes.

## Phases

| Phase | TV                                                           | Phone with TV                                          | Exit                                |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------- |
| play  | Full arena, numbered heads, current sizes, 96px+ round clock | Direction pad, hold BOOST, your size and return status | 90 seconds; VIP skip ends the round |
| score | Banked round points and match standings with frozen arena    | Your round gain and totals                             | 7 seconds; VIP skip                 |
| done  | Winner or tie and final standings                            | Your place and points                                  | Terminal                            |

### Phone only

| Phase | Player phone                                                                       | Spectator phone                                  |
| ----- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| play  | Public arena, eight numbered sizes, round clock and steering/boost below the stage | Public arena, eight sizes and clock; no controls |
| score | Frozen arena, your banked gain and all eight match standings                       | Same public arena and standings                  |
| done  | Winner or tie, final arena, all standings and your shared rank                     | Same public result without a personal rank       |

Remote players who cannot see the TV receive this same stage. Spectators receive the stage in every room. No phone-only text directs a player to a TV.

## Inputs

`{ type: 'steer', angle: number, boost: boolean }`: angle in radians from −π to π, right = 0, down = π/2. Both control values travel together. Drag the pad to choose an absolute heading, release to continue that heading; hold BOOST to sprint. Pointer cancellation, lost capture, blur and pause release boost. Arrow/WASD keys steer; Space boosts. Inputs from strangers, disconnected seats, the wrong phase and earlier judged times do nothing.

## Scoring

At the end of each round, floor each snake's current mass and add it once to its match total. Start/respawn mass is 14; a crash resets it to 8 until return. Equal totals share rank. A cutoff earns food rather than bonus points. Boost therefore trades prospective points for position. VIP End banks the currently played round and ends the match.

## Edge cases

- The server judges 100ms fixed steps; headings apply at the next judged step. Timer wake is 100ms, rearmed without restarting the round countdown; inputs also settle movement. Late timers catch up only to the 90-second cap. Swept head/body and relative head/head checks prevent tunnelling.
- Heads touching another snake's body die regardless of size. Self-crossing is safe. Simultaneous head collisions kill both. Walls are always lethal. Deaths resolve together before corpse food is made.
- A fresh snake has one second of collision protection from rivals (walls still kill); protected bodies cannot kill rivals. Bodies use fixed 1.6-unit spacing, at most 90 samples; sprinting never stretches the collision body. Food is capped at 240 pieces, with equal capacity and conserved mass for simultaneous corpses.
- Normal speed is 16 units/s, sprint 28 units/s. Boost spends 0.3 mass per 100ms step and stops at mass 8. Mass caps at 90. Turning is bounded to 3.5rad/s. Bots reconsider at most once per simulated second. These are original balance constants.
- The nearest head gets a food piece; exactly tied heads split its value. Corpse food represents the crashed mass. Spent boost mass becomes small tail sparks. Ordinary food is seeded and replenished when fewer than 70 pieces remain.
- Disconnect clears boost, leaves the current heading moving and never holds a timer. Presence changes settle the preceding movement before changing connectivity. Disconnected seats start subsequent rounds offstage; a crashed seat stays out until it reconnects. Returning snakes search 31 deterministic ring/interior spots for clear bodies, choosing the clearest fallback if every candidate is occupied. Refresh restores the latest world, heading, size and score.
- Pause settles movement once, clears boost and shifts start/end clocks on resume. Timers and inputs cannot move a paused world; repeated pause is idempotent. Scores and results retain every starting player.

## Settings

| Key    | Type   | Default | Range |
| ------ | ------ | ------- | ----- |
| rounds | number | 3       | 1–3   |

## Content

Procedural seeded arena, no question/word packs. `content/schema.ts` exports empty packs. All English; original inline SVG and token CSS. No runtime network calls. Shell cues mark score/results, an optional synthesized pulse accompanies play.

## Sources

Research precedes implementation. Independent original-game studies confirm pellet growth, size-spending boost, head/body crashes and edible remains: [Stanford live-game study](https://cs229.stanford.edu/proj2019aut/data/assignment_308832_raw/26588099.pdf), [NTU original-mechanics study](https://people.csail.mit.edu/weifang/files/reports/icg-report.pdf), and [original developer description](https://apps.apple.com/us/app/slither-io/id1091944550). The [official browser page/client](https://slither.io/) was inspected read-only. Full source limits, access details, timing observations and source mapping are in `jobs/P06-snake-royale/RESEARCH.md` and `SOURCES.md`.

Ninety-second rounds, two-second return, mutual head collisions, wall behavior and numerical tuning are PartyBox choices. Exact original server boost cost and head-head arbitration were not established; no claim of exact numerical fidelity or live play is made.
