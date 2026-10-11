# Curve Fever

A PartyBox take on the browser classic Curve Fever (Achtung, die Kurve!), rebuilt from what REA (the reverse-engineering MCP) showed of the live game at curvefever.pro (T-1044, `reports/rea/T-1044/REPORT.md`). Everyone steers a worm that never stops across one shared arena, leaving a trail; the TV shows the whole arena and each phone is two big buttons. In a room with no TV the phone is the stage too (below). It is filed under the picker's Arcade category (`category: "arcade"`, owner 10-10: the REA web ports are their own thing, not Jamboree apps), so it is on the main list and the Arcade tab; it has no `minigame` block and is not a Party World minigame.

## Overview

2-8 worms start apart on a shuffled ring, heading along its tangent in the same seeded direction. They move at 12 units a second across a 160 × 100 arena; holding a side turns the worm (2 radians a second, a circle about 12 units wide). The first second protects heads from trails and other heads, giving players time to start steering; walls always kill. A worm leaves a trail, except for a short gap (about a quarter of a second) every two to four seconds, which others can slip through. After the start grace, a worm that touches any trail, its own included, is out for the round. Heads that meet both die. A round ends when one worm is left, or after 45 s. Each round a player scores one point for every worm that died before them; after the last round the most points wins. Interaction type: hold.

## Players

2-8. Bots: welcome (`supportsBots`): a bot checks every decision, looks 1.8 s ahead for each way of steering, avoids walls, trails and approaching heads, and favours clear straight routes over circling into its own trail. It keeps responding while alive, even when continuing straight. Arena colours go by the worm's slot, red, blue, green, yellow, purple, teal, orange, pink: the same on the TV and on the phone.

## Phases

| Phase   | TV                                                                                           | Phone (with a TV)                                         | Exit                                               |
| ------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `ready` | the new round's worms at their start spots with an arrow and a name, a 3-2-1, "Round n of m" | your colour, "find your worm", a countdown                | 3 s, or VIP skip → `play`                          |
| `play`  | the arena, every trail and head, the round clock in a pill, players with points              | two halves to hold: left and right (or ← →, A/D, bumpers) | one worm left, 45 s, or VIP skip → `score`         |
| `score` | the frozen arena, "Round n over", `+points` and totals, best first                           | "+n this round", your total                               | 4.5 s, or VIP skip → `ready` (round n+1) or `done` |
| `done`  | "{name} wins!" (or a tie), the standings                                                     | "You won the match!", or your place and points            | terminal: `results()` is non-null                  |

### Phone only (no TV)

When the room has no TV (`ctx.presence.phoneOnly`) or a player cannot see it (`canSeeTv: false`), the phone is the stage and never points at a TV. The controller view then carries the same `worms` as the TV view (public), and `usePhoneOnly()` makes the phone draw the arena (`Arena`, full width, 16:10) itself:

| Phase   | Phone, phone only                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ready` | "Round n of m", the arena with every worm's arrow, name and the 3-2-1, the roster (your row marked)                                                    |
| `play`  | "n of m still crawling", the live arena, the hold-left / hold-right buttons below it; once out: the arena and the roster with crashed worms struck out |
| `score` | "Round n over", "+n this round · m points so far", the frozen arena, the standings best first                                                          |
| `done`  | "{name} wins!" (or a tie), your place and points, the final arena and standings                                                                        |

Ready, score and done use a smaller 256 × 160 arena and compact standings so all eight players fit on a 390 × 844 phone. Play keeps the full-width arena and large steering pads. The TV fills the stage with a 16:10 arena beside a narrow standings rail, and uses its own roster and clock instead of a duplicate shell roster.

A spectator sees the same without the buttons. A phone with a TV in front of it is sent no arena (its updates stay small).

The deadline in `play` re-arms every 200 ms (`nextStep`, ADR-033), so the round ends with nobody touching anything. The view's `deadline` is the round's end (`endsAt`) while `play` runs; the TV draws the countdown and the clock itself (`timerMode: 'quiet'`) and ticks once a second while the worms wait and in the last five seconds.

## Inputs

`{ type: 'steer', dir: -1 | 0 | 1 }` during `play`: left, straight, right. The worm carries on from where it is at the input's time, turning the new way. A change to the way it already goes, a dead worm's, a stranger's and anything after the worm's 400th change are ignored.

## Scoring

Per round: one point for each opponent who died before you. Worms that die on the same 40 ms sample tie; worms alive at the end tie and beat every dead one. Match score = the sum. The most wins; equal scores share the rank.

## Edge cases

- The round is a pure function of time: between inputs a worm moves in a closed form (a line, or a circle arc), so `world.tick` can judge any time later and the screens draw every worm between updates. Collisions are judged on a 40 ms grid of samples (a head within 1.2 units of a trail sample, or a wall, dies): the same seed and inputs give a byte-identical state. A worm cannot hit the last 14 samples (0.56 s) of its own trail.
- Gaps are drawn from `state.rng` when the round is made (`world.gaps`, in ms), so the trail the TV draws and the one the server judges agree.
- A pause moves `began` and `endsAt` on by its length; every time in `world` counts from `began`.
- Nothing is hidden. The TV view carries every steering history (`worms`); a phone view carries only its own slot, whether it lives, its turn and the counts, which keeps a phone's updates small. The exception is a phone that is the stage (phone only, above): it is sent `worms` too.
- A disconnected player's worm keeps going the way it was steering and usually dies; the round does not wait.
- A single survivor ends the round at once; if several are alive at 45 s the round is called and they tie.

## Settings

| Key      | Type   | Default | Range |
| -------- | ------ | ------- | ----- |
| `rounds` | number | 3       | 1-6   |

## Content

None. `content/schema.ts` exports an empty `packs`; every arena comes from the seed. English only (Arcade games are, like Jamboree's, owner 10-09/10-10).

## Sources

What the REA inspection of the original taught us (rules and feel; the code and art are ours):

- Game and its client bundle: https://curvefever.pro/ (round structure, gaps, scoring order, power-ups: not ported).
- Original game idea: "Achtung, die Kurve!" (1995), the reference for the rules.
- No audio or image from the site is used; the worms are drawn on a canvas, the sounds are the shell's `countdown` and `reveal`.
