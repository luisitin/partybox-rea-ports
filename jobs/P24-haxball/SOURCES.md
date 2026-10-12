# P24 — Haxball sources and asset provenance

Accessed 2026-10-12 UTC. Original branding is styled HaxBall on the source site;
the owner requires the manifest name **Haxball** and id **haxball**. References
support the original's mechanics, not permission to reuse its code or assets.

## Primary vendor sources

| ID  | Source                                                                                                                                                                                                                       | Used for / limitations                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S01 | [Official HaxBall homepage](https://www.haxball.com/)                                                                                                                                                                        | First-party definition of a physics-based multiplayer soccer game where teamwork matters.                                                                                                                                                        |
| S02 | [Official December 2010 input update](https://blog.haxball.com/2010/12/21/fix.html)                                                                                                                                          | WASD and alternate kick mappings. Historical; checked against current public client rather than treated as an immutable saved profile.                                                                                                           |
| S03 | [Official stadium file documentation](<https://github.com/haxball/haxball-issues/wiki/Stadium-(.hbs)-File>)                                                                                                                  | Moving circular bodies; damping/bounce; normal and kicking acceleration; goal ownership and crossing; spawn/reset and configurable stadium structure. Examples and map data were not copied.                                                     |
| S04 | [Official Headless Host documentation](https://github.com/haxball/haxball-issues/wiki/Headless-Host)                                                                                                                         | Time/score limits, team roles/locks, player/ball discs, 60 Hz game ticks, pause clock semantics, kick-rate limits and reset events. API documentation, not a report that a room was hosted.                                                      |
| S05 | [Official collision flags documentation](https://github.com/haxball/haxball-issues/wiki/Collision-Flags)                                                                                                                     | Player/ball/wall collision categories, kickable/scoring discs and kickoff barriers. No need for the port to expose this map format.                                                                                                              |
| S06 | [Official play page](https://www.haxball.com/play), [current iframe](https://www.haxball.com/H4mQWPXF/__cache_static__/g/game.html), [public client bundle](https://www.haxball.com/H4mQWPXF/__cache_static__/g/game-min.js) | Transient original-client inspection only: key bindings, kick arming/radial impulse, diagonal normalization, constructor defaults, logic/reset beats and cue callback names. Dynamic cache path may change. No code, assets or bundle committed. |

S06 inspection returned HTTP 200 for all three URLs through PowerShell
`Invoke-WebRequest -UseBasicParsing`. HTML lengths: play 1,523 decoded characters;
iframe 1,351; client 173,175. SHA-256 of the inspected **decoded bundle encoded as
UTF-8**, not a retained download:
`483be9714e637d7766ad254b86b1e0114ef2f33a4afb83f4de9fda1213b131fb`.
The bundle was read in memory and discarded. No audio, images, fonts, map file or
tracker script was fetched or executed.

## Independent firsthand reports and implementations

| ID  | Source / author                                                                                                                                    | Used for / limitations                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S07 | [Player input report, issue 195](https://github.com/haxball/haxball-issues/issues/195), tenjiku2000, 2017; developer response by basro             | Firsthand diagonal movement plus kick observation. The reported failure was keyboard rollover; do not reproduce it on touch controls. Independent reporter, although hosted in the vendor's issue repository.                                                          |
| S08 | [Default physics report, issue 480](https://github.com/haxball/haxball-issues/issues/480), Wazarr94 and Leo-MapCreator, 2018                       | A player sought measured defaults and an independent map author supplied constants. Compared with current vendor constructors; this community comment alone was not treated as vendor authority.                                                                       |
| S09 | [Replay/kick report, issue 1975](https://github.com/haxball/haxball-issues/issues/1975), punisherhaxball, 2023; developer response by basro        | Player's inspected replay and audible duplicate kick events; developer explanation of default kick limits. No replay or media copied.                                                                                                                                  |
| S10 | [Prediction report, issue 1942](https://github.com/haxball/haxball-issues/issues/1942), punisherhaxball, 2023; developer response by basro         | Player-observed false displayed kick and the developer's explanation of prediction. Inference for port: confirm cues from authoritative server events.                                                                                                                 |
| S11 | [Haxball Solo README](https://github.com/mrassell/haxball-solo/blob/main/README.md), mrassell                                                      | Creator's firsthand recreation rationale; nearby radial kick, arrows/WASD plus Space, circle collisions, impulse response, fixed timestep, passing/support, 1v1–3v3. Its own 35-pixel kick radius and tuning are not original defaults. No implementation code copied. |
| S12 | [gball README](https://github.com/davidgomes/gball), davidgomes                                                                                    | Independent Haxball-inspired circular soccer implementation; movement/kick, opposing goals, friction/collision and team roles. Its expanded field, humans-vs-AI format and three-minute/three-goal limit are its adaptations, not Haxball facts.                       |
| S13 | [Ursinaxball README](https://github.com/HaxballGym/Ursinaxball), HaxballGym/Wazarr94                                                               | Firsthand Python recreation describing red/blue teams, physics, customizable maps and bot complexity. Broad corroboration only; code/assets not imported.                                                                                                              |
| S14 | [GameBlast's HaxBall review](https://www.gameblast.com.br/2014/06/haxball.html), Gabriel Toschi, 2014                                              | Independent published play review: circles, arrows/X, red/blue teams, configurable durations/score targets/team sizes, lag and minimal controls. Historical Flash-era report; no current compatibility or exact room cap inferred.                                     |
| S15 | [Cubers player discussion](https://forum.cubers.net/thread-1900.html), multiple players, 2010–2011                                                 | Direct playing reports about WASD/kick, opposing goals, team strategy and informal group play. Opinions establish perceived appeal, not quantitative balance.                                                                                                          |
| S16 | [iRadar firsthand play article](http://iradar.blogspot.com/2011/11/haxball-simple-but-competitive-online.html), tehblogger / in-game Crayder, 2011 | Arrows/X and WASD/Space, opposing goals, room settings and 3v3. Historical room/network limits are deliberately not reused.                                                                                                                                            |

Also reviewed [node-haxball's developer README](https://github.com/wxyz-abcd/node-haxball)
as firsthand reverse-engineering context for team/key-state APIs. Its networking,
proxy examples and implementation are irrelevant to the LAN port and were not
used or copied. Search-only derivative control guides and package summaries were
discovery aids; the paired mechanics in RESEARCH.md use the primary sources above.

## Independence and evidence gaps

Vendor homepage, wiki and bundle are one author family, so they do not by themselves
count as two independent sources. Separate issue reporters are primary witnesses;
independent recreation authors and published reviewers supply the second account.
RESEARCH.md pairs the core mechanics explicitly and marks client-only numeric or
input observations as uncorroborated rather than inventing a second witness.

The enabled Cua surfaces were empty, so no original game was played in this session.
Python access to `/play` returned 403 for root; PowerShell/public-client and GitHub
fallbacks succeeded. No account or live room was created or joined. Original feel,
audio loudness, cue envelopes, live reset timing and current competitive balance
were not measured. The mandated two 90-second halves, 2–8-player cap, phone controls,
phone-only stage, deterministic server architecture and PartyBox result behavior
come from this repo's job/contract/design requirements, not those observations.

## Assets and licenses

Research adds no runtime assets, dependencies or third-party code. The port must
use fresh repo-native drawing/CSS/SVG and existing PartyBox SDK sound/haptic
primitives or original synthesis. Original HaxBall maps, client code, graphics,
logo, font downloads, recorded sounds and crowd audio are not reused. If later
implementation introduces any external asset, append its exact source and license
here before committing it.

## Local verification protocol

The mounted QA uses installed Chrome 154.0.8037.99, as returned by
`Browser.getVersion`, and the real public-view Controller. Chromium's
[Input handler](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/devtools/protocol/input_handler.cc)
and [feature definitions](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/public/common/content_features.cc)
explain the current WebTouch contact lifecycle. The private capture pins
`--disable-features=SyntheticPointerActions` and sends an explicit named
`touchEnd` for an individual contact. Its per-dispatch trusted-pointer telemetry
proves the other thumb remains down; omitting a contact from `touchMove` alone
does not release it on this path. The older
[protocol description](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json)
does not accurately describe that behavior. These sources inform the harness,
not the game's controls or rules. No Chromium code or browser assets are copied.
