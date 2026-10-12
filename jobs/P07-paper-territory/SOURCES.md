# P07 sources and provenance

All sources accessed 2026-10-11. The delivered game is **Paper.io 2**, id
`paper-io`, under the owner's official-name instruction added to main on 10-11.
The artwork, code and sound assets remain original; no trademarked art is used.

| Source                                                                                                                                  | Authority / independence                                                       | Used for                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Voodoo support: basic rules](https://support.paper.io/support/solutions/articles/202000095752-what-are-the-basic-rules-of-paper-io-2-) | Original publisher's primary instructions, linked from its product site        | Small starting patch, exposed trail, return-to-capture, enemy cut, area objective.                                                                                                              |
| [Voodoo product page](https://voodoo.io/games/paper-io-2) and [current landing page](https://voodoo.io/paper2)                          | Same publisher; not independent corroboration                                  | Current official product/support entry point; legacy paper-io.com redirects here.                                                                                                               |
| [Voodoo's App Store release history](https://apps.apple.com/us/app/paper-io-2/id1423046460)                                             | Original publisher's primary release notes                                     | Version 4.33.0 explicitly changes self-trail crossings to nonfatal; current capture/outline presentation has changed since old browser descriptions.                                            |
| [CrazyGames browser-play instructions](https://www.crazygames.com/game/paper-io-2)                                                      | Independent game host's gameplay instructions                                  | Reconnect to own land, claim rival land, cut trails; older fatal-self-trail advice and short-loop strategy.                                                                                     |
| [QubicGames' Nintendo product description](https://www.nintendo.com/us/store/products/paper-io-2-switch/)                               | Primary description from a different publisher of the licensed console edition | Traverse/capture rival land, exposed-trail risk, up to eight players on one shared screen. Console extras are not presumed browser rules.                                                       |
| [FastFun browser-play instructions](https://fastfun.io/game/paper-io-2)                                                                 | Independent game host's instructions                                           | Corroborates classic own-trail danger and close-to-home loops; not authoritative for current mobile release.                                                                                    |
| [Olin Olmstead's firsthand gameplay analysis, 2018](https://www.gamedeveloper.com/design/paper-io-2-a-natural-difficulty-curve)         | Independent player's historical observations                                   | Continuous/free-direction play, land loss, area feedback, leader and death presentation; historic boundary and session-length reports. Bot claims are not treated as current multiplayer facts. |
| [Public mirror browser client](https://paperio.site/app2.js?v7)                                                                         | Inspectable client; mirror owner/provenance unverified                         | Read-only historical implementation observations: polygons, boundary crossings, return handling and elimination cleanup. Self-identifies build A6 dated 2020-10-14. No copied code.             |
| [WallerTheDeveloper's independent reimplementation description](https://github.com/WallerTheDeveloper/paperio-clone)                    | Clone author's primary description of their own implementation                 | Comparison of grid/flood-fill/collision choices; not evidence of exact original corner rules.                                                                                                   |
| [woofully's independent reimplementation description](https://github.com/woofully/paperio)                                              | Clone author's primary description of their own implementation                 | Shows a different polygon approach; reinforces that algorithm and collision policies need an authored spec. No source code taken.                                                               |

Two official Voodoo pages count as one publisher. RESEARCH.md pairs the core facts
with independent publishers and labels uncertain, historical and version-specific
details. Exact movement speed, audio timings and simultaneous/corner outcomes are
not claimed as measured original facts.

## Delivered assets and runtime

- The arena, territory cells, trails, heads, home markers and interface graphics
  are original canvas/SVG/CSS composition using existing PartyBox tokens.
- No source-game skin, artwork, logo, screenshot, font, music or sound file is
  committed. Sounds use existing SDK/shell cues.
- No client bundle is vendored. Public code was inspected as text in memory;
  neither original nor clone code was imported into the delivered implementation.
- No runtime external request, tracking, analytics or new dependency is needed.
