# P15 Doodle Climb research

Inspected 2026-10-11. This is a mechanics study, not a copy of the original code or assets. Links identify the evidence; numeric values from a public recreation are labelled separately from original-game observations.

## Original loop and feel

The character bounces automatically after landing. The player aims the landing by steering left/right, traditionally by tilting the phone. There is no ordinary jump button. Lima Sky's own [App Store description](https://apps.apple.com/us/app/doodle-jump-insanely-good/id456355158) confirms tilt control; independent firsthand accounts in [Pocket Gamer's Java review](https://www.pocketgamer.com/doodle-jump/review-8982/) and [Windows Central's Windows Phone review](https://www.windowscentral.com/doodle-jump-review) explicitly describe the automatic bounce.

The run is an endless ascent and the goal is height. Falling below the current screen ends the attempt. The camera makes climbing irreversible: lower platforms disappear below the screen instead of becoming a safe place to wait. Both [Macworld's original iPhone review](https://www.macworld.com/article/198325/doodlejump.html) and [Pocket Gamer's review](https://www.pocketgamer.com/doodle-jump/review-8982/) describe these rules. Neither establishes exact native score units, gravity or camera thresholds.

Horizontal screen wrapping creates an alternative route to a landing. Two firsthand sources distinguish the mobile rule from versions that changed it: [The en's Windows Phone review](https://the-en.com/2011/06/04/wp7-game-review-doodle-jump/amp/) describes reappearing on the opposite side; [Nintendo Life's 3DS review](https://www.nintendolife.com/reviews/3ds/doodle_jump_adventures) notes that its new borders remove the mobile game's wrap. Wrapping is a useful route, not a death condition.

Platform variety breaks the repeating bounce rhythm. The developer lists broken, moving and disappearing platforms, plus springs and other upward boosts in the [official listing](https://apps.apple.com/us/app/doodle-jump-insanely-good/id456355158). [Macworld](https://www.macworld.com/article/198325/doodlejump.html) independently observed stationary green ledges, breaking brown ledges, moving blue ledges, disappearing ledges and spring launches. Colour was part of the original's language; PartyBox must also use distinct shapes/icons. Pocket Gamer's Java review describes the brown ledge differently, so native variants must not be assumed identical.

The highs feel social before multiplayer is added: another player's name and height marker appear in the margins as the climber passes that record. Both the [developer](https://apps.apple.com/us/app/doodle-jump-insanely-good/id456355158) and [Macworld](https://www.macworld.com/article/198325/doodlejump.html) describe this. A live rank/height marker makes the PartyBox version's competition legible without changing the bounce controls.

Sound is short feedback on a physical event rather than narration. [Pocket Gamer's iPad review](https://www.pocketgamer.com/doodle-jump/review-1624/) specifically reports a satisfying bounce pop. [Windows Central](https://www.windowscentral.com/doodle-jump-review) independently reports fitting sound effects. Native audio was not auditioned here; PartyBox uses the SDK's own cues.

## Public client inspection: recreation, not native constants

Read the public [takosenpai2687 JavaScript recreation](https://github.com/takosenpai2687/doodle-jump), including `js/config.js`, `js/doodler.js`, `js/platform.js` and `js/index.js`, via GitHub/raw HTTP. Its README identifies it as a replica. The inspection confirms practical mechanisms: descent-only platform landings, automatic bounce, a camera threshold, horizontal wrapping, keyboard/touch steering and a stable alternative alongside a fragile ledge. Its source uses frame-dependent timing and random generation; those implementation choices do not satisfy the PartyBox contract.

Its [configuration](https://github.com/takosenpai2687/doodle-jump/blob/master/js/config.js) requests 70 frames/s and gravity 0.16 per update. Its [character class](https://github.com/takosenpai2687/doodle-jump/blob/master/js/doodler.js) starts with ordinary bounce force 8.15, spring force 14 and horizontal speed 7.2 per update, with stronger downward gravity. Its main file scales values with viewport size. These are recreation measurements only. They are not evidence of Lima Sky's private physics and are not port requirements.

The recreation also increments its score while scrolling its platform array; importing that score formula would confuse a platform count with physical height. Doodle Climb should instead track each climber's maximum world height explicitly. No inspected JavaScript, asset or sound is copied.

### Public recreation play

The root runner played the README's linked [public recreation](https://takosenpai2687.github.io/doodle-jump/) in one isolated headless Edge browser at a 390 × 844 viewport. The page created a 390 × 844 canvas and started automatically. The runner held ArrowLeft for 250 ms and released it, then held ArrowRight for 250 ms and released it. This exercised the recreation's keyboard steering; the source separately confirms that key release returns horizontal velocity to zero. These requested key-hold durations are not measurements of native physics or jump timing.

[research-play.json](research-play.json) records the URL, `nativeOriginal: false`, action sequence, canvas dimensions and the uncommitted screenshot status. The temporary screenshot was not included in this repository. The browser loaded the recreation for research; none of its artwork, audio or JavaScript was copied into the port. The native Lima Sky app was not played.

## PartyBox design decisions

- Three simultaneous rounds, each capped at 60 seconds; the shell owns the initial start. A 2.5-second rematch beat and 5-second standings separate later rounds. These durations are original living-room pacing, not measurements of the endless mobile game.
- Generate one course per round from the match seed. Every climber sees identical platform positions and timing. Pocket Gamer observed different native layouts per attempt; the shared course intentionally makes comparisons fair.
- Automatic bouncing keeps the phone to two large hold-left/hold-right pads. Hold neutral means no horizontal movement. Wrap indicators on both edges teach the shortcut. This port uses hold controls and does not require motion sensors.
- Keep one independent camera per climber. A faster rival cannot pull another player's platforms off screen. TV columns share a height scale and identify every climber with a name and slot symbol. A compact leaderboard explains who is highest.
- Every player's phone shows the local climbing stage, steering instructions, own height and alive/out state. Phone-only rooms use the same controls and stage; spectators see a public climb and standings without controls.
- Maximum height decides the round; falling freezes the achieved height. Equal heights tie. Match scoring must be stated explicitly in the game README. The 60-second deadline prevents idle, disconnected or very strong players from delaying everyone.
- Validate each generated route against the chosen bounce apex and horizontal reach. Keep stable ledges through every band and add occasional springs. Moving/fragile ledges are not part of this P15 port. A fall should follow a visible missed landing, not an unreachable random gap.
- Use original vector climbers and ledges with PartyBox tokens. Springs have a visible coil, so colour is not the only distinction. Avoid screen shake and flashing; honour reduced motion.

### Reachability under the port's own constants

Ordinary flight is `y(t) = 330t - 300t²`, with apex 90.75 units. A next ledge at the maximum 64-unit rise is crossed on descent at `(330 + sqrt(108900 - 1200×64)) / 600 = 0.848607881 s`. The 20 ms sampled chord crosses at at least 0.848444444 s. Every target centre is at most 120 wrapped units away: at speed 150, travel takes at most 0.8 s. Adjacent centres differ by at most 65; even a landing at the edge of the previous platform plus the 8-unit body tolerance is at most 111 units away, requiring 0.74 s. Minimum platform half-width plus body tolerance is 30, while one horizontal sample moves only 3. These bounds establish a reachable ordinary path independently of optional spring boosts. They are analytic checks of original port tuning, not native-game measurements.

The server's timer/broadcast cadence is 200 ms (`TICK_MS`), while collisions and movement still use 20 ms fixed samples (`STEP_MS`). A later timer judges every intervening physics sample; the broadcast cadence does not change the flight or reachability calculation.

## Research limits

No native executable, private source or exact native physics was available to this research task. The public recreation's client was read and played; native gameplay and timed native audiovisual measurements were not performed. The browser metadata records actions and canvas dimensions, not measured character displacement or bounce timing. All simulation, scoring and timing constants in the PartyBox code are original tuning and must be verified by the job's tests, simulations and screens. Historical firsthand reviews corroborate the core loop across versions; they do not prove identical behaviour in every current theme.
