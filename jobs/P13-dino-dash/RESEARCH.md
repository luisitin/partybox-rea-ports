# P13 Dino Dash research

Inspected 2026-10-11. Sources are linked in [SOURCES.md](SOURCES.md); no source code,
sprites, audio or branding were copied. Numerical direct-play observations are
saved in [original-play-observation.json](media/original-play-observation.json).

## Direct browser observation

The first cached-browser pass played the public
[wayou fork](https://wayou.github.io/t-rex-runner/) at a 390×844 viewport with touch
enabled, recorded at 2026-10-11T22:08:38.174Z. Space started a jump: measured speed
4.723, jumping true. After the next one-second wait, speed was 4.837, distance
245.55, jumping false. Held ArrowDown changed ducking to true at speed 4.873;
release changed it to false at 4.877. The final sample was still alive at speed
5.137 and distance 1116.48. Its action label says collision/death, but `crashed`
was false: that sample proves continued running, not a collision.

Those are measured instance values from a historical fork, not the current
Chromium base configuration. Small-screen scaling plausibly explains the lower
initial speed: Chromium scales 6 by viewport width/600 × 1.2, yielding 4.68 at
390px before update increments. That explanation is an inference, not a measured
fork configuration. The one-second speed increase is likewise an observation,
not evidence of a fixed 60 Hz rendering rate. The PartyBox conversion below uses
the explicitly stated nominal 60 Hz basis. A later capture must wait for actual
`crashed: true` before treating death as directly observed. No source-game media
is saved; only numerical observations and actions are recorded.

## Original loop and timing

The original is a single-player endless runner: automatic forward motion, ground
obstacles to jump, flying obstacles to avoid, distance accumulating until a collision.
The creators identify run, duck and jump as the deliberately small action set, with
rigid vintage-game movement. Independent researchers observed automatic running,
cacti, birds, score growth while alive and restart on death. Their learning experiment
used only jump/no-op; it is not evidence that the original lacks ducking.
([Creator interview](https://blog.google/products-and-platforms/products/chrome/chrome-dino/),
[Marwah et al., 2020, pp. 1–4](https://arxiv.org/pdf/2008.06799))

The current normal-mode configuration starts at 6 pixels per frame, adds 0.001 to
speed per update and caps it at 13. The update adds distance only while collision-free.
At a nominal 60 Hz, the equivalent is 360 units/s, acceleration 3.6 units/s² and a
780 units/s cap reached after about 116.7 seconds. This conversion is an inference
for a time-based port; Chromium's increment is update-based. The original initially
withholds obstacles for 3 seconds and has a 1.2-second restart guard. Its basic sound
events are button press, impact and score achievement.
([Chromium offline.ts](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/offline.ts),
[60 Hz constants](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/constants.ts))

## Jump, duck and obstacles

Normal jump gravity is 0.6 pixels/frame²; the initial velocity is -10 minus one tenth
of current scroll speed. Releasing jump trims ascent after the minimum height. Down
while airborne sets a speed drop; down on the ground lowers the body. The nominal
running body is 44×47 pixels and duck body 59×25, with smaller collision rectangles.
These observations support forgiving silhouettes and clear crouch feedback, not
reuse of the dinosaur geometry.
([Chromium trex.ts](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/trex.ts))

Small and large ground obstacles vary in width and group size. The original flying
obstacle is eligible at speed 8.5, not an exact score threshold. At 60 Hz this is
about 41.7 seconds and 453 score units, hence the common shorthand “450 points.”
Desktop bird positions are 100, 75 and 50 pixels down from the stage top; mobile uses
100 and 50. Birds have a randomly signed 0.8 speed offset. Gaps grow with speed:
minimum gap is rounded obstacle-width × speed plus base-gap × 0.6, with a maximum
of 1.5 times that minimum. Thus increasing speed does not simply mean placing
obstacles ever closer together.
([Obstacle definitions](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/offline_sprite_definitions.ts),
[Gap calculation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/obstacle.ts))

An independent analysis of a recorded 0–1700-score run reports growing spatial gaps
while reaction time shortens, and ducking as a way to trim a jump. It describes speed
changes at 100-point beats; the implementation shows a continuous increment, so we
use the code for exact timing and the recording for pacing evidence.
([Recorded level analysis, pp. 2–3](https://levashan1.github.io/WSOA4175A_1711097/assets/Runner.pdf))

## Score and feel

The original display converts distance with round(distance × 0.025), flashes on
100-unit achievements, and requests an achievement sound. Its tension comes from
reading the next silhouette, committing once, then landing in time for the next one.
The visible freeze at impact makes failure immediate; the sparse score beat provides
progress without distracting from the horizon.
([Distance meter](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/neterror/resources/dino_game/distance_meter.ts))

## PartyBox adaptation

- Every round uses one seeded obstacle course and one time-based speed curve for
  all 2–8 lanes. A rival cannot receive an easier sequence.
- Three rounds by default, configurable 1–5, each capped at 60 seconds. A surviving
  runner continues after everyone else crashes so “farthest at death” remains true.
- TV lanes show every original comet creature, its name, obstacles and crash state.
  A phone shows its own stage above two large controls; phone-only and spectator
  views also carry the public race. No screen needs verbal explanation.
- Tap jump gives a fixed 630 units/s impulse with 1800 units/s² gravity: approximately
  0.70 seconds in flight and 110.25 units of rise. This is an adaptation for networked
  thumb input, rather than a claim to reproduce variable-height source physics.
- Hold duck lowers the runner; release stands. The visual and collision poses agree.
  Rocks request jump; low birds are easiest to duck, and a safely timed jump can
  also clear one. Birds start after 12 seconds so a surviving
  short living-room round teaches both actions. The first obstacle reaches runners
  at 3 seconds, then arrival gaps are drawn from 1.45–2.10 seconds. Eligible birds
  have a one-in-three draw and cannot be consecutive.
- Initial speed is 360 units/s, acceleration 3.6 units/s², cap 780. A full 60-second
  run reaches 576 units/s; the original cap is retained but not reached in one round.
- Each round scores floor(distance/10) metres, frozen at collision; match score is
  cumulative. Ties share rank. The score reveal lasts 4.5 seconds before the next run.
- Keep rhythmic approach and generous recoverable gaps. Show failures with shape,
  pose and “OUT,” not colour alone. Use SDK cues and original art exclusively.

The first countdown belongs to the shell. Game phases are `play`, `score`, `done`;
there is no duplicate rules or ready stage. Reduced-motion users still see the judged
race and all statuses without optional decorative animation.

Pause ignores new jump/duck presses but accepts a duck release, preserving the
physical release across resume rather than trapping a player in the crouch pose.
