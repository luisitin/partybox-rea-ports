# P08 sources and asset provenance

Checked 2026-10-11. Facts use independent sources where available. The two
store listings share the same original developer, so they do not alone
count as two independent sources. The play reports are by different authors.

- **S1 — VOODOO developer listing, current:**
  https://apps.apple.com/us/app/hole-io-original-hole-game/id1389111413
  Official confirmation of city-object growth, simple gliding control and
  increasing consumption feedback. Does not publish numeric thresholds.
- **S2 — Official PC publisher listing, 2024 edition:**
  https://store.steampowered.com/app/2751230/Hole_io/
  Confirmation of larger-object and rival consumption, shared-screen play.
  Edition differs from the original mobile release.
- **S3 — Aetos382, firsthand illustrated walkthrough, 2018-06-21:**
  https://tech.blog.aerie.jp/entry/2018/06/21/091300
  Historical timing, size classes, route strategy, temporary respawn.
- **S4 — Jed Hartman, firsthand strategy notes, 2018-06-23:**
  https://www.kith.org/jed/2018/06/23/some-hole-io-strategy-tips/
  Search-indexed text supplied exact historical score thresholds. Direct
  web open failed; a direct HTTP retry did not produce the article promptly.
  Treat uncrosschecked exact values as historical observations only.
- **S5 — GRACE_MJ, firsthand play report, 2018-07-03:**
  https://grace8snorlax.tistory.com/entry/Holeio-%EA%B3%B5%EB%9E%B5?category=746957
  Independently confirms score-driven growth, rival consumption and a short
  interval after being swallowed during which consumption is disabled.
- **S6 — Medhi Nait Mazi, firsthand review, 2018-06-18:**
  https://iphonesoft.fr/2018/06/18/hole-io-jeu-avale-tout-y-compris-1ere-place-app-store
  Independent confirmation of two-minute classic competition and growth.
- **S7 — Adam Kowen and Alon Bilman, public educational 2D client:**
  https://github.com/AdamKowen/Hole.io
  Read `Assets/scripts/HoleController.cs`, `Swallowable.cs` and
  `LevelPointsTable.cs` through raw GitHub. This is a reimplementation and
  is not evidence for the original's exact constants.
- **S8 — Browser variant loader, publisher identity unconfirmed:**
  https://holeio.com/b/4/gameWebGL.js
  Read-only inspection showed Unity bundle loading and DRA.RU metadata.
  Its threshold logic was not exposed; excluded from canonical claims.

All shipped visuals are original SVG/CSS geometry built for this port.
No external assets are used, and no source above supplies a runtime asset.
SDK sound cues and PartyBox design tokens are the only shared resources.
