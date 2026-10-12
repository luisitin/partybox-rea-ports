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

Current P02 implements Teams and Room vote inside the canonical public P01
engine. Wager retains its 1–16-player roster, English/Spanish library,
300-point streak cap and final wager. Classic remains an individual
authored-pack flow. New groups use the same stamped answer packet, shared
view contract and staged podium; their discussion and collective scoring are
additive paths within the existing module.

No original team match was played: no live room PIN/captain account was
provided. Published official screenshots, the firsthand teacher report and
empirical work reconstruct the flow. No original source, questions or assets are copied into runtime; new artwork remains existing original SVG/CSS marks. Attributed published screenshots are retained separately for the required documentation comparison.

## Static fidelity evidence and adaptations

The inspected official host answer-results image is a complete 2876×1576 screenshot: prompt above centered vertical shape/count/check bars, four labeled alternatives below and two correct choices. It is not proof of a team playthrough or current motion/audio/timing. Current P02 uses this chart geometry with its single-correct authored schema, then a separate complete explanation and standings on shared cuts frozen at scoring. The extra explanation is an explicit PartyBox reading adaptation.

The comparison retains four complete original inputs and five matching port captures across four semantic moments. Historical illustrated/two-answer content differs from this authored text/four-choice content; palette, shell, phone/VIP controls and fixed presence/reconnect membership are explicit adaptations. Current agent-reviewed exact-40 captures and bounded maximum authored text support static readability; no owner/live-eight-person or native full-flow claim follows. SOURCES.md and the fidelity REFERENCES/PLAYBACK/GAPS files record primary attribution and limits.

Accepted leaver votes remain in live progress; final Room vote outcomes withhold raw score delta/base/bonus while ordinary shared verdict/own vote remains. Final VIP reading adapts to button text or the longest identity/hint, and conservative SDK full-name question reading is an authoring/accessibility tradeoff even when the strip ellipsizes names or uses faces. Classic/Wager behavior remains canonical.

## Historical standalone implementation

An earlier read-only monorepo comparison found P01 chart/tally/verdict cues
already shipped in T-1117. At that inspection Lightning Round exposed
individual picks and wagers; T-1146 subsequently added wager teams, described
above. The original P02 branch proposed an injected classic adapter and
separate metadata. That adapter belonged to the retired standalone engine;
current P02 integrates directly with the canonical public P01 implementation.
Historical source and verification remain in git b254dd4 and
HISTORICAL_VERIFY.md.
