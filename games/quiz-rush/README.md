# Quiz Rush

## Overview

A fast house quiz: read a shared question, tap one shape, then watch the answer chart and climb
the leaderboard. The shell owns joining, the lobby, rules and the opening countdown; `init`
opens the first question immediately. Every question and its shape assignments are seeded and
shuffled once, identically for all players. Original questions and vector marks; English only.

## Players

2–8, anywhere. Three bot strengths use an authored fact vocabulary to recognize answer text,
with seeded confidence, guessing and response probability. Bots never read the shuffled key.
Spectators see the stage and have no answer controls. Phones without a visible TV are the stage.

## Phases

| Phase    | TV                                                    | Phone with TV                                                    | Exit                                                                           |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| question | Prompt, four shape-coded options, clock, answer count | Four large shape pads; locked-in confirmation                    | All connected eligible seats answered, no eligible seats, deadline or VIP skip |
| reveal   | Correct shape, four answer counts, short explanation  | Correct / wrong / too slow; speed points, bonus, streak and rank | At least 4.5 s and SDK reading floor, or VIP skip                              |
| score    | Eight-seat standings and question gains               | Points, rank, next-question cue                                  | At least 3.5 s and reading floor; VIP skip → next question                     |
| podium   | Third, second, first rank tiers, preserving ties      | Stage reveal cue; no unrevealed final rank                       | At least 2.5 s per occupied tier and reading floor; VIP skip advances one tier |
| done     | Complete final standings                              | Your rank and points                                             | Terminal results                                                               |

The final reveal goes directly to podium. Empty podium tiers are skipped. All phases advance
without a host tap. VIP end keeps credited scores and finishes immediately; it does not score an
unfinished question. Inputs and timers do nothing after done.

### Phone only

`ctx.presence.phoneOnly`, `canSeeTv: false`, or a spectator enables stage information. The
Controller uses `usePhoneOnly()` plus the view's stage flag; it never directs these players to a TV.

| Phase    | Phone as stage                                                                |
| -------- | ----------------------------------------------------------------------------- |
| question | Prompt, clock and four pads with answer text; spectator gets a read-only list |
| reveal   | Your verdict and the answer chart/explanation; spectator sees only the chart  |
| score    | Your points and all eight compact standings                                   |
| podium   | Server-revealed rank tiers only                                               |
| done     | Your result and complete standings                                            |

## Inputs

`{ type: 'answer', round: 1..20, choice: 0..3 }`. The first valid tap is immutable. The round
stamp rejects queued taps from an earlier question. Stranger, spectator, departed, disconnected,
duplicate, pre-opening and out-of-phase taps are ignored. A tap at or after the deadline is too
late. The UI can resend the same unacknowledged choice; it cannot replace that choice.

## Scoring

Correct: `round(1000 * (1 - clamp(elapsed / answerMs, 0, 1) / 2))`, so 500–1000 base points.
Consecutive correct answers add `min(500, 100 * (streak - 1))`. Wrong answers and timeouts give zero
and reset the streak. Speed and streak points are separately visible. Credits happen once on
reveal. Total points determine rank; equal totals share rank and all tied winners are retained.
Final ranks are withheld on phones until their podium tier is public. Current Kahoot has no
streak points: the bonus here is the required PartyBox adaptation, not a claim about its scoring.

## Edge cases

- Refreshing restores the accepted choice, scores and current phase from server state.
- A disconnect closes a completed question immediately; all-disconnected questions skip the
  answer wait. A permanent leave is excluded from later answers, but kept in final results.
- Pauses hold input/timers and shift the deadline and question clock equally. Already stored
  answer elapsed times stay fixed. A drop while paused is rechecked on resume.
- Stale and early timers are ignored. Current deadlines exit every active phase.
- Before reveal, no key, explanation, chart, verdict or other player's selection is sent.
- Phone-only play supports all phases at 390×844; original shape marks distinguish choices
  without relying on colour. Motion uses SDK tokens and respects reduced motion.

## Settings

| Key     | Default | Options                  |
| ------- | ------- | ------------------------ |
| pack    | general | general, movies, science |
| rounds  | 10      | 5–20                     |
| seconds | 20      | 10–30, step 5            |

The seconds setting is a minimum answer window. Every timed screen budgets its visible text with SDK `readingMs`/`wordCount`, including the
phone stage and personal feedback. Standings and podium also reserve their animation settling
time. Answer windows close early once everyone eligible has answered. Seeded 20-question matches
are checked against twice the ten-minute manifest estimate, including reveals and standings.

## Content

Three original packs of 20 questions. `content/schema.ts` validates bounded prompt/option lengths,
exactly four distinct options, one correct index, difficulty and unique question IDs; `packs`
also validates the separate bot vocabulary. That vocabulary is server-only. Content is parsed
once; no runtime network calls, new dependencies, ripped questions, logos or audio.
The movie pack spans 16 films, with eight animated and twelve live-action questions.

The shell sound plan uses a tense question bed, cuts to a quiet reveal, and warms the scoreboard.
Answer verdicts use SDK sound/haptic cues. Original audio was studied as a pacing cue, never copied.

## Sources

Research reconstruction: [RESEARCH.md](../../jobs/P01-quiz-rush/RESEARCH.md) and
[SOURCES.md](../../jobs/P01-quiz-rush/SOURCES.md). Stable pack facts have paired source checks in
[CONTENT_SOURCES.md](../../jobs/P01-quiz-rush/CONTENT_SOURCES.md). Original interactive play was
unavailable; published host/player screenshots and empirical studies corroborated the flow.
Our exact phase timings are deliberate living-room tuning choices. Assets are original SVG/CSS;
no third-party asset licence applies.
