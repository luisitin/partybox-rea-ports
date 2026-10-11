# Trivia Lightning

## Overview

A self-paced phone quiz with one public race track. Everyone gets the same seeded question order;
each phone shows its own question and four text answers. The TV never broadcasts an active question
or answer. Correct answers score points, streaks build a small bonus, and every three correct answers
earn energy for a three-second freeze or a double score. Most points wins; speed lets you reach more
questions before the shared cap but never changes the value of a fact. Original text and CSS/SVG art.

## Players

2–8. Spectators follow the public track without input controls. Easy/normal/sharp bots use separately
authored factual knowledge and their own question, with increasing recall accuracy; a sharp bot
freezes a leading rival when there is time to catch up, otherwise doubles its next correct answer.

## Phases

| Phase  | TV                                                                                     | Phone with TV                                                               | Exit                                         |
| ------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| race   | Eight numbered lanes, answered count, scores, frozen/disconnected labels, shared clock | Own question/options; immediate verdict, explanation, Next; energy controls | All connected seats finish, cap, or VIP skip |
| podium | Third → second → winner, shared places for ties                                        | Own score/rank and the same revealed podium                                 | Three 4.5 s beats or VIP skips               |
| done   | Winner/tie and final standings                                                         | Final standings and own score/rank                                          | Terminal; shell results available            |

### Phone only

| Phase  | Phone stage                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| race   | Own question and controls plus compact race position; finished players and spectators see the public track |
| podium | The same staged podium, own score/rank, no TV directions                                                   |
| done   | Winner/tie, standings and own score/rank                                                                   |

## Inputs

- `answer { questionId, index, choice }`: exactly once for the current cursor (0–3 choice).
- `next { index }`: clears the previous verdict at the current answered count; advances no score.
- `power { power: 'double' }` or `power { power: 'freeze', target }`: costs one earned energy.
- Unknown seats, spectators, stale cursors, late/duplicate answers, paused or disconnected input are ignored.

## Scoring

Correct = 100 + 20 for each consecutive correct answer beyond the first, capped at +60. Wrong = 0
and resets streak. Double multiplies the next correct award by two; a wrong answer leaves it armed.
Each third correct answer earns one energy, capped at one. Freeze prevents the target answering or
using powers for 3 s, never stacks or extends an active freeze, and never removes points. Equal scores
share the rank (1 + number of players with higher scores), including first place. Finishing early
does not end another connected player's race and gives no extra points.

## Edge cases

- State survives reconnect with cursor, verdict, points and power intact; dropped seats are excluded from the completion gate.
- Permanent leavers retain results and cannot return to input. All seats gone ends the race immediately.
- Timer beats every 500 ms; the visible clock is the race cap. Early/stale timers do nothing.
- At or after the cap an input closes the race without scoring. Unanswered questions score zero.
- Pause shifts the cap, frozen-until times and race clock together; skips while paused use SDK resume ordering.
- No phone can read another player's question/verdict or any answer key. Feedback reveals only a question the viewer has already answered.
- The final answer may close the race directly into podium; the final own verdict stays available in the view.
- Repeated power requests are idempotent without new energy. Finished, offline, self and already frozen targets are refused without spending energy.

## Settings

| Key       | Default | Options                            |
| --------- | ------- | ---------------------------------- |
| pack      | general | General knowledge, Movies, Science |
| questions | 12      | 6–20                               |
| seconds   | 90      | 60–180, steps of 30                |
| powers    | true    | Earned powers on/off               |

## Content

Three packs of 20 original all-ages questions, with four distinct options and short explanations.
`content/schema.ts` exports the compatible `questionPackSchema` shape `{id,title,lang,questions}`;
items are `{id,prompt,options,correctIndex,explanation}`. P01 was unmerged when this job began, so the
pack is defined locally with no cross-game imports. English only.

## Sources

Studied [Wayground live modes](https://help.wayground.com/support/solutions/articles/158000404918-live-session-modes-on-wayground)
and [Blooket mode previews](https://help.blooket.com/hc/en-us/articles/31616660563479-Blooket-Game-Mode-Previews),
with independent observations linked in the job's RESEARCH.md and SOURCES.md. The retained feel is
own-device questions, instant feedback, a live public race, and earned tactical reward beats.
Finite deck, point values, nonstacking freeze and double are PartyBox rules, not source scoring.
No original code, assets, branding, audio or runtime network calls are used. Shared SDK cues and
synthesized music beds supply the sound; see jobs/P03-trivia-lightning for research and verification.
