# P12 — Flappy Lanes research

Researched 2026-10-11. Method: inspect public descriptions and primary recreation
source code, then compare the evidence before choosing PartyBox mechanics. The
2013 mobile original was not available for firsthand play in this session. No
source code, artwork, audio, or fonts were copied into the port.

## Evidence and confidence

Two independent technical sources agree on the core loop:

1. [Harvard CS50 game-development lecture](https://cs50.harvard.edu/extension/games/2026/spring/notes/1/)
   documents a discrete upward-velocity flap, downward gravity, regularly
   arriving obstacle pairs, varying gap heights, a single point per cleared
   pair, and collision ending a run. Its constants are tutorial choices.
2. [Raspberry Pi / Wireframe flight-mechanics tutorial](https://www.raspberrypi.com/news/recreate-flappy-birds-flight-mechanic-wireframe-29/)
   independently explains the same movement, equally spaced horizontal
   obstacles, bounded random gap placement, passage scoring, and collision
   failure. It explicitly presents an homage whose parameters are tuned.

[Matt Peckham's contemporary firsthand review](https://time.com/4034/no-you-dont-have-to-play-flappy-bird/)
(2014-02-03) corroborates the original's unforgiving rhythm: small upward taps,
rapid descent between them, instant failure at an obstacle, a bright sound and
one point on passage, and a sharp impact sound at death. The compelling beat is
maintaining a simple rhythm, narrowly missing an obstacle, then attempting it
again. This interpretation of the fun is ours, based on that observed play.

[FlapPyBird's archived recreation](https://github.com/sourabhv/FlapPyBird/blob/038359dc6122f8d851e816ddb3e7d28229d585e5/flappy.py)
provides concrete comparison values: 288 by 512, 30 FPS, gap 100, initial pair
spacing 144, flap velocity -9, gravity +1 per frame, and maximum fall velocity 10. Its flap replaces velocity rather than adding to it. Approximately nine
frames to the apex means about 0.3 seconds in that clone; this is a derived
comparison, not a measurement of the original. Separate wing, point, hit, and
death cues reinforce input, success, and failure.

[Bay Tek's arcade manual](https://www.betson.com/wp-content/uploads/wpallimport/files/redemption-service-manuals/flappy-bird-game-service-manual-baytek-games.pdf),
pages 5 and 9, independently confirms one-button flight, passage rewards,
obstacle collision ending play, and vertical gap size controlling difficulty.
Its ticket rewards and configurable lives belong to an arcade adaptation and
are not ported.

Exact mobile-original gravity, impulse, collision mask, and spacing have not
been established. Numeric settings below are explicit PartyBox approximations.
Original music, original audio timings, and an exact-original fidelity claim
are likewise unverified.

## PartyBox design decisions

- Two to eight players fly original gliders through original arch gates in
  independent lanes. All lanes receive the same seeded course and physics.
  The TV shows up to four by two panels so each aircraft and gap remain legible.
- One discrete tap sets upward velocity; holding does not flap repeatedly.
  The large phone button stays within thumb reach. Lane number, player name,
  aircraft shape, and an explicit OUT label identify a lane without colour alone.
- The shell supplies the first ready-up and countdown. The game begins directly
  in play. The default is three rounds, configurable from one to six. Each lasts
  at most 45 seconds and ends as soon as at most one racer remains. An eight-second
  score beat shows gains and totals. Three capped rounds take 159 seconds; six
  take 318, within twice the manifest's three-minute estimate, excluding pauses.
- Last alive wins a round. Each player earns one match point per rival who died
  strictly earlier; simultaneous deaths tie. Survivors at the cap tie and beat
  eliminated racers. Gate counts are public skill progress, not match points.
- A phone-only room, remote player, or spectator receives a local stage. A
  spectator has no input button. Rejoining restores the current lane; physics
  continues during a disconnect and never waits for a missing phone.
- Future gates beyond the visible horizon are omitted from views. Bot flight
  decisions use only the next visible gate, with three skill levels; no seeded
  future-course look-ahead advantage is permitted. Bots sample current state
  through externally polled inputs, without autonomous physics-tick decisions;
  the simulation polls every 100 ms.
- Original drawn art and SDK feedback provide the visual and audio identity.
  There are no copied assets, runtime network requests, or new dependencies.

## Chosen physical model

Coordinates are game units; positive y points down. The viewport is 140 by 100,
the aircraft stays at x 28 with radius 3, and each round begins at y 50 with
velocity -18 units/s. Gravity is 80 units/s², a flap resets velocity to -28
units/s, and downward velocity is capped at 48 units/s. Flaps have a 120 ms
cooldown. In continuous motion this impulse reaches its apex after 0.35 seconds
and rises 4.9 units; those figures are derived from the chosen model.

Gates are 12 units wide with a 38-unit opening and scroll at 26 units/s. The
first starts at x 125 with centre y 50. Subsequent gates are spaced 58 units
apart, approximately 2.23 seconds at this speed. Gap centres remain between
30 and 70, changing by at most 12 between neighbours. The wider opening and
bounded changes make the rhythm approachable on a shared TV without removing
the timing challenge.

## Main fairness and UX risks to verify

1. Equal seeds must produce byte-identical courses across lanes; bots must not
   read unshown future gates.
2. Input delivery must not resurrect a glider after collision. Multiple taps
   within the cooldown, stale events, and simultaneous final crashes need
   explicit checks; array order must not decide the winner.
3. Pause must shift every flight clock, not only the phase deadline. Disconnect,
   resume, and rejoin must preserve the same lane and physics.
4. Eight-player TV art must remain readable, while every 390 by 844 phone stage
   and button fit without play scrolling. Essential flight motion remains
   visible; decorative movement respects reduced motion.
5. Early elimination must communicate OUT, show the surviving racers, and
   reach the next round promptly. Bot reaction quality depends on the host's
   external input polling cadence; the job sim's 100 ms cadence is explicit,
   and the game does not invent autonomous input timing.

See SOURCES.md for provenance and ASSUMPTIONS.md for access and workflow limits.
