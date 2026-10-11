# P18 sources and asset provenance

Accessed 2026-10-11. Sources were read for mechanics only. Different store listings
from the same developer count as one source, not independent corroboration.

| Source                                                                                                                                                         | What it establishes                                                                      | Limitation                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Official Google Play listing](https://play.google.com/store/apps/details?id=com.colorswitch.switch2)                                                          | Developer-described colour-matching obstacle rule, increasing challenge and music.       | Current rebuilt mobile release, not the original 2015 engine.                    |
| [Common Sense Media review](https://www.commonsensemedia.org/app-reviews/color-switch)                                                                         | One-finger upward bounce, moving geometric segments, hover/wait strategy and soundtrack. | Review language about tap pressure is not proof of pressure-sensitive input.     |
| [Code Rewind review, April 2016](https://www.coderewind.com/2016/04/game-color-switch/)                                                                        | Airborne tapping, mismatch failure, stars and varied obstacles.                          | No engine constants or frame measurements.                                       |
| [The Koalition review, April 30, 2016](https://thekoalition.com/2016/the-possibly-perfect-color-switch)                                                        | Four-colour obstacles, changing ball colour, score stars and endless play.               | Old linked Poki game is no longer available at that URL.                         |
| [Pocket Gamer guide, June 24, 2016](https://www.pocketgamer.com/color-switch/pocket-gamers-ultimate-guide-to-color-switch/)                                    | Approximately two taps per second to hover; patient obstacle reading.                    | Player advice, not measured physics.                                             |
| [Level Winner guide, May 3, 2016](https://www.levelwinner.com/color-switch-tips-tricks-strategy-guide-a-look-at-endless-and-challenge-modes/)                  | Colour-changing power-ups, match failure and hover rhythm.                               | Contemporary guide contains other claims not used by this port.                  |
| [Cody's review, August 10, 2016](https://codygreviews.blogspot.com/2016/08/)                                                                                   | Changes of ball colour, shape/movement variety and cosmetic star rewards.                | Personal review; used alongside independent sources.                             |
| [Official homepage](https://colorswitch.co/)                                                                                                                   | Original game's public web destination and mobile Play link.                             | Public HTML has no original game client.                                         |
| [GamesEverytime page](https://www.gameseverytime.com/color-switch/) and [embed metadata](https://html5.gamedistribution.com/de51511607a040f093fc6209abc8cad4/) | Public host/client inspection attempt.                                                   | Embed identifies a different Inlogic game; rejected as original-client evidence. |

All Colour Gate graphics are original React/SVG/CSS geometry. PartyBox design
tokens and SDK primitives come from this repository. No external art, sound,
music, font, sprite, logo, image or copied client code is required at runtime.
Verification captures contain the port's own interface. No additional asset licence
is needed beyond this repository's licences.
