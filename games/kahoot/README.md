# Kahoot!

## Overview

A speed quiz upgrading PartyBox's existing Lightning Round engine. `quizMode: wager` remains the
default (including old states without a mode); `classic` adds shape-pad play and a staged top three.
Joining, room codes, names, lobby and the start countdown belong to the PartyBox shell.

## Players

1–16 players; the P01 living-room target is 2–8. Late joiners spectate. Temporary disconnections
do not hold answer collection; reconnect restores the accepted choice and the current beat.
Permanent departures retain their scores but cannot submit again. Spectators receive a read-only stage.
Bots have easy/normal/sharp strengths: 30/50/80% known-answer rates, seeded wrong choices and preset bets.
Classic bots use a separate learned-answer-text map; no question library is downloaded by phones.

## Modes

| Mode      | Questions                                                          | Ending                                     | Phone beside a visible TV                                         |
| --------- | ------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------- |
| `wager`   | Requested regular count plus one hardest-available final           | Bet, final reveal, results                 | Prompt and four labelled choices                                  |
| `classic` | Exactly the requested count from one authored pack; no extra final | Last chart, occupied podium tiers, results | Triangle, diamond, circle and square pads; no prompt/options text |

## Phases

| Phase      | TV                                                                                                                                                                        | Phone                                                                                                                      | Exit                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `intro`    | Title and selected pack/topics                                                                                                                                            | First-question notice                                                                                                      | Reading budget; wager also has a 2 s minimum                                                             |
| `question` | Prompt, four choices, clock and connected lock count                                                                                                                      | Mode's answer pad; one accepted choice locks                                                                               | All connected participants answered after the reading hold, answer deadline, or VIP skip                 |
| `reveal`   | Classic: answer-count chart, explanation, then standings except on last question. Wager: chart and fastest-correct race, then standings; final shows bets/verdicts/totals | Correct/wrong/too slow, delta and total; classic separates speed and streak points and shows rank before the last question | Reading budgets, or VIP Next/skip; classic last → podium; wager last regular → wager; wager final → done |
| `wager`    | Final topic/difficulty, placed count and standings; no wager amounts                                                                                                      | Preset shares or custom percent/points; personal bet receipt                                                               | All connected bets after the reading hold, max(15 s, reading budget), or VIP skip                        |
| `podium`   | Classic only: occupied ranks descending 3 → 2 → 1                                                                                                                         | Public tiers on staged phones; otherwise reveal notice and personal rank once unveiled                                     | Each tier's reading budget or VIP skip; empty tiers skipped, then done                                   |
| `done`     | Complete final standings and shell results                                                                                                                                | Personal rank/score; staged phones also show standings                                                                     | Terminal; `results()` is non-null                                                                        |

Classic's last reveal omits public final rows/standings and roster scores. Podium payloads contain
only already unveiled top-three tiers; full standings return at `done`. Equal scores share competition
ranks, including podium ties. Phones retain their own total; they do not receive unrevealed rivals' totals.

## Phone-only and remote play

`ctx.presence.phoneOnly` is captured at init; `canSeeTv: false` also gives that player the stage.
Clients honour the SDK `usePhoneOnly` context. Staged players never receive “look at the TV” instructions.

| Beat           | Phone-only/remote player                                         | Spectator or permanently departed player                     |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Intro/question | Title notice; complete prompt/options and controls               | Public title/question/options, without controls              |
| Reveal         | Personal receipt; classic chart/standings; wager per-player rows | Public chart, rows/standings and explanations as appropriate |
| Wager          | Stakes controls and topic; missing bet defaults to zero          | Topic, rules and standings; no stakes controls               |
| Podium/done    | Unveiled tiers, then full board; personal rank/score             | Same public stage, without personal controls                 |

## Inputs

- Wager answer: `{ type: 'pick', index: 0..3 }`.
- Classic answer: `{ type: 'answer', questionId, questionStartedAt, index: 0..3 }`; both stamp fields
  must match the current question. Old-question/old-entry taps and unstamped picks are rejected.
- Bet: `{ type: 'wager', percent: 0|25|50|75|100 }` or `{ type: 'wager', amount }` (integer points,
  0–1,000,000 before clamping); `amount` wins if both are supplied. Custom percentages become points
  on the phone. Stakes below the whole score round down to tens; an all-in stake keeps the exact score.

