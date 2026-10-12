# P22 Tank Trouble research

Research completed before implementation on 2026-10-11. IDs resolve in SOURCES.md. Evidence is
original public client data plus independent authors' descriptions. CUA had no enabled browser;
live play, human timings and audio listening were unavailable and are explicitly unmeasured.

## What carries the game

The shared maze turns each missed shot into a threat that can return around a corner. Steering,
reverse and fire remain separate decisions (I1/I3). Five active shells and ten-second default
expiry bound the basic ammunition pressure (O2/I1). Self-harm makes blind volleys risky (O2/I3).
Random mazes prevent a fixed opening, and a last-survivor finish gives each short fight a clean
payoff (I1/I2). Collectibles replace the gun with a visibly different weapon (O2/I4, corroborated
by I2). These are the paired facts used by the port.

The original currently lists laser, double barrel, shotgun, homing missile, mine and gatling
families (O2). Independent I4 confirms several families but also has remake-specific weapons;
neither its beam nor its fragmentation weapon establishes a current-original requirement.
Rapid fire, a spread shot and a faster beam create different tactical choices (O2/I4).

No human round length is measured. I2's 200 ms firing gap is specific to its implementation.
I3 uses a fifteen-second lifetime and documents corner tunnelling; both illustrate why numeric
clone details should not be silently treated as original rules. Single-source original timing
constants are listed in ASSUMPTIONS.md and are not claimed as observed flow.

## PartyBox flow and pacing

The job fixes a five-round last-tank-standing match for 2–8 seats. The port uses a default
45-second fight cap as an explicit pacing adaptation. Proposed phase sequence:

| Phase | TV                                                                     | Phone with TV                                                                         | Phone-only / remote                                                    | Exit                                    |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| Ready | Whole maze, numbered tanks, short rule and countdown                   | Your tank identity and movement/fire controls explained                               | Same maze above controls, concise rule                                 | Reading-safe countdown                  |
| Play  | Maze is the focal point; tanks, shells, pickup symbols and round timer | Large held steering/movement pad plus fire; visible weapon/ammunition and alive state | Same public arena above a compact pad; spectator arena without buttons | At most one surviving tank, or hard cap |
| Score | Winner or draw, round result and totals                                | Your outcome and next-round cue                                                       | Full result/standings                                                  | Reading-safe automatic transition       |
| Done  | Winner/tie and full final ranking                                      | Your place and total                                                                  | Final stage and ranking                                                | Terminal                                |

Reserve a spawn grace period and enough start time to find a numbered tank. A shot must visibly
leave the barrel before owner damage can apply. Make a wall corner bounce once on each relevant
axis, never enter a wall, and never gain speed. Swept/substepped collision must also stop shells
from tunnelling through tanks between network events. Resolve simultaneous final deaths as a
draw instead of giving the first processed seat a win. These are authored fairness requirements.

Keep ordinary shells bounded at five per owner with ten-second expiry. The server chooses
all maze/pickup randomness from seeded state. A short reload prevents finger spam; its exact
value is a tunable port choice. The selected three readable powerups are Burst (spread shot),
Beam (fast laser family) and Seeker (homing missile family), explicit PartyBox adaptations.
Every pickup needs a symbol, name and clear remaining-use/time indicator. Balance and final
choices belong in the game spec and simulation evidence.

For eight strangers, use connected passages wide enough to reverse, spread spawn cells, and
avoid a wall forest that hides small numbered tanks. Owners' tank numbers and heading arrows
must be readable independently of color. Shells should be conspicuous but never obscure walls.
Eliminated phones immediately become spectators, with the same arena in phone-only rooms.

No score explanation should require a host. Recommended scoring is one round-win point, none
for a draw, with shared final ranks; I2 supplies the survival-point precedent. If the final
implementation uses survival placement or another scheme, label it as a deliberate adaptation.
A bounded fight, brief readable result and automatic next maze keep eliminated players involved.
SDK reading floors apply to instructions/results, rather than artificially delaying live combat.

## Feel and sound

The desirable tension is a visible returning shot: aim, fire, dodge, then celebrate a narrow miss
or self-inflicted knockout. The view needs immediate held-control feedback and a recognisable
heading. Original audio was not heard. I4/I5 establish that its remake distinguishes firing and
bounce sounds; this port can use existing SDK cues for shot acceptance, pickup and round knockout,
with a subdued combat bed and a distinct result cue. Never copy source audio or overplay a cue
for every projectile. Honor mute, pause and reduced motion; arrows, hit markers and text must carry
the same information when sound or animation is absent.

## Verification targets from research

- Ricochets preserve speed, handle corners and can hit the owner after muzzle clearance.
- Five-shell cap, expiry/reload and every powerup remain bounded and deterministic.
- Generated mazes connect all spawn/pickup cells; no trapped seat or pickup.
- Simultaneous deaths, cap draws, pause/resume, late inputs and drop/rejoin have explicit outcomes.
- All supported counts and bot strengths terminate; report median fight and match durations.
- Every stage appears on phone-only/remote/spectator phones with controls only for an active seat.
- Long names, eight tanks, dense ricochets, tied standings and every powerup fit the required screens.
