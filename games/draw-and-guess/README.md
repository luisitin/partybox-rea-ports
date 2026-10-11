# Draw and Guess

An original PartyBox drawing race inspired by the choose, draw and recognize
flow of browser Pictionary games. One artist draws a secret word on a phone;
the shared picture grows live while everyone else types guesses. Familiar
shapes, questionable doodles and two late letter hints keep the room moving.
English only; original content and artwork; no external runtime requests.

## Overview

The seeded turn order gives each seat one artist turn per lap. The artist
chooses one of three words in eight seconds; no choice selects the first word.
The drawing clock then begins, with 60 seconds by default. Guessers see blank
letters and the drawing. Hints uncover one letter after one third and another
after two thirds of the turn. Correct guesses score immediately; the turn ends
when every connected guesser solves or time expires. The completed picture,
word and gains share a reveal before the next artist. Highest total wins.

## Players

2-8 players, including bots. Bots have easy, normal and sharp strengths. Artist
bots choose words with original pictograms and produce actual strokes; guesser
bots search seeded vocabulary using public letters and their guess history.
They never read the private word to generate a guess. Spectators watch without
choice, drawing or guess controls.

## Phases

| Phase    | TV                                                                 | Phone with a TV                                                                       | Exit                                                                          |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `choose` | Artist name, turn number and choice clock; words remain private.   | Artist: three word buttons. Others: who is choosing.                                  | Choice or 8 seconds → `draw`.                                                 |
| `draw`   | Live picture, letter mask, remaining time and successful guessers. | Artist: private word, drawing pad and tools. Others: private guess field and verdict. | Everyone connected solves, clock expires or artist departs → `reveal`.        |
| `reveal` | Frozen picture, word, round gains and totals.                      | Word, your gain and total; public drawing when the phone is the stage.                | At least 8 seconds, enlarged with SDK reading time → next `choose` or `done`. |
| `done`   | Winner or shared winners and final standings.                      | Your result and standings.                                                            | Terminal; results include everyone who started.                               |

VIP pause, resume, skip and end use the SDK contract. The drawing countdown
shows the turn end while a two-second server beat advances hints and timeout.

### Phone only (no TV)

When `ctx.presence.phoneOnly` is true, or a seat cannot see the TV, the phone
is the stage. It never asks anyone to look at a TV.

| Phase    | Phone stage                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `choose` | Artist and turn context; the artist has the private three-word choice.                                                        |
| `draw`   | Guessers see the live drawing, blank letters, timer and guess field; the artist sees the drawing pad, private word and tools. |
| `reveal` | Frozen drawing, answer and compact gains/standings.                                                                           |
| `done`   | Winner, personal result and compact final standings.                                                                          |

Phone play fits 390 × 844. The drawing stage stays visible above the form;
artist tools have labels and touch targets. A spectator sees the same public
stage with no action controls.

## Inputs

- `choose`: option index 0-2, artist only during `choose`.
- `stroke`: 1-24 points on a 1000 × 600 logical pad, colour index 0-5,
  width 4, 9 or 18, optional integer gesture ID 0-1,000,000,000;
  artist only during `draw`. Contiguous chunks of a gesture join into one path.
- `undo` removes the latest complete gesture; legacy packets without a gesture
  ID each count as one stroke. `clear` empties the pad.
- `guess`: 1-40 characters, non-artist only during `draw`. Case, outer
  whitespace, punctuation and leading articles use SDK normalization. An exact normalized word/phrase solves.

Six colours and three brush sizes keep the tool row simple. At most 240 paths
are stored; a current gesture can keep drawing throughout the turn. A 3,500-point
budget simplifies long paths while preserving their endpoints. Accepted ink
and edits carry a per-turn revision for ordered phone acknowledgements.
Guesses are accepted at most once every 750 ms per seat, and only
the most recent 24 are retained. Raw guesses never appear on the shared stage;
a one-letter mismatch gets private “Close!” feedback. A solved seat cannot
score or submit more guesses that turn.

## Scoring

A correct guess earns `300 + floor(700 × remaining / duration)`, clamped to
300-1000 points. The artist earns 250 per correct guess. No wrong-guess penalty.
Points are awarded once per solver; match totals add across turns and ties
share a rank. These are PartyBox scores, not a claim about an original formula.
The artist sees successful-guess progress. A solver immediately sees their own
earned points with one sound/haptic cue, while the word stays hidden until reveal.

## Edge cases

- Choices and the answer are hidden from the TV and other phones until reveal.
  Refresh restores the role, strokes and private verdict from server state.
- A dropped artist ends the turn; disconnected guessers never hold it open.
  Departed seats retain their earned points in the final results.
- Stale timers, strangers, wrong-phase inputs and drawing by guessers do nothing.
- Pause shifts the drawing clock and hint schedule; paused time cannot reduce
  guess points. All time comes from events and all randomness from state.
- Words avoid repeats while the selected deck has enough unused choices.

## Settings

| Key           | Default | Values                               |
| ------------- | ------- | ------------------------------------ |
| `laps`        | 1       | 1-2 artist turns per seat.           |
| `drawSeconds` | 60      | 30, 45 or 60 seconds.                |
| `difficulty`  | `mixed` | `easy`, `medium`, `hard` or `mixed`. |

## Content

300 original family-friendly words: 100 each in `content/easy.json`,
`medium.json` and `hard.json`, validated by `content/schema.ts`. Easy favours
familiar objects/animals, medium adds compounds and scenes, hard needs more
interpretation. Original bot pictograms use the same stroke format as people.

## Sources

[Official skribbl tutorial](https://skribbl.io/) and the independent
[ADRA handbook, p.23](https://adra.org.uk/wp-content/uploads/2023/07/ADRA-Appeal-Fundraising-Handbook-2022.pdf)
corroborate private choice, shared drawing and typed guesses. The
[official Gartic listing](https://play.google.com/store/apps/details?hl=en&id=io.gartic.Gartic),
[Gartic learn page](https://gartic.com.br/aprenda/) and independent
[Canaltech guide](https://canaltech.com.br/jogos-mobile/gartic-como-jogar/)
support artist/guesser rewards and speed. Detailed evidence, access limitations
and source distinctions are in `jobs/P04-draw-and-guess/RESEARCH.md` and
`SOURCES.md`. No source assets, sounds, code or word lists are included.
