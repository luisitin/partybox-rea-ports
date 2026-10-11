# Word Guess Race

## Overview

Everyone solves the same hidden five-letter word with six accepted guesses on a private phone board. The TV fills each player's 6 × 5 grid with clue colors and check/arrow/cross marks, never guessed letters. Fewer guesses wins; equal counts compare active solve time. Three rounds build a match score. The shared answer appears for the whole room after each round. This is a new PartyBox game with original editorial content and artwork.

## Players

2–8 players, including bots. English only. Bots have easy, normal and sharp strategies based on their own clue history and the public answer universe, using seeded RNG. A disconnected player is never awaited, and refreshing restores their accepted guess history while a round remains live.

## Phases

| Phase    | TV                                                                                                 | Phone with a TV                                                                                                 | Exit                                                                      |
| -------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `guess`  | Round number, large round clock, all marked/color grids without letters, solve state and attempts. | Your private 6 × 5 board, clue legend, keyboard and submit errors. Once finished, your board and race progress. | All connected players finished, 120 s by default, or VIP skip → `reveal`. |
| `reveal` | Shared answer, round performance, earned points and match standings.                               | Shared answer, your points and standings.                                                                       | 9 s or VIP skip → next `guess`, or `done` after round 3.                  |
| `done`   | Winner or tied winners and final standings.                                                        | Your final place, points and standings.                                                                         | Terminal; `results()` is non-null.                                        |

### Phone only

The room's `ctx.presence.phoneOnly` or a player unable to see the TV makes the phone the stage. `PhoneOnlyProvider` / `usePhoneOnly` follow the reference port; no screen points at an absent TV. While entering guesses the solved-player count is the compact public race progress; once finished the phone shows the public roster.

| Phase    | Phone-only stage                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `guess`  | Your private board and keyboard, clock and compact public race progress. A finished player's board remains visible while rivals continue. |
| `reveal` | Answer, own round points and full standings.                                                                                              |
| `done`   | Match winner, own place and all final standings.                                                                                          |

Spectators see public race progress, reveals and standings without a board of guessed letters or any input buttons. Public clue grids use identical sanitized data on the TV and phone stage.

## Inputs

`{ type: 'guess', word: string, round: number }`, only during the matching `guess` round. The phone handles letters and Backspace locally; submit sends the whole word. The server trims and normalizes case, then requires exactly five ASCII letters in the house dictionary. A wrong length, unknown word or repeated normalized word returns a private error and uses no row. `round` prevents an old phone submit reaching a new round. At or after the deadline the round closes and the word cannot score. Unknown players, spectators and already-finished players cannot submit.

Clue evaluation marks exact positions first, then consumes each remaining answer letter at most once for misplaced matches. Extra copies are absent. For example, guessing `APPLE` against `PLANT` gives misplaced A, misplaced first P, absent second P, misplaced L and absent E. Tile marks and accessible text distinguish the states without relying on color.

## Scoring

Only solved players beat opponents. Solve A beats B when A used fewer guesses, or equal guesses with lower active elapsed solve time. Every solve beats every unsolved player. One point is awarded per opponent beaten, from 0 to 7 per round; exact ties receive the same points. Unsolved players all tie at zero, regardless of attempts or matching letters. Match score adds the three rounds; equal totals share rank.

Example: Ana solves in 3 guesses at 50 s, Ben in 3 at 40 s, Cleo in 4 at 20 s and Dee does not solve. Ben earns 3, Ana 2, Cleo 1 and Dee 0. Speed only breaks equal guess counts. Scores lock once when `reveal` starts; a VIP skip or end never awards the round twice.

## Edge cases

- The seed draws three different shared answers and advances `state.rng`. No view is sent a selected-answer field during `guess`. The phone sees only its own accepted words; the TV and other phones never receive them.
- Solving or exhausting six guesses freezes that board, but does not reveal the word to rivals. Disconnecting preserves the board; reconnecting can continue before the deadline. The round can end when all remaining connected players finish. If nobody is connected, the normal timer closes it.
- Pause freezes input and active solve time. Resume shifts the round's deadline and timing basis so the paused interval does not affect the speed tiebreak. Stale timers and previous-round submits are ignored.
- VIP skip settles the current round as it stands and reveals it; VIP end settles it once and enters `done`. Every starting player, including one who left, appears with a finite final score.
- Invalid guesses cost no attempt. Repeating a word is ignored with a private explanation. The house dictionary is bounded and disclosed; an ordinary English word outside it may be rejected.
- TV stage uses eight grids at 1920 × 1080. Phone play targets 390 × 844 without scroll. Keyboard state retains the strongest clue for each letter. Reduced motion is honored.

## Settings

| Key            | Type   | Default | Allowed         |
| -------------- | ------ | ------- | --------------- |
| `roundSeconds` | number | 120     | 60–180, step 15 |

Three rounds and six accepted guesses are fixed. A round may finish sooner when everyone connected is done.

## Content

`content/words.json` has `lang: "en"`, 260 independently selected all-ages answer words and 1264 accepted five-letter words. Each list is unique, ASCII and lowercase; every answer is accepted. `content/schema.ts` validates those invariants. It is the local house dictionary, not an imported source-game list. No runtime network calls or third-party assets are needed.

## Sources

The five-letter/six-guess flow and positional clues are independently supported by [Hasbro/NYT instructions](https://assets-us-01.kc-usercontent.com/500e0a65-283d-00ef-33b2-7f1f20488fe2/42a6b993-086f-4d9b-a157-65e19931209a/F83480000_INST_Wordle_NYT_I.pdf) and the [Joy of React rule brief](https://github.com/joy-of-react/project-wordle). Duplicate handling is corroborated by that rulebook and the [tutorial helper inspection](https://github.com/joy-of-react/project-wordle/blob/main/src/game-helpers.js). Keyboard and validation behavior were inspected in an [independent public clone](https://github.com/olliebaum/react-wordle). Official live UI access was unavailable; no original timing or sound measurement is claimed. See [job RESEARCH.md](../../jobs/P10-word-guess-race/RESEARCH.md) and [SOURCES.md](../../jobs/P10-word-guess-race/SOURCES.md) for evidence and access attempts. All timings, race scoring, content and visual treatment above are our own PartyBox adaptation.
