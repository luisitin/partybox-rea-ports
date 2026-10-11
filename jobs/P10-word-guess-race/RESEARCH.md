# P10 — Word Guess Race research

Checked 2026-10-11. This is a mechanics study; no source code, answer list, branding, image, font or audio is reused.

## Access and method

The [official digital game](https://www.nytimes.com/games/wordle/index.html), NYT help page and NYT creator article could not be fetched by the web tool. An attempt to open the official game through CUA timed out; an allowed clone retry reported `Browser is not available: iab`, and `cua.getState()` returned no enabled apps or browsers. A live original play-through and original animation/audio timing measurement were therefore unavailable. Under RULES.md's web fallback, research continued with the licensed Hasbro/NYT rulebook and two independently maintained public implementations. These are source inspections, not a claimed play session.

Sources are recorded with exact URLs in [SOURCES.md](SOURCES.md). J1 and J2 are one independent source family, not two separate votes. R1, R2 and R3 likewise form one family. H1 is the licensed product rulebook; it corroborates shared mechanics but its physical-game scoring is not attributed to the daily digital game.

## Corroborated mechanics

| Fact                                                                                                                                | Independent evidence                                                                         | Consequence for this port                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A puzzle has five letter positions and at most six accepted guesses.                                                                | H1 playing-round section; J1 overview and exercise 3.                                        | Every phone has one 6 × 5 board; the server caps attempts at six.                        |
| Feedback distinguishes exact position, present elsewhere, and no available match.                                                   | H1 playing-round section; J1 exercise 4.                                                     | Phone tiles and keys carry color plus check, arrow and cross marks.                      |
| Repeated letters are judged by multiplicity: exact matches consume letters first, then remaining copies can earn misplaced matches. | H1 tips: duplicate-letter examples; J2's two-pass helper.                                    | Use a fresh two-pass count algorithm; test repeated-letter cases independently.          |
| Correctly identifying the answer ends the attempt; otherwise the sixth accepted guess exhausts the board.                           | H1 scoring/valid-words section; J1 exercise 5.                                               | A finished phone keeps its own board and watches public race progress.                   |
| An invalid dictionary guess can be corrected without using an accepted attempt.                                                     | H1 scoring/valid-words section valid-word challenge; R3 early returns before adding a guess. | Invalid or repeated words show an own-phone error and consume no row.                    |
| A keyboard supports letter entry and knowledge of earlier feedback.                                                                 | J1 visual-keyboard exercise; R2 on-screen and physical-key handlers.                         | Keep a compact phone keyboard and merge letter knowledge without demoting exact matches. |

H1's multiplayer flow additionally hides opponents' boards, reports a solve without announcing the word, and reveals the shared word only after a round. Those are primary observations of that physical product, not independently verified digital-game facts. P10 itself binds this port to public grids with no letters. The server strips every guessed word from that public projection.

## Flow and feel

The documented digital loop is entry → accepted row → positional feedback → revise → solve/exhaustion. The inference from the UI documentation is that its satisfying beat is a row changing from uncertainty into useful constraints, and the visible keyboard keeps memory out of the player's head. The six-row ceiling makes even a lucky solve understandable to spectators. None of these observations requires copying its palette, artwork or code.

No original reveal duration, sound cue or music timing was measured. This port uses the SDK's own cues and design tokens. Its 120 s round and 9 s shared reveal are deliberate PartyBox pacing choices, not claims about the original.

## Living-room design decisions

- Three simultaneous rounds, with a fresh seeded shared answer each round. The answer set is an original curated selection of 260 common, all-ages words; 1204 original curated entries are accepted. A small house dictionary is disclosed rather than silently claiming all English words.
- The TV shows all eight 6 × 5 grids as marks and colors, names, attempts and solve state. It cannot show a letter during play, including in screen-reader labels. The public grid carries no secret or guessed-word key.
- Each phone owns its private board and keyboard. In phone-only rooms active play carries the public solved-player count; a finished phone shows the public roster. Spectators have public progress only. The round word becomes public in `reveal`.
- Fewer guesses always beats more guesses. Only equal guess counts compare active elapsed solve time. One point is earned per opponent beaten; unsolved players tie at zero. Match totals aggregate three rounds.
- The round runs for 120 s by default, adjustable 60–180 s. It ends early once every connected player is finished. A disconnected seat is never awaited; if no connected players remain, the normal deadline still closes the round.
- Refresh restores accepted history, status and errors from the server. A delayed previous-round submit carries a round number and is ignored. A pause moves the deadline and freezes active solve time.
- The reading beat exposes the answer, round points and total standings for 9 s. Keeping the answer off every other player's phone before that beat preserves the shared reveal.

## Risks to verify

Repeated-letter over-credit, exact-key demotion, wrong-round or late submits, reconnect history, scoring a round twice, vacuous disconnect closure, hidden-word leaks in accessibility text, eight-player TV fit, and a phone keyboard that pushes its last row below the viewport are the highest-impact failure modes. The required simulation, properties, mutation checks and phase media are recorded separately in VERIFY.md.
