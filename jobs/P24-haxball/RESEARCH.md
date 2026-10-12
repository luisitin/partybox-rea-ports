# P24 — Haxball research

Researched 2026-10-12 UTC, before implementation. Required manifest name: **Haxball**;
id and folder: **haxball**. Source identifiers below resolve to URLs and provenance in
[SOURCES.md](SOURCES.md). This is a mechanics study, not a copy of the original game.

## Scope and method

Read the fresh repository README, RULES and JOBS, the game contract and design system,
and the complete Curve Fever reference port (including fixtures and tests). The
owner's name table supersedes the older "Head Soccer" working title. P24 requires
two teams of balls, a puck and two goals, a phone d-pad plus kick, two 90-second
halves, 2–8 total players, bots and phone-only play.

Exa reviewed 29 search candidates across five workstreams: vendor documentation,
independent implementations, contact/kick mechanics, held-kick behavior, and
firsthand published play reports. Seventeen distinct pages were fetched for fuller
inspection. The current official public client was separately inspected transiently
through PowerShell HTTP requests; no original bundle, map, art or audio was saved in
the repository. Only mechanical descriptions are retained here.

The runner team checked all 111 PartyBox monorepo manifests (110 games plus template) before
building. No Haxball or equivalent free-moving team soccer game overlaps. The
closest existing game, Shell Hockey, has fixed paddles and exactly two players;
that does not cover this job's freely moving teams.

## Original mechanics: paired evidence

The second source in each row has an independent author. A fan recreation confirms
the author's interpretation of the original, not the original's exact constants.
Historical Flash-era reviews establish longstanding gameplay, not current browser
compatibility, room limits or networking defaults.

| Mechanic                                                                                                   | Vendor/current evidence                                                                                                                                    | Independent firsthand evidence                                                                                                     | Port consequence                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physics-based soccer with team coordination                                                                | S01 explicitly describes physics and teamwork; S04 has red, blue and spectator roles                                                                       | S14 describes red-vs-blue circle players and configurable team games; S15 reports team strategy after playing                      | Preserve movement, contact, passing and shared team goals rather than individual shot turns.                                                         |
| Four movement directions plus a separate kick; movement and kick can be combined                           | S02 documents WASD and alternate kick keys; S06 current bindings include arrows/WASD and X/Space/Control/Shift/Numpad0                                     | S07 is a player's reproduced diagonal-plus-kick report; S14 independently describes arrows and X                                   | Phone controls must support moving while kicking and diagonal intent. Keyboard alternatives can use arrows/WASD and Space/X.                         |
| The ball is kicked outward from the nearby player's position, not toward an independently aimed cursor     | S06 calculates the player-to-ball direction before applying the kick                                                                                       | S11 explicitly describes proximity kicking in the relative ball direction, identifying this as Haxball behavior                    | Position behind the puck to shoot toward a goal; do not add a separate aim or charge meter.                                                          |
| Circular bodies move, collide and retain velocity; walls and posts affect the ball                         | S03 defines moving circular discs, collision geometry, damping and bounce                                                                                  | S11 documents circle collisions, impulse response and a bouncy ball; S12 independently describes collisions and friction           | Keep inertial movement, readable contact and rebounds. Fresh code should resolve exact overlaps and fast wall/goal crossing safely.                  |
| The ball crossing a team's goal line awards the opposite team a goal                                       | S03 defines goal ownership and crossing; S04 exposes each team's goal total                                                                                | S12 describes scoring into the opposing goal; S14 describes goal targets and configurable score limits                             | Judge goal crossing on the server once, credit the attacking team even after an own goal, then reset for the next play.                              |
| Room duration, score limit, stadium and team sizes are configurable rather than one universal match format | S04 provides time/score/stadium/team setters and team locks                                                                                                | S14 describes different durations, score targets and 2v2/3v3/larger teams; S16 reports room settings and 3v3 play                  | The job's 2 × 90 seconds and maximum 4v4 are explicit adaptations, not claimed original defaults.                                                    |
| Player acceleration changes while trying to kick; physics can vary by stadium                              | S03 distinguishes normal/kicking acceleration and damping; S06 default constructor values confirm normal acceleration 0.1 and armed-kick acceleration 0.07 | S08 has an independent map author's reported default acceleration 0.1, kicking acceleration 0.07, damping 0.96 and kick strength 5 | Preserve a deliberate cost to preparing a kick if held-kick controls are used. These are original-unit reference values, not automatic port tuning.  |
| Kick feedback is an event; excessively rapid inputs are rate-limited                                       | S04 documents minimum logic frames between kicks; S06 loads and plays a kick cue on a confirmed kick callback                                              | S09's player inspected a replay and heard duplicate kick cues; the developer confirms a two-frame default minimum                  | One accepted kick should produce one confirmation; reject duplicate/impossible rapid kicks server-side. Do not count every held input as a new shot. |
| Latency can make displayed contacts or kicks disagree with the eventual state                              | S10's developer explains input prediction and false displayed kicks                                                                                        | S10's original reporter supplies their own play observation; S14 independently reports lag and ghost-ball behavior                 | Server state owns collisions, goals and audible confirmation. Treat smooth visual motion as presentation, never a second scoring simulation.         |

## Additional current-client observations and limits

S06 was fetched from the current `/play` iframe on 2026-10-12. The bundle returned
HTTP 200 and contained 173,175 decoded characters. It was read in memory only.
The following are direct code-reading observations, not measured live-play results;
items without a second independent source remain explicitly uncorroborated.

- Movement intent is normalized when both axes are active. Opposing directions
  cancel. This is a useful fairness model for the port; no independently measured
  original diagonal speed was obtained.
