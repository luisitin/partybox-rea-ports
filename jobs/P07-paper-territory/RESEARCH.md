# P07 research: Paper Territory

Research date: 2026-10-11. The subject is Paper.io 2's land-capture loop. The
PartyBox game is **Paper Territory**. Mechanics are studied; code, artwork,
branding, sound files, skins and progression content are not copied.

## Sources and method

Read Voodoo's official support rules, publisher page and App Store release notes;
CrazyGames' independent browser-play instructions; QubicGames' Nintendo listing;
and Olin Olmstead's firsthand 2018 gameplay analysis. Read independent clone
authors' descriptions to compare geometric approaches without taking their code.
The evidence table below pairs independent publishers for the adopted core facts.

The historical `paper-io.com` URL now redirects to Voodoo's product landing page.
A public mirror at `paperio.site` still serves an inspectable browser client.
Its ownership and relationship to the current official mobile game are not
verified. Treat it as an observed historical build, not an official current spec.

The installed computer-use surface was previously checked during this runner
session: visible in-app browser creation returned “Browser is not available:
iab” and inventory returned no browsers or apps. No live original play session,
multiplayer race or audio playback is claimed. No browser was launched for P07.

## Corroborated core loop

| Fact                                                                     | Primary/product source                      | Independent source                                         | Port consequence                                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Begin with a small owned patch. Leaving it produces an exposed trail.    | Voodoo support rules                        | CrazyGames instructions; firsthand Game Developer analysis | Show owned cells as filled land and unfinished trails as thin, clearly exposed paths.       |
| Capture happens on reconnecting to your own land, after enclosing space. | Voodoo support rules                        | CrazyGames instructions; QubicGames' Nintendo description  | A return to any own cell closes the excursion. Simply crossing the trail is not a claim.    |
| Another player's contact with an exposed trail eliminates its owner.     | Voodoo support rules                        | CrazyGames instructions; Nintendo description              | Cutting is a collision with a trail, not a requirement to hit the moving head.              |
| Opponent land can be traversed and claimed.                              | Nintendo description supplied by QubicGames | CrazyGames instructions                                    | Land changes owner when a valid capture encloses it, subject to PartyBox's protected homes. |
| Expanding more aggressively also leaves the trail exposed for longer.    | Voodoo support's exposed-trail rule         | CrazyGames strategy instructions                           | Prefer many small safe loops when rivals are nearby; big loops should be visibly risky.     |
| Total covered area is central to victory.                                | Voodoo support's full-map objective         | CrazyGames full-map FAQ; firsthand gameplay analysis       | The living-room match ends at a fixed buzzer and ranks current owned area.                  |

The last column is design, not a claim that the original has PartyBox's timers,
grid, head-collision policy or respawn rules.

## Version split: own-trail contact and map edges

Older browser instructions on CrazyGames and FastFun describe fatal contact with
your own unfinished trail. Voodoo's official App Store version 4.33.0 notes,
dated June 13 in its 2026 sequence, explicitly changed own-trail crossing to
nonfatal. This is a single-publisher release-note observation; a second independent
current mobile playtest was unavailable. The year is inferred from the release-history sequence following its
dated December 2025 entries. The current mobile behavior must not be described
as universally identical to the older browser behavior.

PartyBox deliberately keeps **classic browser-style own-trail death**: the
instruction is simple and every unfinished path is visibly dangerous. This is an
authored variant, with the differing mobile rule recorded here and in the spec.

The 2018 firsthand analysis describes free-direction movement in a round arena,
safe wall contact, continuous movement, percentage gains and a leader crown.
Its run to 48% reportedly lasted about ten minutes. Those are historic observed
features, not current timing measurements. PartyBox instead uses four directions,
a rectangular grid, fatal walls and a 120-second match. The arena border must look
dangerous so players are not punished for applying the older edge-hugging tactic.

## Read-only public client inspection

URL: `https://paperio.site/app2.js?v7`. The retrieved client text was 239,952
characters and identifies itself as build `A6 2020-10-14T10:51:36.392Z`.
It has a simple rotated string table; lookups were resolved in memory for reading,
without executing the client or placing it in the repository.

Single-source observations from that mirror:

- It represents territory as polygons, records boundary crossing points and
  handles a return to the owning territory separately from rival-territory entry.
- Return processing combines the excursion with existing boundaries to construct
  a capture. It is not a rule that every path's bounding rectangle is painted.
- Intersection handling contains overlap and segment-end exclusions; naive
  “every endpoint touch kills” would not reproduce its geometric handling.
- Elimination removes both the exposed track and the owned polygon. This
  corroborates the historical analysis's loss-of-land description.
- Its rendering and scheduling are browser-owned; they are not suitable for the
  pure PartyBox game contract. The delivered server uses events and state data.

