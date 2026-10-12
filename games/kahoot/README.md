# Kahoot!

> Preparatory core wager/library base only. No classic mode, verification, host integration or release claim. See the temp root change and migration notes.

## Overview

Speed trivia, four choices per question: faster correct answers earn more, streaks add a bonus, before
the last question everyone wagers part of their score. Highest score wins. The picker's minutes follow the question count: 25 s + 24 s a question + 1 s a player a question (T-1117 adds the answer chart's reading budget). This is the spec.

## Music

SDK reveal/wager and personal verdict cues are retained. Licensed core file music and all art files are excluded from this asset-free temp draft. The original core music plan and provenance remain recorded in `../../provenance/core-README.md`; restoring that host-only track is an integration decision.

## Players

1–16. Late joiners spectate (engine). Disconnected players are not waited for; reconnect → can answer. Bots: welcome (`supportsBots`) — the bot answers from the pack / plays the odds.

## Phases

| Phase      | TV                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Phone                                                                                                                                                                                                                                                                                                                                                                                                            | Exit                                                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intro`    | title card + topic pill                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | "Get ready"                                                                                                                                                                                                                                                                                                                                                                                                      | 2 s title beat (ADR-053: the shell's start stage already showed the rules and counted 3 · 2 · 1; was 9 s) or VIP skip → first `question`                                                                                                                                                     |
| `question` | question + choices A–D in a 2×2 grid, "n / m answered" — every locked-in face pops onto the count line (I-007 A) and the phones still thinking are ringed in the strip until they lock in (B)                                                                                                                                                                                                                                                                                                                                                                                                                                                | `ChoiceGrid`, one tap locks the pick; I-288 B: "+974 now" under the question (`worth`), draining with the speed bonus until the tap; I-789 B (design review): the answers share the height under the question (66 px each, down to their content — four fit an SE), four short ones two by two, sideways question left / answers right; a tap moves nothing (the status line's space is held)                    | every connected player picked, or `answerSeconds` deadline, or VIP skip → `reveal`                                                                                                                                                                                                           |
| `reveal`   | correct choice marked ✓, per player: ✓/✗/–, points, 🔥 streak (a "phone only" room gets the same `rows` on the phone); I-589 A: right answers fastest first, each with its time (`rows[].elapsedMs`, ⚡ on the fastest); B: 2 s on, the rows re-deal into score order (the standings) and — the owner's note — a Next button arrives on the TV (the header's topic slot) and the VIP's phone (`next`: `question`/`wager`; `vipSkipHidden` drops the shell's Skip / Next)                                                                                                                                                                     | same grid with ✓/✗ marks + outcome line; I-288 A: the phone's clock is quiet here and in the intro (bar, no seconds), like the TV's; I-790 C (design review): the verdict is on the tiles (green ring + "✓ the answer", red ring + "you"; a 2×2 tile keeps ✓ / ✗) and one band under the question says it with the two numbers apart — "Wrong · +0 this round · 987 total" (the old card under the list is gone) | time to read every row: 2 s race + 1.3 × (1.5 s + ⅓ s × (answer + 12 + 3 a player)), ≥ 8 s; the final 1.2 s + 1.3 × (1.5 s + ⅓ s × (answer + 2 + 4 a player)), ≥ 8 s (was 8 s / 5 s flat) — or Next / VIP skip → next `question`; after the last regular one `wager`; after the final `done` |
| `wager`    | "Place your wagers", "n / m placed", standings — phone: every wager row carries a stack of gold chips, one per 25 % (I-026 A); a placed pick bumps its chips, the prompt becomes "n in the pot" and the other rows step back (B); on the final question the "Your bet" footer breathes until the answer is locked (C); a fifth Custom row takes a percentage or a points amount (the owner's note); I-550 A: TV and phone name the final's topic before the bet (`finalTopic`: category · topic · difficulty, optional) and — the owner's note — the phone lays the stakes out two by two with a one-line custom row, all on screen on an SE | `ChoiceGrid` of 0 / 25 / 50 / 75 / 100 % of score                                                                                                                                                                                                                                                                                                                                                                | every connected player wagered, or 15 s deadline, or VIP skip → final `question` (flagged `final`, hardest difficulty available)                                                                                                                                                             |
| `done`     | final standings — the shell's results crown one clear winner: face beside the line and `pb-crown` on it (I-025 A), confetti (48 pieces for a person, 16 for a bot — B), and the board under it comes back from 55 % over 1.2 s so the name reads first (C)                                                                                                                                                                                                                                                                                                                                                                                   | rank + score                                                                                                                                                                                                                                                                                                                                                                                                     | terminal: `results()` is non-null                                                                                                                                                                                                                                                            |

Leader mark (I-268): A — the roster's ▲ became a small "1st" tag ("1.º"); B — the same tag on the
reveal rows (was 👑) and the late joiner's bench (was 🏆), none while nobody has scored or all tie;
C — a roster score that goes up shows "+N" over it for 2 s.

Regular reveals also show A–D answer bars beside the muted question: each letter is paired directly with its accepted-pick count, ✓ marks the correct letter, and “No answer” labels missing seats. The chart uses h2 text and 24 px bars at 1080p. Accepted picks still count after a disconnect. Personal correct/wrong cues match the phone verdict beat (300 ms regular / 1.2 s final). The regular reveal budgets ten extra chart words: `max(8 s, 2 s + readMs(answerWords + 12 + 3 × players))`; the final reading rule is unchanged. No extra score or podium phase interrupts the wager finale. The four-question minigame wrapper allows 100 s for the expanded reading budget.

Room line (I-565): B — while choosing, the phone's top line ends "· 4/8 in" and the last one reads "Everyone's waiting on you" (one 40 ms buzz); a phone that is in says "waiting for Priya" (1–2 left).

The final on a phone under 760 px tall (T-0106): the bet sits in the kicker only ("… · you bet 1822"), with no "Your bet" footer in the question and no "The bets are in" footer in the reveal, so all four answers stay on screen; taller phones keep the footer (I-026 C).

## Inputs

`{ type: 'pick', index: 0–3 }` — once per connected player during `question`, at or after opening and strictly before the current deadline. An early or disconnected tap is ignored; a late first tap advances to reveal without recording it (regular: “Too slow”; final: no answer loses the wager). `{ type: 'wager', percent: 0 | 25
| 50 | 75 | 100 }` — once per player during `wager`; amount = `floor(score × percent / 100)` rounded
down to a multiple of 10, equal amounts collapse so a 0-point player only sees (and can only wager) 0;
no input by the deadline = 0. `{ type: 'wager', amount: n }` (I-026, the phone's custom row: a
percentage 1–100 becomes points by the same rule on the phone, points go as typed) — the server clamps
it to 0…score and rounds down to tens (`clampWager`; the whole score is allowed); `amount` wins when
both are sent; bots keep the presets. Later inputs, spectators/unknown ids and wrong-phase inputs are ignored.

## Scoring

Regular question, correct: **500** + speed bonus `speedPoints(elapsedMs, answerSeconds × 1000, 500, 0)`
(500 at 0 ms → 0 at the deadline, so 1000 → 500 in total; `elapsedMs` is measured against the
deadline, a pause costs nothing) + streak bonus 100 × (streak − 1) capped at 300, streak = consecutive
correct answers including this one. Wrong or no answer: 0 and the streak resets to 0. Final question:
correct → **+ wager**; wrong or no answer → **− wager**. **A score can go down here** (never below 0:
a wager is at most the whole score); no base/speed/streak points on the final, the streak counter
still updates. Winners = rank 1 (ties share). Awards (only when someone qualifies; ties → lowest
player id): **Lightning fingers** = lowest average time over correct answers (≥ 1 correct);
**Hot streak** = longest streak (≥ 2); **High roller** = largest wager won on the final (≥ 1).

## Edge cases

- Draw is seeded and repeat-free: same seed + settings ⇒ same questions. A `category` with fewer than
  `questions + 1` items falls back to `all` (`drawnFrom` in state / TV header says which).
- VIP skip: `intro` → question 1; `question` → its reveal (unanswered = wrong; only the final loses the
  wager); `reveal` → next question / wager / done; `wager` → final question, missing wagers = 0. VIP end
  → `done` with scores so far (unrevealed question = 0). Pause holds the deadline; inputs/timers ignored.
- Every phase has a deadline. Everyone idle: all score 0 and tie for first, no awards. 1 player works.

The TV question page is a size container: under 560 px of stage (a sixteen-player roster, four chip
rows) the prompt drops to h2 and the choice cards to 84 px so the count line stays above the host bar
(`capture-lightning-16.ts` proves 16 and 6 players).

## Settings

`questions` number 10 (5–20 step 1, regular questions; the final is extra) · `answerSeconds` number 15
(5–30 step 5) · `category` select `all` (default) or one of the fourteen content categories ·
`subcategories` multiselect (ADR-034): the topics of the chosen category to draw from, comma-joined,
`''` = the whole category; picks outside the category are dropped. The draw uses the ticked topics if
they hold `questions + 1` items, else the whole category, else all (`drawnFrom` / `drawnSubs` in state;
the TV intro says which: "Sports · Basketball, Soccer").

## Content

`content/questions.json` — 6 153 questions across fourteen categories and 63 topics. The ten
established categories hold 460–772 questions each; BL-015 adds 50 each in Board & Card Games,
World Heritage, Museum Collections and Ig Nobel Science, with one 50-question topic per new
category. Each question: `id`, `category`, `subcategory`, `difficulty`, `question`, four distinct `choices`,
`answerIndex`, `source` (J-GPT-005 round 3's 1 500, ids `gpt-0001…1500`, carry a source URL). Widely documented, non-time-sensitive, family-friendly, mainstream
(pub-quiz, not specialist), no question text repeated. `content/schema.ts` enforces ≥ 200 items, ≥ 6
categories, unique ids, and that every topic belongs to its category; `__tests__/content.test.ts`
enforces the balance. The phone never downloads the questions (I-752): the wager arithmetic lives in
`server/wager.ts`, which imports no content (A), and `__tests__/phone-bundle.test.ts` fails if any client
file reaches the content (C).

`content/questions.es.json` (ADR-054) — the Spanish deck a Spanish game deals (Latin American Spanish): 5 561
questions, every English id translated (5 449, same id) or listed in `dropped` (118: questions about English itself or
English-only jargon); 112 of the entries are ES-only `-es` replacements of a dropped item, same topic and
difficulty. The 1 500 `gpt-` questions were translated in T-0270 (41 replaced; review file:
`reports/translate/lightning-round/REVIEW-T-0270.md`). `__tests__/content-es.test.ts` requires every English id to be
translated or dropped and every topic to hold at least 21 Spanish questions.

BL-015 adds 200 matching es-MX twins. Per-question evidence is in
`reports/content/lightning-round-sources.md`; licenses and adaptations are in `content/SOURCES.md`.

T-0703 adds 586 questions from the B13 trivia set (PR #22 job; 15 rows use PR #28's corrections). They are English only, listed in the Spanish deck's `dropped`. Each has a row in `content-pack-origins.json`; publishers and URLs are in `content/SOURCES.md`. Of the set's 1 000 rows, 414 were held back: 190 name another question's answer in the stem, 113 are surplus in templated series (five kept each), 47 duplicate a pack question or another row, 39 would skew a category's topics past the 1.3× balance, 21 are time-sensitive ("as of 2025"), and 4 give away their own answer or a distractor in the stem. Board & Card Games now holds 63 questions. The 63 new near pairs that keep different facts are reviewed in `reports/content/content-pack-duplicate-review.json`.

The unrelated unwired Name Your Baby pack, schema registration and test are excluded from this preparation. The existing core artifact must remain intact in its original repository.
