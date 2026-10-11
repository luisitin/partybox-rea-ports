# P14 source and asset provenance

Inspected 2026-10-11. Sources inform mechanics and design only. Nothing from these pages, bundles or repositories is redistributed.

## Original and developer evidence

| Source                                                                                                                                                                             | Provenance and use                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Official Crossy Road site](https://www.crossyroad.com/)                                                                                                                           | Hipster Whale product description: endless hopping through roads, railways and rivers. Official imagery and trademarks are excluded from this game.                                                                 |
| [Crossy Road: A Whale of a Time, GDC 2015 slides](https://media.gdcvault.com/gdc2015/presentations/Hall_Matthew_Crossy_Road_Whale.pdf)                                             | Primary presentation by original developers Matt Hall and Andy Sum. Pages 18–20: procedural generation and tap/swipe feel; page 25: deliberately amusing death. No exact proprietary generation constants supplied. |
| [TouchArcade launch review, Carter Dotson, 2014-11-21](https://toucharcade.com/2014/11/21/crossy-road-review/)                                                                     | Independent firsthand play report: random crossings, distance score, tap/swipe controls, eagle pressure and fast retries. Used as attributed observational evidence.                                                |
| [Pocket Gamer launch review, Rob Rich, 2014-11-25](https://www.pocketgamer.com/crossy-road/review/)                                                                                | Independent firsthand play report corroborating random terrain, single-space cardinal moves and eagle catch when falling behind.                                                                                    |
| [Pocket Gamer pre-release article, Chris Priestman, 2014-09-02](https://www.pocketgamer.com/crossy-road/crossy-road-is-an-amusing-endless-hopping-froguelike-with-lots-of-splats/) | Contemporary original-game report describing traffic and logs moving through randomly generated rivers. Used only for that broad mechanic, not exact timing.                                                        |
| [GamesBeat interview with Matt Hall, Jeff Grubb, 2015-08-20](https://gamesbeat.com/pac-man-256-developer-hipster-whale-on-distractions-appealing-to-older-fans-and-more/)          | Original developer interview explaining the forward-pressure intent shared by the eagle and the later Pac-Man 256 pursuing glitch.                                                                                  |

## Public implementation inspection

| Source                                                                                                                                 | Provenance and use                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [lowthergv/crossy](https://github.com/lowthergv/crossy)                                                                                | Independent public remake. Read world.js, lanes.js, player.js, game.js and constants.js to understand a row-based procedural generator, moving hazards/support, progress and idle handling. No code or models copied. These observations describe the remake, not the original generator. |
| [Hunor Márton Borbély's Three.js tutorial](https://www.freecodecamp.org/news/how-to-code-a-crossy-road-game-clone-with-threejs)        | Author-written educational implementation. Independently supports the distinction between grid hops and continuously moving traffic. No tutorial code or visuals copied.                                                                                                                  |
| [Gamefroot Crossy Road tutorial, section generation](https://gamefroot-developer.gitbooks.io/crossy-road-tutorial/content/step-3.html) | Publisher-authored educational implementation using road, river and tree section types. No code or visuals copied.                                                                                                                                                                        |

## Assets and dependencies

- Game illustrations are original inline SVG/CSS geometry made for PartyBox. No downloaded image, texture, sprite, logo, font, music or sound is included.
- Colour, spacing, typography and motion use the repository's PartyBox design tokens.
- Sounds, if enabled, use repository SDK cues; provenance remains with the SDK's existing sound documentation.
- No runtime requests to any listed source, analytics service or external asset host.
- No new dependency is introduced by this research. The implementation uses the existing SDK and React.

No direct original-play measurement was made by the research worker. Exact original timing and probability values remain unverified; selected port values are documented as adaptation decisions in the game README and ASSUMPTIONS.md.
