# Sources and asset provenance

Inspected 2026-10-11. Research only; no implementation or media copied.

| Source                                                                                                                                                                  | What it establishes                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Chromium offline.ts](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/offline.ts)                              | Normal speed constants, continuous update ramp, clear/restart times, input and sound event categories.                                                |
| [Chromium constants.ts](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/constants.ts)                          | Nominal 60 Hz basis for the time-unit conversion.                                                                                                     |
| [Chromium trex.ts](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/trex.ts)                                    | Jump impulse, gravity, release, fast fall and duck geometry.                                                                                          |
| [Chromium obstacle definitions](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/offline_sprite_definitions.ts) | Ground clusters and flying obstacle eligibility, heights and speed offset.                                                                            |
| [Chromium obstacle.ts](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/obstacle.ts)                            | Speed-dependent gap calculation and obstacle variation.                                                                                               |
| [Chromium distance_meter.ts](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/distance_meter.ts)                | Distance conversion and 100-unit achievement signal.                                                                                                  |
| [Google creator interview, 2018](https://blog.google/products-and-platforms/products/chrome/chrome-dino/)                                                               | Firsthand design intent: a small run/duck/jump action set and rigid arcade motion.                                                                    |
| [Marwah, Srivastava, Gupta and Verma, 2020](https://arxiv.org/pdf/2008.06799)                                                                                           | Independent original-game experiment: auto-run, obstacle avoidance, distance scoring and death/restart; its experiment narrows actions to jump/no-op. |
| [Recorded level design analysis, 2020](https://levashan1.github.io/WSOA4175A_1711097/assets/Runner.pdf)                                                                 | Independent measured play through 1700 score: spatial gaps, reaction-time pressure and duck-assisted jump trimming.                                   |

The independent observations corroborate the loop and pacing. Exact constants come
from the primary implementation; the 60 Hz conversion is explicitly derived. The
recorded analysis's 100-point speed-step description is not used as an exact rule.

Direct play of the [wayou historical fork](https://wayou.github.io/t-rex-runner/)
confirmed Space jump, automatic running, rising instance speed and duck/release;
numerical evidence is in [original-play-observation.json](media/original-play-observation.json).
The first pass was at 390×844 with touch enabled and measured speed around 4.7,
distinct from the current Chromium base speed of 6. Mobile viewport scaling is a
plausible explanation, not a verified fork configuration. Its final sample remained
alive; the collision/death label does not establish a crash.

All runner, rock and bird graphics are new inline SVG/CSS drawings made for this
port. No dinosaur, cactus, logo, sprite sheet, font, audio or music from Chromium or
a fan site is included. Audio uses the existing PartyBox SDK's supplied cues. Runtime
assets require no downloads, tracking or external requests. Generated QA screenshots
document this port; they are not source-game assets.
