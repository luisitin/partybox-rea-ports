# Paper Territory

An original PartyBox map race inspired by the classic browser territory loop. Two to eight players move continuously across one 40 × 28 map. Tap a direction on your phone, leave your land to draw an exposed trail, and return to any of your land to capture the enclosed cells. Cut a rival's trail to send them home. After two minutes, the most owned tiles wins. Everyone has a numbered, protected 3 × 3 home and returns there three seconds after a crash, so nobody spends the match watching.

## Players and pacing

2–8 players, including bots. One 120-second match, a four-second start beat and seven-second map verdict. Manifest estimate: three minutes. No configurable match length; the shared two-minute deadline is part of the race. English only, family friendly, no network calls or external assets.

| Phase | Duration/exit                                                | TV                                                                    | Phone with a TV                                                                                                        |
| ----- | ------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ready | 4 seconds or VIP skip                                        | Numbered homes, player key, start countdown, loop reminder            | Your number and home colour, absolute arrow controls explained                                                         |
| play  | Exactly 120 seconds; physics every 200 ms; VIP skip ends now | Live land, dashed exposed trails, numbered heads, area rail and clock | Four large direction buttons, current direction, tiles owned, vulnerable/safe status; crash cause and return countdown |
| score | 7 seconds or VIP skip                                        | Frozen final map and ranked tile totals                               | Your area and rank, map verdict                                                                                        |
| done  | Terminal                                                     | Winner or shared winners, final map and ranking                       | Your final place and tiles; stage phones keep the public map                                                           |

## Phone-only and remote rooms

| Viewer                              | Stage                                                                  | Controls                                      |
| ----------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| Phone-only player                   | Entire map above the d-pad; same public clock, land and numbered heads | D-pad while alive; return countdown while out |
| Remote player who cannot see the TV | Same map as a phone-only player                                        | Same controls                                 |
| Spectator                           | Public map and standings in every room                                 | None                                          |

The map uses stable player numbers as well as colour, and protected home squares remain visibly distinct. Stage phones do not point at a TV. A local player's reconnect restores the current direction, land and live return timer from server state.

## Inputs and movement

`{ type: 'direction', dir: 0 | 1 | 2 | 3 }`: up, right, down, left in screen coordinates. One tap changes the queued direction; holding is unnecessary. The next 200 ms tick applies it. Opposite directions are rejected against the last judged movement, so two taps before a tick cannot sneak in a U-turn. Spectators, disconnected/permanently departed players, unknown IDs and other-phase inputs do nothing.

Each move is exactly one orthogonal cell. A tick first proposes every live head from the same previous board, then judges deaths, then captures, then lays new exposed trail. Steering received at a tick's exact time first settles that tick and affects the next one. Inputs just before a deadline apply to that deadline. Timers must match the current phase instance and not arrive before its deadline.

## Land, cuts and simultaneous outcomes

- Leaving owned land adds exposed trail cells. Returning to any owned cell closes the trail.
- Closure flood-fills the map from its edges using four-neighbour adjacency. The trail and your existing land are barriers; every unreachable cell plus the trail becomes yours. A diagonal touch does not make a passage.
- Captures can steal rival land, but never another player's protected nine-cell home. An enemy may travel through your home; protection applies to ownership, not heads.
- A head entering any rival's previously exposed trail cuts that rival, even if the rival would close its loop on the same tick. Entering your own exposed trail crashes you (the classic browser variant).
- Leaving the map crashes you. Two heads entering the same cell, or swapping cells, both crash. New trail segments have no seat-order advantage.
- Multiple closures use one post-crash snapshot. Cells claimed by more than one player on the same tick become neutral, including previously owned land; protected homes retain their owner. Every unambiguous claim wins independently of roster iteration order.
- A crash removes all your land outside your protected home and clears your trail. You return after 15 physics ticks (three seconds), unless someone occupies the home centre; then return waits for a free tick. Returns happen after existing heads move, and the player gets a stationary home frame before moving. You never spawn on another head.

## Scoring and bots

One owned tile = one point. The final score is the area at the buzzer, including protected home tiles. Capture totals and crashes are feedback, not bonuses or tiebreakers. Equal area shares rank and first place. VIP skip/end scores the judged map at that event; it does not award future area.

Bots read the same public ownership, exposed trails and head positions. Easy bots attempt short two-cell turns; normal bots use three; sharp bots attempt five-cell turns, watch farther for nearby danger and target reachable enemy trails. They trace rectangular loops, avoid visible walls/self-trails and route home when exposed too long. Seeded bot randomness breaks equally safe turn choices; no hidden knowledge or external planner.

## Edge cases and clock ownership

Pause freezes all physics and return timers. Resume moves `began` and `endsAt` by the exact paused duration while world ticks remain relative. No client decides movement or scoring. A temporary disconnect clears that player's trail and land outside home without adding a gameplay crash; their return runs only after reconnect. A permanent leave/kick never respawns, and stable slot numbers and final results retain their seat. Drops during pause cannot move the map. Host/VIP changes are owned by the SDK. No game phase waits for input from a disconnected player; an all-disconnected room still reaches the timed result.

The state is JSON, bounded by 1,120 ownership cells and unique exposed trail cells per player. Views have no secret gameplay information; public paths, land and scores are intentionally visible to everyone. The server is deterministic and uses only event time; runtime imports are the real SDK. Art is original inline SVG and CSS using PartyBox tokens, numbered markers, dashed trails and reduced-motion support.

## Sources

Read [the job research](../../jobs/P07-paper-territory/RESEARCH.md) and [source register](../../jobs/P07-paper-territory/SOURCES.md) for source-by-source findings. Voodoo's official support and independent browser guides corroborate leave/return/capture/cut. Apple's official mobile version notes say version 4.33 permits self-crossing; older browser guides describe self-trail death. This port deliberately uses the older browser rule. A historical public client was inspected read-only for polygon/cut structure; no code, assets, sounds, names or branding were copied.

The grid, protected homes, fixed movement rate, two-minute match, respawns, head collisions and neutral simultaneous claims are authored living-room adaptations, not undocumented claims about the original. All unknowns are recorded in ASSUMPTIONS.md.
