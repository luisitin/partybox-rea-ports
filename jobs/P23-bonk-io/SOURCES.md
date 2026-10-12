# P23 Bonk.io sources

Checked 2026-10-12 UTC. Sources inform mechanics only. All shipped code, arena geometry, numbered SVG/CSS art and feedback choices are authored; no source code, map, skin, logo, sound or music was copied. No third-party asset licence is needed because no third-party asset is shipped.

| ID  | URL / evidence                                                                                                  | Role and independence                                             | Limits                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | [bonk.io](https://bonk.io/)                                                                                     | Primary developer description and controls                        | Qualitative rules; no calibrated physics or phase timings.                                                                                         |
| O2  | [gameframe-release.html](https://bonk.io/gameframe-release.html)                                                | Primary current public client UI, read-only HTTP                  | Same publisher as O1; labels can include inactive/legacy markup. No executed match.                                                                |
| O3  | [GameResources.js](https://bonk.io/GameResources.js)                                                            | Primary resource declaration inventory, inspected in memory       | Same publisher; embedded assets were not saved or played. Names establish availability, not exact playback.                                        |
| O4  | [js/alpha2s.js](https://bonk.io/js/alpha2s.js)                                                                  | Primary public obfuscated client, narrowly inspected read-only    | Same publisher; not decoded or executed. No extracted timing or physics numbers used.                                                              |
| W1  | [Gameplay Elements](https://bonkio.fandom.com/wiki/Gameplay_Elements)                                           | Independently maintained community wiki                           | Search-index text accessible; direct web open failed. Versions and exact numbers may differ from current game.                                     |
| W2  | [Classic mode](https://bonkio.fandom.com/wiki/Classic_%28Mode%29)                                               | Same community editorial family as W1                             | Surface jumping and heavy fatigue described; not an independent second source for W1.                                                              |
| W3  | [Changelog](https://bonkio.fandom.com/wiki/Changelog)                                                           | Same community editorial family                                   | Historical update evidence corroborates flow existence, not current numerical timings. Direct web open failed; indexed text was read.              |
| W4  | [Assets](https://bonkio.fandom.com/wiki/Assets)                                                                 | Same community editorial family                                   | Inventory corroborates O3 categories. Do not download, reuse or treat a wiki upload licence as permission for original game media.                 |
| W5  | [Soundtrack](https://bonkio.fandom.com/wiki/Soundtrack)                                                         | Same community editorial family                                   | Unheard style report only, historical/current distinctions. No reproduced music.                                                                   |
| I1  | [Bonk.io guide](https://iogames.onl/bonkio)                                                                     | Separately published third-party instructions                     | Supports qualitative survival/controls; editorial authorship and borrowing are unverified. Not a numeric physics authority.                        |
| U1  | [Ohio State Bonk.io teaching lab](https://www.asc.ohio-state.edu/orban.14/stemcoding/milestones/bonk/bonk.html) | Independent, named university author explaining an authored clone | Gravity, horizontal forces and falling model only. Its example values and simplified bounce are not original Bonk.io measurements. No code copied. |
| U2  | [Ohio State lab catalog](https://www.asc.ohio-state.edu/orban.14/physics_coding/)                               | Same university source family as U1                               | Confirms named teaching context; not another independent mechanics source.                                                                         |

Facts are paired in RESEARCH.md. Multiple official pages count once; multiple wiki pages count once; the lab catalog and lab count once. Values without an independently corroborated measurement are explicitly authored or unknown.

## Rejected or limited candidates

- [CrazyGames Bonk.io URL](https://www.crazygames.com/game/bonkio) redirected to the generic ball category when checked. It provided no Bonk-specific corroboration.
- [bonk-io.com mechanics article](https://bonk-io.com/blog/how-bonk-io-works/) is not the official domain and contradicts the official X control by naming Down as heavy. Its precise claims were not adopted.
- Community reposts of videos/resources were not treated as independent source families. No original audio or video was played or timed.

## Local authoritative overlap evidence

- `C:/dev/partybox/games/*/manifest.json`: 110 manifests, excluding `_template` and `node_modules`; no Bonk id/name.
- `C:/dev/partybox/packages/server/src/games.generated.ts`: 110 unique game imports; no Bonk entry.
- `C:/dev/partybox/docs/games/catalog.md`: human catalog previously counted 109, so actual manifests/generated registry govern completeness.
- Candidate README/manifest inspection: `burning-bridges`, `all-the-marbles`, `goombalancing-act`; each has a different control/goal loop. The owner checkout was read only.
