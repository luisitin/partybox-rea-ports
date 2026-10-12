# Tank Trouble

## Overview

A five-round maze tank battle. Drive, reverse and turn on a phone pad, then hold Fire
to send shells ricocheting through a connected maze. Your own returning shots can hit
you. The TV is the shared stage. All tanks carry a number and heading beyond their color.

## Players

2-8, including bots. Easy, normal and sharp bots navigate public passages, seek rivals,
judge firing lines and avoid returning shots with different reaction and aiming strengths.
Spectators watch the stage with no controls.

## Phases

| Phase   | TV                                                                 | Phone with TV                                                          | Exit                                                         |
| ------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `play`  | Shared maze, numbered tanks, shells, weapon crates and round clock | Your tank, held movement/turn pad, Fire and weapon/ammunition feedback | Last survivor, mutual elimination, 45-second cap or VIP skip |
| `ready` | New maze and tank identities between rounds                        | Find your tank, concise next-round status                              | Reading-safe automatic start or VIP skip                     |
| `score` | Winner/draw and round point, brief automatic countdown             | Your round gain, current rank and total wins                           | Reading-safe next maze, or done after round five             |
| `done`  | Winner/tie, final maze and all standings                           | Your final rank and points                                             | Terminal                                                     |

The first round starts after the shell's instructions and countdown; later mazes have an
identification beat. Results never wait for input. Pausing holds every combat clock.

### Phone only (no TV)

Remote players (`canSeeTv: false`) and phone-only rooms receive the same public stage.
Nothing directs them to a TV. A temporarily eliminated player keeps watching the action.

| Phase   | Phone-only / remote                                                           |
| ------- | ----------------------------------------------------------------------------- |
| `play`  | Full-width maze above your pad; spectators and eliminated players have no pad |
| `ready` | New maze, numbered identity and next-round status                             |
| `score` | Public winner/draw plus your current rank, round gain and total wins          |
| `done`  | Final maze and full tied ranking                                              |

## Inputs

`{ type: 'control', drive: -1 | 0 | 1, turn: number, fire: boolean }` in play.
Drive is reverse, stop or forward; turn ranges from -1 to 1. Drag one thumb on the
steering pad: corners combine drive and turn, the center stops, and a second thumb holds
Fire. Five real buttons also support keyboard focus, arrows/WASD and Space/Enter.
Releasing/cancelling, hiding the phone, pausing or
losing eligibility releases controls. A short server lease also expires a lost held message.
Only connected living roster seats act. Refresh restores the current seat, not a new tank.

## Scoring

One point for the sole survivor; zero for simultaneous final elimination or a time-limit
draw with multiple tanks alive. Five rounds, then the most points wins. Equal totals share
ranks, including a match in which no round had a winner. Results retain every initial seat.

## Edge cases

- Physics advances on a fixed judging grid, not rendering frames. Ricochets preserve speed;
  owner damage begins after muzzle clearance. Every active shell has a bounded life/count.
- Burst has two three-shell volleys. Its next volley waits until three of your five shell
  slots are free; the phone explains the wait and holding Fire shoots when capacity opens.
- The sole survivor locks when the final rival is eliminated; later shells cannot erase a win.
  All hits on a judging sample resolve before a winner is chosen.
- A completed fight is scored before a late departure or pause can change its survivors.
  Presence still updates for reconnect and the next maze; pausing holds the result beat.
- A drop releases held movement/fire. A permanent leave eliminates the tank and removes it
  from later rounds; returning after leaving is a spectator. A temporary reconnect continues
  the same tank if it survived. No disconnected player blocks a phase.
- All combat information is public. Every controller carries the current arena; phones beside
  a TV use a focused pad while remote, phone-only and spectator phones draw the stage. No private
  state or future seeded plans leak.
- VIP skip scores the current fight as it stands. VIP end ends with already earned points.
  Late/stale timers and unknown player inputs cannot advance combat.

## Settings

| Key        | Type    | Default | Meaning                                            |
| ---------- | ------- | ------- | -------------------------------------------------- |
| `powerups` | boolean | true    | Enable seeded Burst, Beam and Seeker weapon crates |

Five rounds and the fight cap are fixed so the party knows its match length.

## Content

No word packs. Mazes, spawns and pickups use seeded RNG. All graphics are original inline
SVG and CSS; all colors, type and motion use PartyBox tokens. Controls and labels are English.
Sound uses existing SDK cues; reduced motion retains all information.
PLAY poses and tank numbers transition together over the snapshot cadence; pause and
reduced motion show exact poses. The decisive knockout requests one TV cue and the
eliminated phone's loss buzz; paused departures and later results do not replay it.

## Sources

Studied the [original product](https://tanktrouble.com/) and its public bundle, then paired
core facts with independent authors' [Aman Pasricha](https://github.com/amanpasricha/Tank-Trouble)
and [Ethan Baker](https://github.com/ethanbaker/tank-trouble) implementations. Five shells,
ten-second lifetime, maze ricochets, owner damage and survival rounds have paired evidence.
The five-round 2-8-player flow, 45-second cap and three selected weapons are PartyBox tuning.
Live play/audio were unavailable; no timings are claimed as observed. Detailed evidence and
access limits: [RESEARCH.md](../../jobs/P22-ricochet-rumble/RESEARCH.md),
[SOURCES.md](../../jobs/P22-ricochet-rumble/SOURCES.md), [ASSUMPTIONS.md](../../jobs/P22-ricochet-rumble/ASSUMPTIONS.md).
No original code, audio or artwork is shipped.
