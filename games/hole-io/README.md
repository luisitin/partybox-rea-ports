# Hole.io

## Overview

Steer a growing hole through an authored projected 3D city, swallow objects that fit, and threaten smaller rivals. One shared 90-second round serves 2–8 phones. Every active phone has its own close camera; the TV shows close local views of the live holes. Models, projection and art are independently authored with React/SDK and PartyBox tokens.

This upgrades the existing Hole.io card imported as T-1141. The shell handles joining, READY and the opening countdown; the module begins directly in play. No owner-core deployment or duplicate picker card is part of this public upgrade.

## Players and party rules

- A swallowed player is permanently out of active play, keeps banked points and watches a live leader without movement or retry controls. Leaving is also permanent; refreshing/reconnecting does not resurrect a swallowed or departed seat. Spectators watch the same live city.
- Active trailing players can grow along remaining/recycled small-object routes, unlock cars/buildings and swallow vulnerable rivals to catch a banked lead. No rubber-band points are granted. When a lead is mathematically unreachable in the remaining time, remaining collection/predation still changes other places; the finite shared clock limits that situation. Eliminated players follow the live leaders.
- Everyone shares the same clock and phase transitions. Play ends at 90 seconds or a VIP skip/end; one surviving hole or no holes remaining does not create an individual retry or separate race.
- Highest accumulated points wins, including points banked before elimination or departure. Equal totals share the same competition rank and every rank-1 player is a joint winner. Survival alone does not determine victory: this is a timed-score party game with Battle-style elimination, not a claim to native last-survivor Battle scoring.

Easy bots choose among useful nearby props; normal bots seek reward per travel distance and flee; sharp bots also hunt vulnerable rivals. Three strengths act from game information, with seeded decisions.

## Phases

| Phase | TV | Phone, beside TV or phone-only | Exit |
| --- | --- | --- | --- |
| play | Shared 90-second clock; close cameras for live holes, names, points, size/growth | Active: own close city, score/size/growth, edible class and thumb joystick. Swallowed/left/spectator: live leader camera without controls | Shared 90 seconds or VIP skip/end |
| reveal | Named final standings and clearly marked winner/tied winners | Complete standings, own banked score/place for former participants | 7 seconds or VIP skip/end |
| done | Final named ranking and winner/tied winners | Final results and own place/score | Terminal; results available |

Phone-only and remote players receive the same complete local stage rather than instructions pointing at a TV. Every participating phone gets the city even beside the TV. A temporarily disconnected live seat retains its view but its joystick is disabled; reconnect resumes it only if still alive and not permanently left. Spectators and eliminated seats never receive a retry control.

## Inputs

Move payload: { type: 'move', x, y }, each axis finite and within -1..1. Drag the thumb pad or hold arrow keys. Release, pointer cancellation/capture loss, blur and hidden-document transitions send zero; diagonals normalize.

Unknown/spectator/disconnected/eliminated/departed identities cannot steer. Earlier packets are ignored. Reopening a controller stops its previous direction; the server stops steering on connectivity changes and pause. Input payloads pass inputSchema before reducer dispatch.

## Growth and scoring

| Size | Cumulative growth points | Rim radius |
| --- | --- | --- |
| 1 | 0 | 2.2 |
| 2 | 10 | 3.3 |
| 3 | 27 | 4.8 |
| 4 | 51 | 6.2 |
| 5 | 82 | 7.8 |
| 6 | 120 | 9.2 |
| 7 | 165 | 10.8 |
| 8 | 217 | 12.4 |
| 9 | 246 | 14 |

The cumulative table reconstructs one historical firsthand source; only the first ten-point increase has independent exact corroboration. Radii and speed are port tuning, not measured current-native constants. Speed is max(11, 19 - 0.7 × (size - 1)) city units/second.