- Kick is edge-armed: a fresh press arms an attempt, holding waits for a nearby
  kickable disc, a successful kick disarms it, and release/repress permits another.
  The attempt uses reduced acceleration while armed. Single-kick-per-hold behavior
  is confirmed by the current bundle only; it is not a claim of a played test.
- Default bodies have player radius 15 and ball radius 10 in original units. The
  checked constructor/serializer ties player damping to 0.96, ball damping to 0.99
  and kick strength to 5. S08 corroborates damping/strength/ball radius, but exact
  feel at phone input cadence remains unmeasured. Do not import the original's map
  dimensions or source algorithm.
- The client uses 60 Hz logic, corroborated by S04's tick API. Goal celebration is
  150 logic ticks (about 2.5 seconds) and the victory beat is 300 ticks (about
  5 seconds) in the inspected code. Those two durations have no second independent
  confirmation and are not binding port deadlines. The score clock increments in
  active play, not that goal reset beat.
- The original has an overtime display and a tied-at-time-limit continuation in the
  inspected match state. This behavior is not independently timed here. P24 can
  end level after its two required halves; do not silently introduce unbounded
  overtime that violates the completion budget.
- The client loads kick, goal, join, leave and chat cues plus a crowd loop. The
  kick callback is paired above; crowd/goal audio character, loudness, envelopes and
  music were not heard or independently verified. No original sound was fetched.

The enabled Cua inventory had no apps or browsers, so no visitor practice session
was available. Root's Python request to `/play` returned 403; PowerShell requests
to `/play`, its iframe and public JS succeeded, while official GitHub and published
sources provided the fallback. No account, live room or stranger interaction was
used. This limits experiential claims, not the availability of enough source
material to build the documented mechanics.

## The recognizable experience

The appeal is a small input vocabulary producing skillful angles, passes, blocks
and rebounds. Teamwork is explicit in S01 and observed in S15; S11's creator sought
the same physics feel and describes supporting teammates. It is reasonable to infer
that a living-room port should make each ball identifiable and each goal direction
obvious, keep all eight players engaged simultaneously, and let coordinated passes
matter. This is a design inference, not an assertion that timing or balance was
measured in a live original session.

## PartyBox adaptation decisions and verification targets

These are requirements or proposed implementation choices, not original facts.
The implemented README must record the actual tuning and behavior chosen.

| Area                        | Required adaptation / design target                                                                                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Match structure             | Two timed halves of 90 seconds of wall-clock match time. The two-second goal/reset beat counts inside the running half, unlike the inspected original; eight-second halftime is separate. End on schedule even with idle players or no goals; tied totals produce tied team results. No extra pre-rules READY screen after the shell's start. |
| Team sizes                  | Support every count from 2 through 8. Seeded fixed teams; the smaller side receives one explicitly named normal-strength helper for odd rosters. This helper is visible and not an SDK participant/results row. SDK bots remain ordinary player seats. Keep team membership fixed through halftime.                                           |
| Goal direction              | Show team name, a distinct mark and attack arrow on every controller. If sides switch at halftime, announce the new arrow in a sufficiently readable beat and retain that direction on the controls. Give each player a stable number/slot on every surface; team color alone is insufficient.                                                |
| TV                          | One large public pitch, large team goal totals, half indicator and a legible clock. Players and puck need clear outlines and numbered identification at distance. Avoid a duplicate shell timer or roster when the pitch already owns them.                                                                                                   |
| Phone with TV               | Large d-pad and a separate large kick button usable together, own number/team/attack direction and current goal totals. Pressed/armed state must be visible. Touch targets ≥44 px with spacing; controls should fit the 390×844 play viewport without scrolling.                                                                              |
| Phone-only and remote phone | Show the same public field above usable controls, scores and own team/number. Spectators get the field and match status without controls. No instruction points toward a TV. Keep both teams' goal directions legible at the phone field scale.                                                                                               |
| Input safety                | Preserve simultaneous direction and kick. Release intent on pointer-up/cancel/lost capture, blur/hidden document, phase change and pause. A disconnect must never leave a mover permanently driving. Reconnect resumes the same seat; a permanent leaver gets watch mode rather than playable return controls.                                |
| Physics                     | Pure, bounded fixed-step updates from event time; deterministic simultaneous contacts; normalized diagonal acceleration; finite positions/velocities; server-only goal judgment. Avoid missed posts/walls or duplicate goals during long timer gaps. Visual smoothing must not trigger cues or decide collisions.                             |
| Bots                        | Three meaningful skills. Predict/approach the puck from behind toward the attacking goal; defend when an opponent threatens; spread teammates to support passes rather than everyone chasing the same spot. Use only public information. S11/S12 show these roles can matter, but their code is not a source to copy.                         |
| Feedback and pacing         | Server-confirmed kick/contact feedback, one goal celebration per goal, clear halftime and final score. Use original PartyBox SDK sounds or fresh synthesis and respectful haptics. Size beats with SDK reading time for all transient words, not the original's short client timers. Keep final result visible.                               |
| Results                     | Goals are a team achievement; rank members of the same team together through SDK team results. Include disconnected/permanent-leaver players in results. Report a level final score honestly, including 0–0 and a VIP early end.                                                                                                              |

Before shipping, the owner runner must exercise eight-player touch control overlap,
phone-only watching, slow-reader halftime text, reconnect/permanent leave, pause and
resume with own physics clocks, contested kicks, goal-line/post boundaries, idle
0–0 endings, odd team counts, and bot spacing. Source review cannot replace those
port checks or the required simulation, mutation, screenshots and CI evidence.
