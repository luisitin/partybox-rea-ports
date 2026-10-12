# Haxball

## Overview

Two teams move numbered discs around one public pitch and kick a small ball into the opposing goal.
Phones provide an eight-direction D-pad and a separate held Kick button. Hold Kick to arm one
radial strike when close enough; after firing, release and press again. Holding Kick slows your
acceleration. Most team goals after two halves wins. This port uses original SVG/CSS pitch art
and owned physics tuning, with no original code, branding artwork, audio or runtime requests.

## Players

2–8 participants, seeded balanced team assignment and stable numbered jerseys within each team.
For 3/5/7 participants, the smaller team receives one explicitly named helper disc using the normal
strategy and 200 ms decision cadence.
Helpers are public, never SDK participants or result rows. Easy bots chase the ball with mistakes.
All strengths move into a side lane when an opponent blocks a radial kick. Normal bots divide
attack/defence and line up behind the ball; sharp bots predict further ahead and compare three
goal-mouth lanes. Public disc identities distinguish approach angles without a fixed team bias.
Spectators watch the whole public pitch without controls.

## Phases

| Phase    | TV                                                     | Phone with TV                                       | Exit                                         |
| -------- | ------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------- |
| play     | Public pitch, numbered jerseys, team goals, half clock | Own identity, attack direction, D-pad and held Kick | Half clock, goal, VIP skip/end or empty room |
| goal     | Scoring team and updated score; reset pitch            | Goal announcement and own team; controls disabled   | Two seconds, half cap or VIP skip            |
| halftime | Team goals and switch-ends announcement                | Same public score and new-half announcement         | Eight seconds or VIP skip                    |
| done     | Winning team/draw and final score                      | Team result and retained identity                   | Terminal                                     |

### Phone only

| Phase    | Phone stage                                                                      |
| -------- | -------------------------------------------------------------------------------- |
| play     | Full public pitch above two-thumb controls; own team/number and attack direction |
| goal     | Public pitch and goal announcement; no gameplay controls                         |
| halftime | Team goals and switch-ends announcement                                          |
| done     | Winning team/draw and final standings                                            |

The shell supplies the opening instructions, readiness and countdown; the game begins directly
in play. No phone-only copy points at a TV.

The TV, or each phone-only stage, cues a fresh confirmed goal with the SDK's `cheer`.
It also catches a score first seen after a delayed reset or at the horn. Refreshes,
duplicate updates and pause/resume do not replay goals; phones with a TV leave this cue to it.
The shell supplies playback and mute settings. A player's own confirmed kick uses `thud`.
The latest scorer or own-goal credit remains visible after the short reset, through play,
halftime and the final view. Compact active phones show the scorer's jersey with the full name
in accessible text; halftime still explains the change of attacking ends.

## Inputs

`control { phaseAt, seq, dx, dy, kick }` is one atomic snapshot. Directions are integers −1/0/1;
diagonal input is normalized. `phaseAt` must match the current play instance; `seq` increases
strictly across phases and reconnects. The controller seeds its counter from own `acceptedSeq`.
Heartbeat packets renew a 650 ms lease; release/cancel sends neutral movement. Lost releases,
temporary drops and phase changes clear movement and held/armed kick. Kick arms on a false→true
edge, fires once near contact after a 250 ms cooldown, and cannot rearm from a held heartbeat.

## Scoring

The whole ball must cross the goal line inside the posts. Each crossing scores exactly once for
the team attacking that goal, including own goals; goals are never awarded by the last toucher’s
team. Each original participant receives their team’s goal count in results. Winning teammates
share first place; a draw shares first place across both teams. Helpers receive no result row.

## Edge cases

- Two wall-clock halves default to 90 s each. Two-second goal resets count inside the half.
  New controls at/after the horn cannot act; motion in the final fixed step may still score,
  then halftime/done takes priority over another reset wait. Halftime swaps ends once.
- Fixed 50 ms integration uses capped speeds, circular collision impulses, posts and swept goal
  crossings; 100 ms outer beats limit network/CPU work. Delayed events judge through the cap and
  consume elapsed goal resets/halftime at their actual deadlines, without extending the match.
  Physics state and random assignment are deterministic for the same seed/events.
- Temporary disconnect clears held input and velocity, preserves the seat/position/team and
  allows return. Offline/departed discs are excluded from collisions; overlaps settle on return.
- Permanent leavers retain their team result, return to watching and cannot input again.
- No connected original participant ends the match immediately, including while paused;
  helpers never keep an empty room running.
- Pause settles movement and cancels held input before holding. Resume shifts motion time,
  half/phase deadlines and kick cooldowns; historical kick stamps stay unchanged.
- Play VIP skip ends the current half; goal skip resumes the same half without more clock;
  halftime skip starts half two; VIP end locks the current result from every phase. Ending while
  paused preserves the frozen goals and positions without integrating the pause duration.
- Unknown/spectator inputs, decreasing times, old phase stamps, duplicate sequences, stale/early
  timers and paused input are ignored. The finite half clock also ends idle or all-bot games.
- The entire pitch is public. Other intent, sequence, lease and kick-arm metadata never enter
  TV or foreign controller views; a phone receives only its own bookkeeping.

## Settings

| Key         | Default | Options                         |
| ----------- | ------- | ------------------------------- |
| halfSeconds | 90      | 30–120, steps of 30; two halves |

## Content

No word deck or external content. Public rectangular pitch, original numbered disc jerseys and
one named helper when required. `content/schema.ts` exports an empty `packs` registry.

## Sources

Studied the [official Haxball site](https://www.haxball.com/),
[official input update](https://blog.haxball.com/2010/12/21/fix.html), and the
[official headless API](https://github.com/haxball/haxball-issues/wiki/Headless-Host).
Independent observations, original-client inspection and full source notes are recorded in
`jobs/P24-haxball/RESEARCH.md` and `SOURCES.md`. Retained mechanics are team discs, radial contact
kicks, held edge arming and weaker acceleration while holding Kick. Two timed halves, the local
controller lease, cooldown, helper policy and physics constants are owned PartyBox adaptations.
