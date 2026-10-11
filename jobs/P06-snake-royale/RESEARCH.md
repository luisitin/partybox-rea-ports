# P06 Snake Royale research

Research date: 2026-10-11. Mechanics research only; no original code, artwork, audio, or fonts were copied.

## Evidence and access

The official page and its linked public client were reachable from this desktop with PowerShell `Invoke-WebRequest` (HTTP 200). The web search tool returned 502 for the same page. The client was inspected in memory, without saving it into the repository. No headless browser was launched by this research task. This is source inspection and published gameplay research, not a claimed live play-through. Root owns any live browser check.

Independent factual sources include the original developer's App Store description [S1], a Stanford project that collected real online gameplay and human demonstrations [S3], and an NTU study of the original followed by an AR adaptation [S4]. The public browser client [S2] and independent protocol research [S5] provide technical cross-checks.

## Mechanics established by two independent sources

| Finding                                                                                                      | Independent evidence                                                                 | Consequence for Snake Royale                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Eating pellets increases snake length; length is the objective.                                              | S3 introduction and methods; S4 sections 2 and 3.2.                                  | Keep food, growth, and visible current mass central.                                         |
| A head hitting another snake's body dies; large size does not make a snake immune to a small rival's cutoff. | S1 developer description; S3 introduction; S4 sections 2 and 3.5.                    | No mass-comparison eating rule. A small snake can win a cutoff.                              |
| A dead snake becomes food other players can collect.                                                         | S1 developer description; S3 introduction; S4 sections 2 and 3.5.                    | Scatter corpse food along the former body and clearly distinguish it from ordinary food.     |
| Sprinting trades snake size for speed.                                                                       | S3 discussion explicitly observes loss of size with sprint; S4 sections 2 and 3.4.   | Boost consumes mass, stops at a minimum, and cannot be free at that minimum.                 |
| Steering changes heading while forward motion continues.                                                     | S2 input and movement handling; S3 four-action control model; S4 sections 2 and 3.1. | A heading joystick steers an always-moving snake rather than controlling velocity magnitude. |
| Larger snakes turn less sharply.                                                                             | S2 size-dependent angular-speed handling; S4 section 3.1.                            | Bound turning; growth should create a useful long body with a steering cost.                 |

Self-crossing is safe in S4's original-mechanics discussion. S1 describes the lethal contact as touching another player, consistent with this, but does not explicitly describe self-crossing. Keep self-cross safe as the intentional PartyBox rule and cover it directly in tests.

## Boost cost, speed, and collision limits

The official public client sends boost-on or boost-off intent, then receives server-authoritative speed and body-size changes. It does not expose an authoritative boost mass-loss rate or minimum mass. Its onboarding says a longer snake can boost. Default movement constants are replaced by the server's initial setup message; the older independent protocol study confirms this. Consequently neither client defaults nor a clone's numerical rates are evidence for an exact current original boost multiplier or cost.

Do not import S4's half-second loss interval: that number belongs to its AR implementation. Snake Royale's speed multiplier, drain rate, minimum mass, turn rate, and corpse conversion are explicit tuning choices. A roughly twofold boost with a visible continuous mass cost is a reasonable starting point for short cutoffs; test with 2, 4, and 8 players. Showing the minimum and cost on the phone makes the trade understandable.

Precise original head-head ordering is not established by these primary sources. Public discussions disagree and the current browser client delegates deaths to its server. Use symmetric mutual death for simultaneous head-head contact, computed from the same pre-collision step, as an intentional fairness adaptation. Do not claim that this reproduces original arbitration. Test exchanged player order, crossing trajectories, and simultaneous food/death events.

## Structure, pacing, feel, and sound

The original is a continuous online survival/growth session rather than a shared ninety-second party round (S1 longest-of-the-day objective; S3 episodes end at death; S4 describes returning to the lobby after death). Its memorable reversal is a tiny snake cutting across a giant, followed by a sudden valuable food trail: the attack also creates a scramble for the reward. Boost turns that positioning decision into a quick commitment with a visible cost.

The inspected browser client throttles heading transmission at approximately 33 ms and boost changes at approximately 50 ms. These are input-send gates, not measured server tick rates, promised end-to-end latency, or rules to reproduce. Root should judge the PartyBox joystick and boost in a live session. Fixed-step movement and swept collision checks are recommended so a fast snake cannot tunnel through a body.

The inspected browser bundle had no `Audio`, `audio`, or `sound` matches. This does not prove the whole product is silent: the developer's mobile release notes mention updated sounds and music [S1]. No exact sound, music timing, or death-to-replay time was measured. Use original PartyBox feedback if implemented, and keep the important state readable without audio.

## Living-room adaptation

- Three 90-second rounds and current mass at each round end inherit the P05 framing from JOBS.md; they are PartyBox rules, not facts about the original.
- A 2-second automatic respawn keeps all eight guests playing. Reset mass on respawn, keep accumulated round totals, display the return countdown, and choose a safe spawn. This deliberately changes the original death-to-lobby flow.
- Keep the whole arena on the TV. Phones have a large heading pad and a separate hold-to-boost button, usable simultaneously; display name/number, current mass, boost cost, and respawn state.
- In phone-only rooms show the arena on each phone with compact controls; spectators see the arena with no active controls. No text should tell them to look at a TV.
- Use name/number labels and distinguishable body marks as well as colour. Make corpse food larger and shaped differently, so the room sees the payoff from a cutoff.
- Lethal walls, symmetric head-head death, bounded food counts, spawn protection, and exact numeric balancing are documented PartyBox decisions. Teach them in the countdown and verify them directly.

## Implementation watchpoints

Boost should pay for each simulated interval and cease at the minimum even if the button remains held. Clearing a touch, losing pointer capture, disconnecting, and a phase transition must all release boost. Evaluate collisions before applying any death so player iteration order cannot confer immunity. A corpse must generate food once. Disconnects must not pause the timer. Fresh spawns must not occupy an existing body. Final scoring uses actual end mass, including an unconsumed boost cost, and ties share rank.