| Object | Footprint radius | Points | District supply |
| --- | --- | --- | --- |
| Bin | 1 | 1 | 16 |
| Tree | 1.7 | 2 | 14 |
| Bench | 2.6 | 3 | 13 |
| Car | 4.2 | 3 | 18 |
| Narrow house | 7 | 4 | 10 |
| Tower | 10 | 30 | 3 |

Bins/trees fit initially, benches at size 2, cars at size 3, narrow houses at size 5 and towers at size 7. Each of eight districts has 74 objects, with seeded positions and equal budgets. Available pre-house credit is 137 points; pre-tower credit is 177, exceeding the required 82/165 gates before any recycling or rival gains.

An object's footprint must be smaller than the rim, with center distance at most rim radius - 0.5 × footprint radius. A rival needs a rim at least 1.25 times the prey's and distance at most big radius - 0.35 × small radius. The hunter earns 10 + floor(prey's growth / 2); the prey permanently stops acting and keeps its banked score/growth.

Historical ordinary-car three-point and narrow one-column building four-point rewards have two firsthand sources. Other rewards, supply, containment, predation margin and radii are original reconstruction/tuning. A wide/tall building is not assumed to have the narrow-house reward.

## Edge cases and public views

- Initial two-second protection prevents predation in either direction; protected holes can collect city props. There is no respawn or post-death immunity loop.
- Bins/trees/benches recycle after 20 seconds; cars/buildings are finite. Closest center wins a contested object; exact ties rotate among actual alive contenders rather than all roster seats.
- Predation resolves largest first; a hole swallowed during a step cannot also eat. Eliminated/departed seats cannot collect, move or revive after later timers/reconnects.
- Fixed 100 ms physics and 200 ms engine deadlines use event.now. Late timers clip simulation to the 90-second round. Pause settles prior play, stops steering, freezes relative physics and shifts shared clocks on resume. VIP skip/end settles only unpaused elapsed play.
- Departures remain in final results with banked points. Temporary disconnect stops movement without resetting progress; its live hole remains vulnerable after initial protection. No disconnected player blocks a phase.
- Views expose current holes, names, scores, size/progress, connectivity/departure and elimination state. Current visible props and up to 96 recent consumed-prop records support authored sinking; private RNG, spatial cells and steering/timestamps are omitted.
- The authored sink/tilt/ground-clipping beat lasts 700 ms. That duration is an inferred visual reconstruction, not measured native timing. Reduced motion is honored; state/identity never relies only on color.

## Settings and content

No game settings. One 90-second round, English only, Arcade category. content/schema.ts exports an empty packs list; the city is generated from eight equal-resource districts. No runtime networking/file reads or new dependencies. The renderer uses independently authored geometry; original screenshots are documentation-only.

## Sources and limits

[Official Voodoo](https://voodoo.io/games/hole-io) and [independent 2018 play](https://tech.blog.aerie.jp/entry/2018/06/21/091300) establish progressively larger city consumption. [Official PC screenshots](https://store.steampowered.com/app/2751230/Hole_io/) supply close oblique models/local split geometry; they are a separate edition released in 2024. Current mobile promotional images are marketing compositions.

[Mirrored developer 1.2.0 notes](https://www.apkmirror.com/apk/voodoo/hole-io/hole-io-1-2-0-release/) and an [independent firsthand Battle report](https://note.com/hcg_laboratory/n/n71d63a619215) distinguish permanent Battle loss from Classic resurrection. [Historical size notes](https://www.kith.org/jed/2018/06/23/some-hole-io-strategy-tips/) inform growth reconstruction; higher exact thresholds remain uncorroborated.

No native live session, camera/zoom formula, full original flow or audio timing was measured. [Fidelity references](fidelity/REFERENCES.md) preserve complete official files and ranked pending comparisons. jobs/P08-hole-swallow/{RESEARCH,SOURCES,ASSUMPTIONS,UPGRADE}.md records provenance and allowed party adaptations. Current captures/tests/CI are recorded by root in VERIFY.md; this spec alone does not certify near-identity.
