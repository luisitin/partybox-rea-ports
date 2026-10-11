# P12 — Sources and asset provenance

All links were inspected on 2026-10-11. Research is reference-only; the port
contains independently written code and original inline art.

| Source                                                                                                                                                           | Evidence used                                                                                    | Limits                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| [Harvard CS50 lecture](https://cs50.harvard.edu/extension/games/2026/spring/notes/1/)                                                                            | Public tutorial's flight, generation, passage scoring, collision and phase model                 | A recreation; its constants and added music are not evidence of original constants or music                   |
| [Raspberry Pi / Wireframe tutorial](https://www.raspberrypi.com/news/recreate-flappy-birds-flight-mechanic-wireframe-29/)                                        | Independent technical corroboration of the one-tap gravity loop and spaced, bounded random gates | An homage, with explicitly tunable parameters                                                                 |
| [TIME firsthand review](https://time.com/4034/no-you-dont-have-to-play-flappy-bird/)                                                                             | Original 2014 observations of timing difficulty, scoring and impact feedback                     | Qualitative observation, not numeric physics measurement; unrelated sponsored material at the top is not used |
| [FlapPyBird archive at 038359d](https://github.com/sourabhv/FlapPyBird/blob/038359dc6122f8d851e816ddb3e7d28229d585e5/flappy.py)                                  | Comparison parameters and source-visible discrete flap and feedback mechanics                    | A clone; no code, sprites, sounds or fonts copied                                                             |
| [Bay Tek arcade manual](https://www.betson.com/wp-content/uploads/wpallimport/files/redemption-service-manuals/flappy-bird-game-service-manual-baytek-games.pdf) | Manufacturer's one-button rule and vertical-gap difficulty explanation, pages 5 and 9            | Arcade edition; ticket economy and additional lives not ported                                                |

Harvard and Raspberry Pi are independent sources for the core movement,
obstacle-course and scoring facts. TIME supplies contemporary observed
original-game feedback; the recreation code independently distinguishes those
feedback moments. Exact original numeric physics remain unproven.

## Port assets

- Glider silhouettes and arch gates: original inline SVG drawn for this port.
- Player identity: names, lane numbers and PartyBox palette tokens; no avatar
  is drawn inside a flight lane.
- Audio: PartyBox SDK cues; no source-game audio files or samples.
- No downloaded artwork, sound, music, fonts, logos, or CC0 asset pack is added.
- No runtime calls to any research URL are made.

## Attempted sources that could not be inspected

- [Creator interview in Rolling Stone](https://www.rollingstone.com/culture/news/the-flight-of-the-birdman-flappy-bird-creator-dong-nguyen-speaks-out-20140311)
  returned HTTP 402. No claim relies on inaccessible interview text.
- [Gamelab 2014 Vimeo embed](https://player.vimeo.com/video/100969855)
  returned HTTP 404. The video was not watched.

The research-source product name is used only to identify references. The
shipped game name is the queue's original title, Flappy Lanes.
