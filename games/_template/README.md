# Quick Poll (template)

The smallest complete PartyBox game. `pnpm new-game <id>` copies this folder. Every heading below
is required by `pnpm verify`; this file is the game's spec — tests and the stress session treat it
as the truth.

## Overview

Everyone types one word for a prompt; the TV reveals every answer; everyone who answered scores a
point. One round, about two minutes. Interaction type: free text.

## Players

1–16. Late joiners spectate until the next game (engine behaviour, nothing to do here). Bots: welcome (`supportsBots`) — the bot picks a word from the pack.

## Phases

| Phase    | TV                                      | Phone                               | Exit                                                                                |
| -------- | --------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `answer` | prompt + "n / m answered"               | `TextAnswer` (locked after submit)  | all connected players answered, or `answerSeconds` deadline, or VIP skip → `reveal` |
| `reveal` | every answer with its author (`Reveal`) | waiting screen with your own answer | 8 s deadline or VIP skip → `done`                                                   |
| `done`   | all answers + "That's the poll!"        | thanks screen                       | terminal: `results()` is non-null                                                   |

## Inputs

`{ type: 'answer', text: string(1..24) }` — accepted once per player during `answer`. Later inputs,
inputs from spectators/unknown ids and inputs in other phases are ignored (state unchanged).

## Scoring

1 point per player who submitted an answer, 0 otherwise. Ties share the top rank; every winner is
listed in `winnerIds`. No awards.

## Edge cases

- Everyone idle: the deadline reveals an empty list; everyone scores 0 and all tie for first.
- A disconnected player is not waited for; if they reconnect before the deadline they can still answer.
- VIP skip in `answer` still shows the reveal; VIP end goes straight to `done` with whatever was scored
  (answers submitted so far count).
- Pause holds the deadline; inputs are ignored while paused.
- 1 player: works (answers → reveal → done).

## Settings

| Key             | Type   | Default | Range        |
| --------------- | ------ | ------- | ------------ |
| `answerSeconds` | number | 30      | 10–90 step 5 |

## Content

`content/words.json` — one prompt and ≥ 10 words the bot picks from. Validated by
`content/schema.ts` (`packs.words`). Family-friendly.
