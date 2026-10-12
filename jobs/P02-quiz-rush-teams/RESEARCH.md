# P02 research

Research preceded the P02 implementation on 2026-10-12. P01's original quiz
research and public engine remain the prerequisite, not a second engine.
The current official team guide was updated 8 October 2026.

Kahoot has two team experiences. Shared-device teams appoint a captain on one
device and discuss for five seconds before answering. Personal-device teams
answer individually and average members' scores on the team leaderboard.
Automatic teams use five seconds; custom lineups can use five to twenty.
The exact timer-to-discussion mapping was not published in inspected sources.
The official guide and an independent firsthand teacher account corroborate
the captain/discussion flow; the personal-device averaging has a separate
independent scoring guide. SOURCES.md gives the paired links.

The shared screen normally supplies the question and options; matching shape
tiles on phones select responses. Current Kahoot can also show all text on
phones. The official display guide and physics teachers' guide show both.
An empirical anatomy study independently records TV/phone play and speed
scoring. Current standard points reach1000; the formula after the initial
half-second is round(1000*(1-elapsed/duration/2)). Current official Kahoot
does not award streak points. The empirical paper's historical streak bonus
must not be presented as the current original. P01's bonus is a PartyBox rule.

Native polls have no right answer or points. A scored collective answer
chosen by phone plurality is therefore an original PartyBox adaptation,
not native Kahoot polling. Its tie, missing-vote and scoring rules must be
explicit. Both variants remain phone-driven; the TV is a read-only stage.

PartyBox design: fixed balanced2–4teams, a locked reading-aware discussion
beat, then individual shape answers whose mean earns team points. Discussion
does not consume speed time. Room vote uses one group, immutable phone votes
and a seeded plurality tie-break. Both preserve answer privacy until reveal,
reconnect, no disconnected-player wait, phone-only stage and final ties.

Kahoot imports authored spreadsheets. P02 instead provides a strict UTF-8
plain-text format, JSON conversion and the existing bounded pack validator;
it does not claim native import-format compatibility.

Resume rechecked the current official team guide and a firsthand teacher account before rebuilding against the published canonical P01 engine. The official guide confirms personal-device averaging and five-to-twenty-second discussion. Current core inspection found T-1146 now ships wager teams, mean scoring and a team podium, while explicitly excluding discussion, room vote and donor packs. Preserve that newer core behavior during future adaptation; the public frozen baseline predates it.

Historical read-only monorepo comparison verified Lightning Round already received
P01's chart/tally/verdict cues in T-1117. It retains1–16players, EN/ES, a
300-point streak cap and wager finale. Its current inputs are individual
picks/wagers at that inspection; the newer T-1146 team addition is described above. P02 is an opt-in upgrade
under that card, with exact injected classic defaults and separate metadata.

No original team match was played: no live room PIN/captain account was
provided. Published official screenshots, the firsthand teacher report and
empirical work reconstruct the flow. No original source, questions or assets
are copied; new artwork remains existing original SVG/CSS marks.
