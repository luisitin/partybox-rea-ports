# Draw and Guess

## Overview

One artist picks a secret word and sketches with a finger. Everyone else races to
type it. The shared picture stays on the stage; guesses and near misses stay
private. Original mechanics inspired by skribbl.io and Gartic.io, with original
content and art. English only; Arcade category; no runtime network requests.

## Players

2–8 players, spectators and three bot strengths. Each connected player draws once
per rotation in a seeded order. Bots infer words from the public letter mask,
recognizable original sketches and their own previous attempts. They never read
the answer as guessers. A bot artist knows its own word, as a human artist does.

## Phases

| Phase  | TV                                          | Phone with TV                                                         | Exit                                                       |
| ------ | ------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| choose | Artist's name and turn                      | Artist picks 1 of 3; others wait                                      | 12 s auto-pick, selection, VIP skip                        |
| draw   | Live picture, blanks, solved players, clock | Artist canvas/tools/secret; others guess and receive private feedback | 45–75 s, everyone connected solves, drawer drops, VIP skip |
| reveal | Answer, frozen picture, gains and totals    | Answer and own gain                                                   | At least 7 s plus SDK reading budget, then next artist     |
| done   | Final standings and shared winning ranks    | Own place and final standings                                         | Terminal results                                           |

### Phone only

| Phase  | Phone without TV / remote phone                                              |
| ------ | ---------------------------------------------------------------------------- |
| choose | Artist's private choices; other phones identify who is picking               |
| draw   | Live sketch and blanks above the guess form; artist draws on the same canvas |
| reveal | Answer, finished sketch and standings                                        |
| done   | Winner, own rank and complete standings                                      |

`usePhoneOnly` and `view.stage` support room-wide phone-only, remote players and
spectators. Spectators always see the public sketch and never interactive tools.

## Inputs

`choose {index:0..2}`, `guess {text:1..60 chars}`, `stroke {stroke}`, `undo`, `clear`.
A stroke has gesture id, increasing sequence, one of 6 token colours, width
2/5/9 and at most 32 integer coordinate pairs in a 1000×600 drawing plane.
Chunks stream while drawing; undo removes a whole gesture. Maximum 256 chunks
and 2,048 points; clearing allows drawing again without reusing a sequence.
Only the connected artist edits the drawing. No letters or numbers in drawings.

## Scoring

An exact or singular/plural match earns `100 + round(400 × (1 − elapsed/duration))`
points, clamped to 100–500. A one-edit near miss says “close” and does not score.
The artist earns `round(300 × solved/eligibleAtStart)`, capped at 300; no solvers
means zero. Points land together on reveal. Most total points wins; ties share rank.
Two letter hints arrive at one-third and two-thirds of the drawing window.

## Edge cases

- Pauses hold hints, round clocks and elapsed-time scoring, including earlier solves.
- A disconnected artist ends the turn; disconnected guessers never delay it.
- A reconnect restores tools, drawing, solve status, feedback and sequence numbers.
- Permanent leavers retain results and are skipped on future drawing turns.
- No guesses are broadcast. Correct text and all choices stay off guesser/TV views.
- Duplicate guesses, solved-player guesses, early/stale timers, old timestamps,
  replayed strokes, foreign-phase inputs and spectator inputs are ignored.
- An empty connected room finishes; a lone connected artist needs no guesses.
- VIP end returns every player's earned total without crediting a partial turn.

## Settings

Rotations: 1 (default) or 2. Drawing time: 45, 60 (default), 75 seconds.
Words: mixed (default), easy, medium or hard. Maximum configured match fits within
twice the 14-minute estimate, including 8 players and no submissions.

## Content

300 original family-friendly prompts: 100 easy, 100 medium, 100 hard, with accepted
aliases. `content/schema.ts` checks counts, uniqueness and vocabulary shape.
Original polyline bot art and token-based interface; existing shell sounds only.

## Sources

[skribbl.io](https://skribbl.io/) and its public client inform choice/draw/reveal,
blanks and hints; [Gartic's developer listing](https://play.google.com/store/apps/details?id=io.gartic.Gartic)
corroborates rotating drawing, private word choice and point-based victory.
[ADRA-UK's group-play handbook, p.23](https://adra.org.uk/wp-content/uploads/2023/07/ADRA-Appeal-Fundraising-Handbook-2022.pdf)
and [Snokido's Gartic guide](https://www.snokido.com/game/garticio) provide independent
flow corroboration. Exact scoring and timings here are deliberate PartyBox tuning.
Research, reach limits and source-by-source evidence live in
`jobs/P04-draw-and-guess/{RESEARCH,SOURCES,ASSUMPTIONS}.md`.
