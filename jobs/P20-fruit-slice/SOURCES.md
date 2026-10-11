# P20 Fruit Slice sources

Accessed 2026-10-11. Research only; no reference asset or source code is bundled.

| Source                                                                    | Exact URL                                                                                                                                                   | What it supports                                                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Halfbrick, beginner guide (2016-04-15), primary                           | https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja                                                                                  | Swipe, 3+ combo, apex timing, Blitz, mode distinction; single-source exact bonuses        |
| Halfbrick, Arcade announcement (2010-11-02), primary                      | https://www.halfbrick.com/blog/fruit-ninja-arcade-mode-announced                                                                                            | 60-second score attack, overlapping temporary powers, awards                              |
| Adrenaline Amusements, FX2 operation manual, primary for licensed cabinet | https://www.betson.com/wp-content/uploads/wpallimport/files/redemption-service-manuals/fruit-ninja-fx-2-redemption-service-manual-adrenaline-amusements.pdf | Page 7: swipe, 3+ combo, recoverable score-loss bomb, powers; not mobile timing constants |
| IntoMobile, Daniel Perez (2010-11-09), independent reporting              | https://www.intomobile.com/2010/11/09/fruit-ninja-receives-arcade-mode-update-for-both-iphone-and-ipad/                                                     | Confirms 60 seconds, nonfatal Arcade bombs, temporary overlapping powers                  |
| SuperCheats, Mongoose General, independent player guide                   | https://www.supercheats.com/guides/fruit-ninja/game-modes                                                                                                   | 60 seconds, Arcade ending flourish                                                        |
| SuperCheats, same guide                                                   | https://www.supercheats.com/guides/fruit-ninja/other-tips                                                                                                   | Apex timing, diagonal coverage, patience                                                  |
| SuperCheats, same guide; verified misspelled path                         | https://www.supercheats.com/guides/fruit-ninja/in-a-butshell                                                                                                | Escalating Blitz rewards; accessed through the guide's own link                           |
| SuperCheats, same guide                                                   | https://www.supercheats.com/guides/fruit-ninja/bombs                                                                                                        | Purple bomb report: -10, fruit cleared, powers removed; release-specific                  |
| Halfbrick current product page                                            | https://www.halfbrick.com/games/fruit-ninja-classic                                                                                                         | Native product context; no original hands-on play obtained                                |
| Unverified web clone HTML                                                 | https://playfruitninja.com/                                                                                                                                 | Public runtime links; no established Halfbrick provenance                                 |
| Unverified web clone runtime                                              | https://playfruitninja.com/c2runtime.js                                                                                                                     | Minified Construct 2 runtime inspected as text only                                       |
| Unverified web clone project                                              | https://playfruitninja.com/data.js                                                                                                                          | Timer/score/bomb strings; conflicting Sushi Ninja share string                            |
| Unofficial Bada fan port README                                           | https://github.com/mariotaku/FruitNinja                                                                                                                     | Access/licence constraints and explicit reverse-engineering limitations                   |
| Unofficial fan port comments                                              | https://raw.githubusercontent.com/mariotaku/FruitNinja/main/src/game/ComboModifier.cpp                                                                      | Independent research lead for 3+ combo settlement; no code copied                         |
| Unofficial fan port comments                                              | https://raw.githubusercontent.com/mariotaku/FruitNinja/main/src/game/BombHit.cpp                                                                            | Research lead for bomb aftermath; no code copied                                          |
| Unofficial fan port comments                                              | https://raw.githubusercontent.com/mariotaku/FruitNinja/main/src/entities/Fruit.cpp                                                                          | Research lead for fruit trajectories; no code copied                                      |

Two pages under Halfbrick count as one independent source. SuperCheats pages also
count as one. Cabinet observations corroborate broad shared mechanics without
claiming that its configurable timings match the mobile game. IntoMobile's
launch coverage corroborates the clock and mode distinction; it is not a play
test performed by this runner.

All Fruit Slice visuals will be original inline SVG/CSS. SDK sounds are supplied
by PartyBox. No CC0 or third-party game assets are required.

Unavailable: Fandom Arcade/Combo full pages returned restricted-fetch errors; the
official embedded YouTube trailer returned an internal fetch error. No reference
sound or numeric flight constants are asserted from those endpoints.
