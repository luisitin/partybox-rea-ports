# P01 Kahoot! research

Original reconstruction checked 2026-10-11; additive upgrade reviewed 2026-10-12.
This is a mechanics reconstruction, not copied Kahoot publisher code, content or assets.
Source identifiers and direct links are in [SOURCES.md](SOURCES.md).

## Access and method

Read the repository brief, contract, design system and reference port. Tried the original
join, creator and host sites. `kahoot.it` and `create.kahoot.it` exposed only application shells
to the web reader; `play.kahoot.it` required JavaScript. Computer Use reported the in-app browser
unavailable and an empty browser inventory. No original live session was played, and no
stopwatch measurements of its transitions or audio were obtained. The university/chapter
guides include first-hand host/player screenshots, allowing a source-based end-to-end reconstruction.
No account was created, no user's browser session was changed, and no original bundles or assets were copied.

## Original flow and evidence

Each row pairs a publisher's primary account with a separate institution's direct observation
or original research. Historical observations are identified instead of asserted to be current.

| Beat              | Reconstructed behavior                                                                                                                                                | Independent evidence                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Join and lobby    | Host starts a live session; a PIN links players' browsers or apps to that session, and players choose nicknames before the host starts.                               | K1/K2 official guides; I1 PCC and I2 AAPT participant instructions                                                                                     |
| Shared question   | In the classic two-screen arrangement the host carries the prompt/options; the phone is an answer pad. Four choices use distinct shape and colour pairings.           | K3 original official guide; I2 pp. 15-17 recorded host/player screens                                                                                  |
| Answer collection | Players make one choice; the answer beat ends when everyone has answered or time expires. A phone then receives its own verdict, not a preview of other answers.      | K11 publisher help response; I2 pp. 15-17 direct walkthrough                                                                                           |
| Reveal            | The host reveals the correct choice and bars counting the submitted choices.                                                                                          | K4 official illustrated presentation; I2 pp. 15-17 direct screenshots                                                                                  |
| Score beat        | Competitive classic play displays a ranking between questions; final results celebrate a top three. The old manual flow advances through host Next clicks.            | K5 official classic-mode description; I2 pp. 16-17 and I3 institutional walkthrough                                                                    |
| Speed scoring     | Standard correct answers are worth up to 1,000; later correct answers retain about half the base value near the deadline. Wrong answers earn zero.                    | K6 scoring formula; I4 empirical engineering education study, §2.2.1                                                                                   |
| Streaks           | Streak counts remain a feedback device, but current classic scoring gives them no extra points. Older editions awarded a capped bonus.                                | K6 current help and K7 dated publisher announcement; I5 indexed archival protocol documentation corroborates removal. K8 describes the earlier design. |
| Sound             | Countdown music gives the answer window a shared pulse; sound affects the social atmosphere as well as the interface. Exact original tempo/envelope was not measured. | K9 official remote-host guide; I6 original points/audio experiment                                                                                     |

K4's public presentation and I2's screenshots were read for mechanics only; their questions,
illustrations and screenshot pixels are not included in this port. I4 is an original empirical
study, although its description of the formula also cites the publisher; it is corroboration,
not an independent reverse engineering of the scoring server.

## Timing evidence and limits

The current question guide K10 allows quiz answer windows from 5 seconds to 4 minutes;
I2 independently records that range and several selectable durations. These are configuration
limits, not measured transition times. I4 reports a 20-second-window example and describes
an observed mean correct score near 800, equivalent under the documented formula to about
8 seconds. That classroom result is a reference point, not a living-room player benchmark.

K6 additionally documents a full-score exception below 0.5 seconds. Only one independent
publisher was found for that detail; the PartyBox port uses the continuous formula instead.
There is no verified universal original countdown, result-hold or podium duration here.
The timings below are PartyBox choices and must be judged using this port's simulations and screens.

## Historical standalone PartyBox decisions

The following design records the initial Quiz Rush implementation before the owner's 2026-10-12
overlap instruction. Preserve it as research history, not as the specification of the current
canonical `games/kahoot` upgrade. In particular, its 20-second default, 500-point streak cap,
choice shuffling and separate minimum reveal/standings/podium timings are superseded below.

- The PartyBox room shell supplies joining, names, avatars and the start beat. The game begins
  with a question and automatically moves onward; no host Next click is needed each question.
- TV: one large question, a visible answer clock, four numbered shape/options, then a count
  chart with an explicit correct marker. Lock counts reveal participation only, never choices.
- Phone with a TV: four large shape buttons, then a locked-in confirmation. Verdict and score
  arrive only when the shared reveal starts. Colour, shape, number and accessible name reinforce each other.
- Phone only, or a player with `canSeeTv: false`: include the complete prompt/options and the
  public reveal, standings and podium. Spectators see those beats without answer buttons.
- Ship original general knowledge, movies and science packs, twenty questions each, with
  short explanations and one unambiguous correct choice. Shuffle questions and choices from the seed.
- Default ten questions, configurable five to twenty. Default answer window twenty seconds,
  configurable ten to thirty, extended by a reading-time floor when text needs it.
- Close the answer window as soon as every eligible connected player is locked in; disconnected
  seats do not hold the room. Restore the same submitted choice and points on reconnect.
