# P01 Quiz Rush research

Checked 2026-10-11. This is a mechanics reconstruction, not copied code, content or assets.
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
publisher was found for that detail; Quiz Rush deliberately uses the continuous formula instead.
There is no verified universal original countdown, result-hold or podium duration here.
The timings below are PartyBox choices and must be judged using this port's simulations and screens.

## PartyBox decisions

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

## Eight strangers stress review

The main risks are confusing shape-to-choice mapping, a wrong answer being spoiled early,
one absent player creating dead air, streak leaders becoming unreachable, and text outgrowing
the phone. Keep the stable 2×2 pad layout, reveal only on the stage beat, close on connected
submissions, make the capped bonus visible, and use short prompts plus a reading floor.
Test every phase in TV/phone-only/spectator modes, boundary inputs, pause/reconnect and all
three bot strengths. Simulation duration and mutation detection belong in [VERIFY.md](VERIFY.md),
not as an invented measure of the original game.
