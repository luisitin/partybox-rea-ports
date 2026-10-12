# P23 Bonk.io research

Research checked 2026-10-12 UTC. Official name/id: **Bonk.io / bonk-io**, following the owner naming table in JOBS.md. This is an original PartyBox implementation of the mechanics, with authored physics and art.

## Access and method

The official landing page and public HTML/client resources were retrieved read-only. The parent runner's computer-use inventory returned no apps or browsers; selecting bonk.io returned `No browser is available`. No original live match was played, no audio was heard, and no video timings were measured. This is the written-source/public-client fallback permitted by RULES.md, with that limitation recorded instead of implying a playtest.

The public client HTML references GameResources.js and js/alpha2s.js. Both returned HTTP 200; their text was inspected in memory for UI labels, resource declaration names and a few call-site identifiers. The main bundle is obfuscated: its constants, input-to-force mapping and timer logic were not decoded or executed. No client code or embedded media was copied into this repository.

## Supported mechanics and source pairs

| Finding                                                                              | Evidence                                                                                                                                                                 | Confidence / implementation consequence                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physics balls push rivals off; last survivor wins; up to eight players               | [Official introduction](https://bonk.io/) plus [independent game guide](https://iogames.onl/bonkio)                                                                      | Strong qualitative agreement; use a shared survival arena.                                                                                                                                          |
| Arrow movement; held X trades maneuverability for stronger collisions and resistance | [Official controls](https://bonk.io/) plus [community gameplay documentation](https://bonkio.fandom.com/wiki/Gameplay_Elements)                                          | Strong qualitative agreement. Preserve mobile approach versus heavy impact/defense.                                                                                                                 |
| Left/right movement and Up jumping exist                                             | [Independent controls guide](https://iogames.onl/bonkio) plus [Classic mode history](https://bonkio.fandom.com/wiki/Classic_%28Mode%29)                                  | Two separately published sources; the wiki describes surface-contact jumping. Original jump height, impulse and hold behavior remain unmeasured. JOBS.md explicitly requires phone left/right/jump. |
| Gravity, horizontal acceleration and a fall below a platform matter                  | [Official physics description](https://bonk.io/) plus [Ohio State's authored teaching lab](https://www.asc.ohio-state.edu/orban.14/stemcoding/milestones/bonk/bonk.html) | Independent pedagogical corroboration of the broad motion model, not validation of the original constants.                                                                                          |
| Matches have configurable rounds-to-win and a start countdown                        | [Current official client HTML](https://bonk.io/gameframe-release.html) plus [community changelog](https://bonkio.fandom.com/wiki/Changelog)                              | Settings/countdown existence corroborated. The HTML includes a displayed 3; elapsed countdown and reveal durations were not measured.                                                               |
| Collision, death, offscreen and score feedback have distinct sound resources         | [Official resource declarations](https://bonk.io/GameResources.js) plus [community resource inventory](https://bonkio.fandom.com/wiki/Assets)                            | Resource categories corroborated; no listening, volume, playback frequency or precise mix established.                                                                                              |

The landing page, HTML and bundles are one publisher, not three independent sources. Community wiki pages likewise count as one editorial source family. The independent guide and university lab are separately published; the guide's authorship and possible borrowing cannot be proved, so numeric physics claims do not rely on it. SOURCES.md records the boundaries.

## Round flow, scoring and feel

The official HTML exposes guest entry, quick play/custom rooms, Classic mode, playing/spectating, ready/start, map selection, rounds-to-win and a round-start overlay. Its spectator notice indicates entry on a subsequent round. These labels establish available flow, not that every mode follows an identical sequence. [Official client](https://bonk.io/gameframe-release.html)

The central enjoyable decision is commitment: retain mobility to position or dodge, then use weight for a collision or defensive stand. A charged approach and a well-timed heavy impact should feel different from holding heavy continuously. [Official description](https://bonk.io/) [Community gameplay documentation](https://bonkio.fandom.com/wiki/Gameplay_Elements)

The Classic wiki describes heavy strength fading with excessive use and recovering when used less. It also reports a 50% mass increase, but those details belong to one community source family; this audit did not verify the exact current coefficient or recharge function. Any implementation values are authored adaptation choices. [Classic mode](https://bonkio.fandom.com/wiki/Classic_%28Mode%29)

Last-standing round wins are supported. Original draw handling, elimination order, match tie resolution, XP and finite match-length rules were not established; PartyBox scoring must specify them directly.

## Audio observation boundaries

Official declaration names include ball-ball collision, platform bounce, three death variants, offscreen, score animation, button interactions and beeps. Their presence does not prove when or how often they play. The wiki independently lists corresponding categories. Preserve readable collision/elimination/reveal beats using original SDK cues; do not reproduce the recordings. [Official resource declarations](https://bonk.io/GameResources.js) [Community inventory](https://bonkio.fandom.com/wiki/Assets)

Menu music style is a community report only: the soundtrack page describes bright, bouncy licensed music and distinguishes historical versions. No music was heard and none will be copied. [Community soundtrack notes](https://bonkio.fandom.com/wiki/Soundtrack)

## PartyBox adaptation decisions

The TV is a single arena with stable numbered ball identities, legible survivor count and a visible round outcome. Phones provide held left/right, Jump and Heavy with immediate pressed feedback. A phone-only player sees the same public arena above controls; spectators and eliminated players see the live arena without active inputs. Do not point phone-only rooms at a TV.

Physics coefficients, fixed timestep, contact solver, grounded jump rules, heavy depletion/recharge if used, arena layouts, spawn rotation, finite round cap, sudden-death behavior, ties and inter-round timings are authored. The README and tests must state the implemented values; none are measurements of Bonk.io. Inputs must release on cancellation, lost capture, blur, pause, phase changes and temporary disconnect. Original art uses SVG/CSS and stable numbers, with no borrowed skins, maps or logos.

## PartyBox overlap check

Read-only inspection of the owner's authoritative `C:/dev/partybox` checkout found 110 game manifests and 110 generated server-registry entries. Neither names/ids nor the registry contain Bonk. A semantic scan of all descriptions/rules found no ball-versus-ball heavy-mode platform survival game. Nearby candidates were checked: Burning Bridges is fixed-lane fireball survival; All the Marbles is a two-lane Run/Punch race; Goombalancing Act tilts individual stacks. None implements Bonk.io's shared momentum-and-weight combat loop. Build a new `games/bonk-io` game; do not upgrade these different games. No owner checkout was edited.