- Reveal holds for at least 4.5 seconds, extended for all visible text. Standings hold at least
  3.5 seconds plus their reading floor. After the final reveal, go directly into podium ranks,
  at least 2.5 seconds per tier, extended for visible text and animation settling,
  then terminal results. Two players usually begin at second; a larger room usually begins at
  third. Empty tiers are skipped, so tied rooms have no blank podium wait.
- Base points: `round(1000 * (1 - elapsed / answerWindow / 2))`, with elapsed clamped to the
  answer window. Wrong/missing answers: zero. A correct streak adds `100 * (streak - 1)`,
  capped at 500; wrong/missing breaks it. Show the bonus separately. This bonus follows the
  binding job brief and is explicitly a PartyBox adaptation of the earlier design.
- Use the existing PartyBox pulse bed, countdown/reveal cues and local verdict feedback,
  respecting mute, pause and reduced motion. No original music, samples or trademarked graphics.

## Current additive adaptation (2026-10-12)

The overlap review identified the existing PartyBox Lightning Round engine as the house quiz.
The owner requires one canonical **Kahoot!** / `kahoot` registration, upgrading that engine rather
than registering the standalone Quiz Rush beside it. Core provenance and the separate host migration
handoff are pinned in `core-base/`; this public branch does not apply the handoff to the owner's checkout.

- Preserve `quizMode: wager` as the default; a saved state with no mode also means wager. It keeps
  the inherited 1–16 seats, requested regular question count plus a hardest-available extra final,
  bilingual wager libraries, preset/custom stakes, awards, recap and minigame configuration.
- Add `quizMode: classic` with the initial sixty original English questions: General Knowledge,
  Movies and Science, twenty per pack. Draw exactly the requested 5–20 questions without an extra
  finale or wager. Questions are drawn repeat-free from the seed; choices stay in authored order.
- Both modes use the inherited regular scoring: 500 base + a rounded 500-to-zero speed component,
  plus 100 per consecutive correct answer after the first, capped at **300**. Wrong/missing resets
  the streak and awards zero. Classic shows speed and streak portions separately. Wager's final
  remains +stake for correct and −stake for wrong/missing, with no regular points.
- Re-read [K6 current official scoring help](https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work)
  on 2026-10-12: it still documents the 1,000-point standard speed formula, the under-0.5-second
  exception and no bonus for streaks. The PartyBox streak bonus follows the job and inherited engine;
  it is an explicit adaptation, not a claim of present-day Kahoot scoring parity. Its continuous
  speed function retains the prior exception decision. Historical K7/K8/I5 evidence remains above.
- Default answer setting is **15 seconds**, selectable 5–30 in five-second steps. The setting is
  a minimum: both modes extend to a reading floor covering prompt/options, names, UI labels and
  any final wager footer. Reading budgets use `round(1.3 × (1500 + 333 × visibleWords))` ms and the
  larger relevant TV/phone word budget. If everyone locks early, retain the words until that floor.
  Keep the original answer close fixed for speed arithmetic; a reconnect can restore that window.
- Wager retains a 15-second betting minimum, also extended for topic, standings and controls.
  Early complete bets hold until their reading floor. Regular wager reveal budgets the race and
  standings; final reveal budgets staged verdict/totals animations; both retain an 8-second minimum.
  These extensions are reading-safety tuning, not measured original timings or new score rules.
- Classic reveal first shows count bars, explicit correct marks and the authored explanation, then
  standings before the next question. Its last question goes from the chart into occupied podium
  competition ranks, descending third/second/first; tied totals share a tier and empty tiers are
  skipped. Chart, standings and each podium tier have independent reading budgets. Final public
  rows/standings and roster scores are withheld until their tier is unveiled, then restored at done;
  each player retains their own total. Autoplay continues; the VIP may advance the reveal.
- Classic phones beside a visible TV receive only the four shape pads during answering. Phone-only
  and `canSeeTv: false` players receive prompt/options and public stage data. Inherited wager phones
  retain their prompt and labelled-choice presentation. Spectators and permanently departed seats
  see the public stage without inputs in either mode. `questionLang` honestly reports English for
  classic independently of the host-controlled `contentLang`; wager retains EN/ES question support.
- Classic answers carry current question id and phase-start stamps. Stale taps, wrong-phase input,
  unknown ids, spectators, permanent departures and repeat submissions are ignored. The phone
  distinguishes sending from confirmed acceptance and can retry the same stamped choice.
- Keep the existing reveal/wager/personal cues and use SDK synthesized beds in the public branch.
  File music and inherited art assets are excluded. No publisher audio, screenshot pixels or assets
  are copied. Reading holds, pause-corrected clocks and reduced-motion handling govern both modes.

The current spec is [games/kahoot/README.md](../../games/kahoot/README.md). The inherited charts and
deadline guards already existed in core T-1117; do not claim them as new upgrade gains. Fresh checks,
mutation evidence, captures and the KEEP GOING audit must validate this additive engine; historical
standalone verification does not prove the upgrade.

## Eight strangers stress review

The main risks are confusing shape-to-choice mapping, a wrong answer being spoiled early,
one absent player creating dead air, streak leaders becoming unreachable, and text outgrowing
the phone. Keep the stable 2×2 pad layout, reveal only on the stage beat, close on connected
submissions, make the capped bonus visible, and use short prompts plus a reading floor.
Test every phase in TV/phone-only/spectator modes, boundary inputs, pause/reconnect and all
three bot strengths. Simulation duration and mutation detection belong in [VERIFY.md](VERIFY.md),
not as an invented measure of the original game.
