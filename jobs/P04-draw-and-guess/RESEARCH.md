# P04 Draw and Guess research

Research date: 2026-10-11. Original references: skribbl.io and Gartic.io. The
PartyBox title is **Draw and Guess**; original names appear only as references.

## Method and limits

Read the repository README, RULES, JOBS, games/AGENTS, the Curve Fever spec and
contract wiring, GAME_CONTRACT and DESIGN_SYSTEM. Inspected the live skribbl
landing-page markup and its public `js/game.js` with read-only HTTP requests.
No original code, images, sound files or word list is included in this port.
The Gartic.io live page returned HTTP 403 to the desktop HTTP client; the web
reader could retrieve its landing-page text but not its interactive game.
Used official Gartic documentation and two independent illustrated guides as
fallbacks. This research did not complete an interactive original-game match;
client observations are source inspection, not measurements from play. A later
visible-browser attempt used the computer-use skill: `cua.getState()` returned
empty app and browser inventories, and creating an in-app tab for skribbl.io
failed with `Browser is not available: iab`. No public room was entered and no
messages were sent. A private-room playthrough could not be started because the
browser capability is absent, rather than because solo play was demonstrated
to be impossible.

## Corroborated mechanics

| Finding                                                                                                                                  | Primary evidence                                                                                                                                                                               | Independent corroboration                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A player chooses a secret word, draws, and everyone else guesses; turns rotate and points decide the winner.                             | [skribbl official tutorial](https://skribbl.io/)                                                                                                                                               | [ADRA handbook, printed page 23](https://adra.org.uk/wp-content/uploads/2023/07/ADRA-Appeal-Fundraising-Handbook-2022.pdf)                                                                                                                                                                                                                                                             |
| The artist has a word-choice beat. Three choices is a documented classic skribbl flow; current private rooms offer a configurable count. | [skribbl official news and settings](https://skribbl.io/)                                                                                                                                      | ADRA handbook describes choosing one of three words.                                                                                                                                                                                                                                                                                                                                   |
| Gartic has a timed artist turn with word choice and a score target.                                                                      | [Gartic official Play listing](https://play.google.com/store/apps/details?hl=en&id=io.gartic.Gartic)                                                                                           | [Boss Lab illustrated guide](https://www.bosslabboardgame.com/post/%E0%B8%8A%E0%B8%A7%E0%B8%99%E0%B9%80%E0%B8%94-%E0%B8%81-%E0%B9%86-%E0%B8%A1%E0%B8%B2%E0%B9%80%E0%B8%A5-%E0%B8%99%E0%B9%80%E0%B8%81%E0%B8%A1%E0%B8%A7%E0%B8%B2%E0%B8%94%E0%B8%A3-%E0%B8%9B%E0%B8%97%E0%B8%B2%E0%B8%A2%E0%B8%84%E0%B8%B3%E0%B8%9A%E0%B8%99%E0%B9%80%E0%B8%A7-%E0%B8%9A-gartic-io-%E0%B8%81-%E0%B8%99) |
| Successful guesses reward the guesser and artist, with early answers favoured.                                                           | [Gartic family official learn page](https://gartic.com.br/aprenda/) says both receive points and later successes earn less. This is family evidence, not proof of the exact Gartic.io formula. | Boss Lab documents both awards and more artist points for more correct guessers; [Canaltech mobile guide](https://canaltech.com.br/jogos-mobile/gartic-como-jogar/) describes greater points for faster guesses.                                                                                                                                                                       |
| Letter hints support a stuck room.                                                                                                       | skribbl official settings allow hints; inspected client builds a masked word and reveals received hint letters.                                                                                | Boss Lab identifies Gartic.io's artist Hint button and successive hints.                                                                                                                                                                                                                                                                                                               |

Gartic's official target-score endpoint differs from skribbl's fixed-round
match. PartyBox uses fixed artist laps so every connected seat gets an equal
opportunity and a living-room group can predict the finish.

## Timings, scoring and sound

The live skribbl page offers draw durations from 15 through 240 seconds; exact
default is server-selected and was not verified by creating a room. Older
community [timer documentation](https://skribbl-io.fandom.com/wiki/Timer)
reports 80-second drawing, 15-second choice, hints at 50 and 25 seconds left,
and a ticking final ten seconds. These historical values are single-source
context, not asserted current facts. Exact original scoring formulas remain
unknown; do not claim a pixel-perfect score reproduction.

Read-only client inspection confirms separate round-start, guess-success,
round-end success/failure and ticking sound cues, plus distinct end reasons
for everyone guessing, timeout and artist departure. No original audio was
downloaded. These cues explain the useful emotional beats: a new artist
begins, recognition gets immediate feedback, the remaining seconds tighten,
then the completed picture and word get a shared laugh.

## PartyBox decisions

These are intentional adaptation choices, not facts about the originals:

- Three original word choices; 8-second choice clock, deterministic fallback
  when the artist does not choose. The clock starts drawing only after choice.
- Default 60-second drawing. Automatic hints after one third and two thirds
  of the turn (20 and 40 seconds by default), seeded unrevealed letters, never
  uncovering the entire answer. Timers must use `event.now` and SDK beats.
- One artist lap by default; an optional second lap. At eight seats the worst
  default match is roughly ten minutes including choice and reveal beats.
- Suggested guess points: `300 + floor(700 * remainingMs / drawDurationMs)`,
  bounded to 300-1000. First accepted correct answer earns points once.
  Drawer earns 250 for each correct guess. This is a transparent custom
  formula; playtest room-size balance before changing it.
- A reveal lasts at least the SDK slow-reader `readingMs` for its visible
  words, approximately 8-10 seconds for concise copy. Show the frozen drawing,
  answer, successful guessers and round gains together.
- Guess text remains private on each phone. The TV shows success names and
  blank letters, preserving the secret if someone types it into a wrong field.
  Feedback explains correct, try again, already solved and timeout states.
- A few named colours, three labelled brush sizes, eraser, undo and clear;
  finger strokes appear live. Keep controls at least 48 pixels and use tokens.
- Phone-only guessers see the live drawing, mask and form. The artist sees
  the private word and tools. Spectators see public stage content only.
- Drawer departure closes the turn promptly; absent guessers never hold the
  round open. Reconnecting restores the same drawing and personal verdict.
- Bots choose from a seeded original vocabulary using public mask and their
  prior guesses, rather than receiving the answer. Artist bots need drawable
  templates and real brush strokes; three strengths vary search and pacing.

The fun is recognizability emerging from bad art: begin with a large silhouette,
then add the distinguishing detail while other players race to name it. The TV
should devote its largest area to the drawing; the artist identity, remaining
time and letter mask are secondary. This is a design inference from the
mechanics, not a measured original layout requirement.