Only the first connected participant input in its phase is accepted, at/after opening and strictly
before the original answer/bet deadline. Unknown ids, spectators, departed seats and duplicates are
ignored. Late first inputs advance without acceptance. Classic shows sending/confirmed states and
allows a same-choice retry when confirmation is missing; server acceptance remains one choice.

## Scoring

Every regular question (and every classic question): correct = 500 + a rounded 500→0 linear speed
bonus over the actual answer window + `min(300, 100 × (streak − 1))`. Thus base/speed is 1,000→500;
the streak includes this correct answer. Wrong/missing = zero and resets the streak.
Wager final: correct = +bet; wrong/missing = −bet; no base/speed/streak points. This is the only score
decrease, never below zero. Missing bet = zero. Scores are applied once, on reveal entry.
Highest score wins; ties share rank 1. Qualified awards: Lightning fingers (lowest average correct
time), Hot streak (longest streak ≥2), High roller (largest final bet won ≥1). Award ties use lowest id.

## Pacing, sound and edge cases

Reading budget = `round(1.3 × (1500 + 333 × visibleWords))` ms, counting the larger relevant TV/phone
screen, names and UI labels. Both modes use `max(answerSeconds × 1000, question reading budget)`.
All-answered/all-bet locks shorten the phase only to its reading hold; the original end remains the
speed-scoring window and can be restored for an eligible reconnect. Classic chart/standings and each
podium tier have separate reading budgets. Wager reveals budget race/standings or final animations,
with an 8 s minimum. VIP Next appears during the reveal beat; timers advance without a host click.
Pause ignores inputs/timers, freezes client clocks and shifts deadline/scoring clocks on resume.
VIP skip advances the current phase; missing picks score zero (or lose a final bet). VIP end enters
done with already revealed scores. Idle games terminate with tied zero scores; absent seats do not block.
Seeded draws do not repeat questions; option order stays as authored. Wager topic/category shortages
fall back to the broader category then all, and the displayed draw label records the fallback.
SDK pulse/reveal/wager/result cues and synthesized beds respect device settings. Verdicts wait for
the shared reveal beat. Token-based shapes, marks and words accompany colour; reduced motion is honoured.

## Settings

`quizMode` wager/classic (default wager); `classicPack` general/movies/science (default general);
`questions` 5–20 (default 10; regular count in wager, exact count in classic);
`answerSeconds` 5–30 step 5 (default 15; requested minimum); wager `category` all or 14 categories,
plus comma-joined `subcategories` (empty = all topics; out-of-category topics discarded).
Classic always uses English questions (`questionLang: en`), independently of host `contentLang`.
Wager retains EN/ES content selection. The inherited 100 s minigame sets wager, four regular questions
and a 5 s requested answer minimum; reading budgets still apply. Manifest estimate: 26 minutes;
the adjustable estimate grows with question and player counts. Small classic matches are faster.

## Content

Classic: three original English JSON packs of 20 questions, validated by `content/classic-schema.ts`
and exported through `content/schema.ts`; unique ids, four distinct options, explanation, difficulty.
Wager: `questions.json` has 6,153 items across 14 categories/63 topics; `questions.es.json` has 5,561
items and 704 explicit dropped English ids. Library ids, translations, source notes and attribution
are preserved. Content loads only on the server. Recap retains question choices, picks/times/deltas,
final bets, standings and awards. Per-phase fixture states live under `fixtures/`.

## Sources

[P01 research](../../jobs/P01-quiz-rush/RESEARCH.md) pairs official guides with independent screenshots
and studies; original live timing was unavailable. [Current scoring help](https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work)
has no streak points: this port's 300-point bonus is intentional; it also omits the original sub-0.5 s exception.
[Source matrix](../../jobs/P01-quiz-rush/SOURCES.md), [classic fact references](../../jobs/P01-quiz-rush/CONTENT_SOURCES.md),
[library licences](content/SOURCES.md) and [pinned core provenance](../../jobs/P01-quiz-rush/core-base/SOURCE.json)
record origin and limits. Art is authored inline SVG/CSS; inherited file art/licensed music are excluded.
[Core host migration](../../jobs/P01-quiz-rush/core-base/HOST_MIGRATION.md) is a handoff, not an applied core change.