These observations do not establish an authenticated client version, exact
simultaneous collision outcomes, numerical movement speed or network semantics.
No mirror runtime, skin, font or image is reused.

## Feel and presentation

The main tension is an unfinished loop: the player can see a reward taking shape,
but must get home before another head reaches their line. Successful closure
needs an immediate, legible fill and a small “+area” confirmation. The race becomes
more confrontational as nearby territory grows; the shared TV makes those threats
visible to all players. This is our design interpretation of the supported rules.

The historical firsthand analysis describes area-gain feedback, a crown for the
leader and a staged death reveal. Current App Store notes also advertise updated
capture messages and clearer territory outlines. PartyBox should give each
capture and cut a readable visual beat, label the leader and use existing SDK
cues. No original sound has been listened to or measured, so exact sound design
or rhythm is not claimed.

## Explicit PartyBox geometry and simultaneous rules

Public official rules do not settle corner-only adjacency, overlapping captures,
head swaps, a trail cut on the return tick or how disconnected land is treated.
Independent reimplementations differ: one describes grid edge flood-fill and
score-based head collisions; another uses polygon candidates. They are examples
of implementation choices, not proof of Voodoo's rules.

The following are the runner's authored specification, to be pinned by tests:

| Situation                                                           | PartyBox result and reason                                                                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Returning to own land                                               | Close the current excursion; add the trail and enclosed cells using four-neighbor flood-fill. The renderer shows the judged cells, not a separate visual approximation. |
| Crossing an unfinished own trail                                    | Eliminate the player, using the chosen classic browser variant.                                                                                                         |
| Rival crosses a trail while its owner returns home on the same step | Cuts are evaluated before captures. A cut player cannot rescue the turn by capturing on that step.                                                                      |
| Several players reach one head cell, or swap head cells             | Eliminate the colliding players together. Resolve from the same step's positions so player iteration order does not decide the winner.                                  |
| Two valid captures enclose the same cells on one step               | Contested cells become neutral; the protected-home exception still applies. Neither array order nor player id gets priority.                                            |
| A diagonal corner or a one-cell channel                             | Reachability uses edge neighbors only. Tests should distinguish an open one-cell channel from enclosed cells and must not substitute eight-neighbor fill.               |
| A path encloses rival territory                                     | Claim the eligible enclosed cells; a rival's permanently protected home remains theirs. No bounding-box shortcut.                                                       |
| Reaching the outer wall                                             | Eliminate the player. The boundary is drawn and described as dangerous.                                                                                                 |
| A normal cut/death                                                  | Remove expanded land and exposed trail, retain the fixed 3×3 protected home, and respawn after three seconds.                                                           |
| Passing through another home                                        | Traversal is permitted. Captures cannot steal that protected patch.                                                                                                     |
| Disconnect                                                          | Remove the player's expanded land and active trail, without adding a death statistic. A return can spawn the player again; a permanent departure cannot.                |
| The buzzer                                                          | At 120 seconds rank current owned tiles. An unfinished excursion contributes no enclosed land.                                                                          |

Required focused examples include: a rectangle; a concave excursion; a trail
returning at a different boundary point; two successive captures; an excursion
with no enclosed interior; narrow channels; every edge of the arena; a cut and
closure on one step; two simultaneous cuts; three heads in one cell; a head swap;
overlapping captures; protected homes inside a loop; all players dead; reconnect;
and inputs arriving after the buzzer. The world must replay identically when time
is advanced in a single event or equivalent smaller steps.

## Living-room adaptation

| Phase  | TV                                                                    | Phone with TV                                                                 | Phone-only room                                                                              |
| ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Ready  | Whole arena, named home patches, simple trail/return/cut instructions | Own marker and the four direction controls explained                          | Arena, instructions and own marker; no instruction to find a TV.                             |
| Play   | Shared map, heads, exposed trails, area standings and a large timer   | Four large direction buttons, own area and current safe/exposed/respawn state | The same arena above large direction buttons; spectators receive the stage without controls. |
| Result | Frozen map, winner/ties and final areas                               | Own result and final area                                                     | Frozen map and compact standings.                                                            |

Names and slot markers must identify players as well as colours. Own land,
unfinished trails, protected homes, dead heads and the arena wall need different
shapes or line treatment. An eliminated player gets a visible three-second return
countdown instead of two minutes of watching. Movement continues until direction
changes; tapping should select a direction without requiring a held finger.

Bots should build short, safe rectangular excursions, shorten them when an enemy
can intercept, and attack reachable exposed trails when they can return safely.
Three strengths can tune planning horizon, loop size and willingness to chase.
They have the same public board as humans and no secret information. All tuning
values and final UI behavior belong in the delivered game's README, and measured
termination/round lengths belong in VERIFY.md.
