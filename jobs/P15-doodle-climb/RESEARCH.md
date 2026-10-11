# P15 Doodle Climb research

Inspected 2026-10-11. This is a mechanics study, not a copy of the original code or assets. Links identify the evidence; numeric values from a public recreation are labelled separately from original-game observations.

## Original loop and feel

The character bounces automatically after landing. The player aims the landing by steering left/right, traditionally by tilting the phone. There is no ordinary jump button. Lima Sky's own [App Store description](https://apps.apple.com/us/app/doodle-jump-insanely-good/id456355158) confirms tilt control; independent firsthand accounts in [Pocket Gamer's Java review](https://www.pocketgamer.com/doodle-jump/review-8982/) and [Windows Central's Windows Phone review](https://www.windowscentral.com/doodle-jump-review) explicitly describe the automatic bounce.

The run is an endless ascent and the goal is height. Falling below the current screen ends the attempt. The camera makes climbing irreversible: lower platforms disappear below the screen instead of becoming a safe place to wait. Both [Macworld's original iPhone review](https://www.macworld.com/article/198325/doodlejump.html) and [Pocket Gamer's review](https://www.pocketgamer.com/doodle-jump/review-8982/) describe these rules. Neither establishes exact native score units, gravity or camera thresholds.

Horizontal screen wrapping creates an alternative route to a landing. Two firsthand sources distinguish the mobile rule from versions that changed it: [The en's Windows Phone review](https://the-en.com/2011/06/04/wp7-game-review-doodle-jump/amp/) describes reappearing on the opposite side; [Nintendo Life's 3DS review](https://www.nintendolife.com/reviews/3ds/doodle_jump_adventures) notes that its new borders remove the mobile game's wrap. Wrapping is a useful route, not a death condition.

Platform variety breaks the repeating bounce rhythm. The developer lists broken, moving and disappearing platforms, plus springs and other upward boosts in the [official listing](https://apps.apple.com/us/app/doodle-jump-insanely-good/id456355158). [Macworld](https://www.macworld.com/article/198325/doodlejump.html) independently observed stationary green ledges, breaking brown ledges, moving blue ledges, disappearing ledges and spring launches. Colour was part of the original's language; PartyBox must also use distinct shapes/icons. Pocket Gamer's Java review describes the brown ledge differently, so native variants must not be assumed identical.

The highs feel social before multiplayer is added: another player's name and height marker appear in the margins as the climber passes that record. Both the [developer](https://apps.apple.com/us/app/doodle-jump-insanely-good/id456355158) and [Macworld](https://www.macworld.com/article/198325/doodlejump.html) describe this. A live rank/height marker makes the PartyBox version's competition legible without changing the bounce controls.

Sound is short feedback on a physical event rather than narration. [Pocket Gamer's iPad review](https://www.pocketgamer.com/doodle-jump/review-1624/) specifically reports a satisfying bounce pop. [Windows Central](https://www.windowscentral.com/doodle-jump-review) reports fitting sound effects and no music in the reviewed Windows Phone version. Native audio was not downloaded or auditioned here; PartyBox uses the SDK's own cues.

## Public client inspection: recreation, not native constants

Read the public [takosenpai2687 JavaScript recreation](https://github.com/takosenpai2687/doodle-jump), including `js/config.js`, `js/doodler.js`, `js/platform.js` and `js/index.js`, via GitHub/raw HTTP. Its README identifies it as a replica. The inspection confirms practical mechanisms: descent-only platform landings, automatic bounce, a camera threshold, horizontal wrapping, keyboard/touch steering and a stable alternative alongside a fragile ledge. Its source uses frame-dependent timing and random generation; those implementation choices do not satisfy the PartyBox contract.

Its [configuration](https://github.com/takosenpai2687/doodle-jump/blob/master/js/config.js) requests 70 frames/s and gravity 0.16 per update. Its [character class](https://github.com/takosenpai2687/doodle-jump/blob/master/js/doodler.js) starts with ordinary bounce force 8.15, spring force 14 and horizontal speed 7.2 per update, with stronger downward gravity. Its main file scales values with viewport size. These are recreation measurements only. They are not evidence of Lima Sky's private physics and are not port requirements.

The recreation also increments its score while scrolling its platform array; importing that score formula would confuse a platform count with physical height. Doodle Climb should instead track each climber's maximum world height explicitly. No inspected JavaScript, asset or sound is copied.

## PartyBox design decisions

- Three simultaneous rounds, each capped at 60 seconds; a 3-second ready beat and brief round standings preserve the reference port's rhythm. These durations are original living-room pacing, not measurements of the endless mobile game.
- Generate one course per round from the match seed. Every climber sees identical platform positions and timing. Pocket Gamer observed different native layouts per attempt; the shared course intentionally makes comparisons fair.
- Automatic bouncing keeps the phone to two large hold-left/hold-right pads. Hold neutral means no horizontal movement. Wrap indicators on both edges teach the shortcut. Motion sensors are optional rather than required for play.
- Keep one independent camera per climber. A faster rival cannot pull another player's platforms off screen. TV columns share a height scale and identify every climber with a name and slot symbol. A compact leaderboard explains who is highest.
- On phones with a TV, show clear steering instructions, own height and alive/out state. In phone-only rooms, show the local climbing stage above the same controls, with a compact competition summary. Spectators see the stage without controls.
- Maximum height decides the round; falling freezes the achieved height. Equal heights tie. Match scoring must be stated explicitly in the game README. The 60-second deadline prevents idle, disconnected or very strong players from delaying everyone.
- Validate each generated route against the chosen bounce apex and horizontal reach. Keep a stable route through every band; moving, fragile and spring ledges offer optional variety. A fall should follow a visible missed landing, not an unreachable random gap.
- Use original vector climbers and ledges with PartyBox tokens. Distinguish stable/moving/fragile/spring ledges by shape and icon, not colour alone. Avoid screen shake and flashing; honour reduced motion.

## Research limits

No native executable, private source or exact native physics was available to this research task. Browser gameplay and timed audiovisual measurements were not performed. The consulted public client is explicitly a recreation. All simulation, scoring and timing constants in the PartyBox code are original tuning and must be verified by the job's tests, simulations and screens. Historical firsthand reviews corroborate the core loop across versions; they do not prove identical behaviour in every current theme.
