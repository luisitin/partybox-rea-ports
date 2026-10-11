# Dino Dash

## Overview

Everyone races the same seeded obstacle run in a separate lane. Original comet
creatures run automatically: tap to jump over a rock, hold to duck under a low bird.
Duck is the easiest bird dodge; a safely timed jump can also clear a bird.
Crash and your distance freezes; the farthest runner wins the round. Three rounds
make a match, with the highest cumulative distance winning. Interaction type: tap
and hold. This is an Arcade game with no Party World minigame variant.

The speed starts at 360 units/s, increases by 3.6 units/s² and caps at 780 units/s.
A round lasts at most 60 seconds, reaching 576 units/s if survived. Each round has
a new course, shared by every lane. The first obstacle reaches runners at 3s;
subsequent obstacles arrive 1.45–2.10s apart. Birds become eligible after 12s with a
one-in-three draw and never appear consecutively. The opening countdown is the shell's.

## Players

2–8 players. Bots support easy, normal and sharp strengths: they read approaching
obstacles and choose jump/duck timing using the judged course, with strength-dependent
reaction and error. Each lane has a name, distinct marker and crash label as well as
colour. Spectators receive the public stage without input controls.

## Phases

| Phase | TV | Phone with a TV | Exit |
| --- | --- | --- | --- |
| `play` | All lanes, approaching obstacles, distance, surviving count and round clock | Your lane and distance; JUMP and HOLD DUCK; crashed players watch the race | All runners crash, 60s cap, or VIP skip → `score` |
| `score` | Frozen race, round distances and cumulative standings | Your round metres and match total | 4.5s, or VIP skip → next `play` or `done` |
| `done` | Winner or shared winners and final standings | Your rank and match distance | Terminal; `results()` is available |

### Phone only

A phone-only room (`ctx.presence.phoneOnly`) and a player unable to see a TV
(`canSeeTv: false`) receive the public race on the phone. These screens never ask
anyone to look at a TV. `usePhoneOnly` and the SDK provider mirror the reference port.

| Phase | Phone-only stage |
| --- | --- |
| `play` | Your readable lane above the controls, survival status and other runners' progress; after a crash, the continuing public race |
| `score` | Frozen race and compact round/cumulative standings |
| `done` | Winner, your rank and compact final standings |

Play fits a 390×844 phone without scrolling. A spectator sees the public stage and
standings without JUMP or HOLD DUCK. A 1920×1080 TV uses the race as its focal point.

## Inputs

- `{ type: 'jump' }`: jump if alive and grounded. One tap supplies a fixed 630 units/s
  impulse with 1800 units/s² gravity: about 0.70s airborne and 110 units high.
- `{ type: 'duck', down: true | false }`: hold crouch or release it. Pointer cancel
  and keyboard release stop a hold. Jump cannot stack impulses or grant flying.
- Inputs from spectators, unknown players, dead runners or non-play phases are
  ignored. Stale inputs and timers cannot rewind the course or revive a runner.

## Scoring

Round metres = `floor(distance / 10)` at the runner's collision or the round cap.
The greatest distance wins that round. Match score is the sum of round metres;
equal scores share a rank. Living runners at the 60s cap tie on distance. A sole
survivor continues to earn distance until crashing or reaching the cap.

## Edge cases

- Server physics, obstacle generation and collisions are pure and seeded. Time comes
  only from `event.now`; inputs and 100ms re-armed deadlines settle the run on a 20ms grid.
- Every lane shares the course. Small collision steps prevent an obstacle passing
  through a runner during a long gap between network events.
- Pause freezes the run; resume shifts its clocks. Jump and duck presses while paused
  do not act; releasing duck is accepted so a paused hold cannot remain stuck.
- A disconnect releases duck while the runner keeps moving; the phase never waits
  for it. Reconnect resumes the authoritative pose and score; permanent leavers remain
  in results. Hold release handling prevents a lost phone from locking crouch forever.
- Nothing in the current race is secret. Views expose visible obstacles and public runners,
  with the player-specific status and controls kept on their own phone.
- Death is marked by a changed pose and OUT label. Reduced motion removes optional
  decoration; the judged runner state and readable control labels remain.
- VIP skip scores the run where it stands; VIP end produces finite results for all
  original players. Duplicate deadlines cannot credit a round twice.

## Settings

| Key | Type | Default | Range |
| --- | --- | --- | --- |
| `rounds` | number | 3 | 1–5 |

## Content

No content packs; `content/schema.ts` exports empty `packs`. Courses are generated
from the seed. English only. Comet creatures, rocks and birds are original inline
drawings, with colours, sizes and optional motion from PartyBox tokens.

## Sources

The original was studied for mechanics and feel; this port uses original art and
code. [Chromium's runner](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/offline.ts)
and [jump model](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/trex.ts)
establish the gradual ramp and jump/duck distinction.
[The creators' interview](https://blog.google/products-and-platforms/products/chrome/chrome-dino/)
and [independent play analysis](https://levashan1.github.io/WSOA4175A_1711097/assets/Runner.pdf)
corroborate the simple action set and pacing; an
[independent learning experiment](https://arxiv.org/pdf/2008.06799) corroborates the
automatic run, distance score and death loop. Detailed constants, source differences
and adaptations: [RESEARCH.md](../../jobs/P13-dino-dash/RESEARCH.md) and
[SOURCES.md](../../jobs/P13-dino-dash/SOURCES.md). No source assets or sounds are reused.
