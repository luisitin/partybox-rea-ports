# P04 research: Draw and Guess

Research date: 2026-10-11. Scope: the simultaneous drawing-and-guessing games
skribbl.io and Gartic.io, rather than Gartic Phone's telephone chain. Mechanics,
not code, branding, word packs or assets, inform the port.

## Method and reach

- Read the live official skribbl home page and its publicly served `js/game.js`
  client. The client was inspected in memory; it is not vendored. Read the
  corresponding settings markup, phase messages, masks and sound-event names.
- Read the live official Gartic home page and the developer's Google Play listing.
  A direct shell fetch of Gartic returned HTTP 403. The web reader could read the
  landing page. Independent written play instructions were used for its gameplay
  details; conflicting precise details remain unverified.
- Read ADRA-UK's firsthand group-game instructions and independent Gartic play
  instructions. The evidence table pairs independent publishers for each adopted
  original-game fact. A product page and that product's own client are one
  publisher, not two independent sources.
- No original drawing, word list, icon, font, music or audio file was downloaded
  into the repository. The 300-word deck is an original selection of ordinary
  English concepts and actions.
- Attempted a live solo-room inspection through the installed computer-use
  browser API. Creating a visible in-app browser tab returned “Browser is not
  available: iab”; the surface inventory returned no apps or browsers. No room
  was opened and no multiplayer play, sound playback or measured live timings
  were observed. The study therefore relies on readable product material and
  client inspection, with this limit recorded rather than implying a playtest.

## Corroborated original flow

| Finding                                                                            | Source 1                                                                   | Independent source 2                                                                  | PartyBox consequence                                                                             |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| One player chooses a secret word and draws while the other players submit guesses. | Official skribbl how-to; official Gartic developer listing                 | ADRA-UK handbook p.23; Snokido Gartic instructions                                    | Rotate the drawer; one phone draws, the remaining phones type.                                   |
| A private room can be made and shared with friends; settings precede play.         | Official skribbl settings and official Gartic landing page                 | ADRA-UK p.23; Snokido room instructions                                               | The existing PartyBox room provides joining; do not add another room system.                     |
| The drawer gets a choice of prompts.                                               | Official skribbl word-count setting, 1–5 choices; Gartic developer listing | ADRA-UK p.23 describes three skribbl choices; Snokido describes two Gartic choices    | Three choices create a short anticipation beat and let a novice avoid a difficult sketch.        |
| Guessing is done through a text field while the drawing is seen live.              | Official skribbl page and public client                                    | ADRA-UK p.23; Snokido mobile instructions                                             | Keep guesses on phones and the shared drawing as the TV focal point.                             |
| Correct guesses earn points and the winner is determined by points.                | Official skribbl about/how-to; Gartic developer listing                    | Snokido Gartic instructions; ADRA-UK corroborates the guessing loop                   | Use cumulative scores; make the drawer benefit when their sketch communicates.                   |
| Letters must not be written to spell the answer.                                   | Official skribbl how-to                                                    | Snokido Gartic instructions independently specify no letters/numbers/symbols          | Give the drawer a visible “Draw it. Do not write the word.” instruction.                         |
| Hints are letter clues rather than a full answer.                                  | Official skribbl hint setting and public-client mask handling              | Skribbl community timer documentation; independent Gartic instructions at uCrazyGames | Show blanks and progressively reveal a small number of letters; never send the word to guessers. |

These are the supported common mechanics. Exact scoring arithmetic, a universal
Gartic timer and current hint schedules were not established by two independent
primary observations. The port's numbers are deliberate tuning decisions.

## Timings and scoring: evidence limits

- The official skribbl HTML offers draw durations from 15 to 180 seconds, including
  60 and 80. It exposes rounds, word count and hint settings. ADRA-UK independently
  confirms that a host chooses duration and rounds. An 80-second default is
  reported by community timer documentation, but the static markup alone does
  not establish which value a current room chooses.
- Snokido describes a 60-second Gartic draw window and two offered words. An
  independent Gartic guide also describes two choices; another unofficial page
  claims three. The official developer listing confirms choice but not its count.
  Treat “two” and “60 seconds” as source reports, not promises about every room.
- Gartic's developer listing says the first player to reach the points goal wins;
  Snokido independently corroborates that structure. Skribbl's official page
  describes rounds and the highest final total. PartyBox uses equal drawing turns
  so each of 2–8 players gets the same scoring opportunity.
- No exact scoring equation was recoverable from the read-only public client.
  Scores arrive as server messages. Speed points and drawer rewards in this port
  are original, explicitly specified in the game README and tested directly.

## What the public skribbl client reveals

Single-source implementation observations, useful for design but not claimed as
independently verified universal game rules:

- Choice, live drawing, reveal and final podium have separate presentation paths.
- Guessers receive a word-length mask; subsequent messages uncover letters.
  The drawer receives the actual selected word.
- Reveal text distinguishes everyone guessing, time expiring and the drawer
  leaving. A new turn should not silently replace an unfinished sketch.
- Brush, fill, undo and clear are distinct tools. Mobile support and touch pressure
  are advertised on the official home page. PartyBox keeps a smaller toolbar for
  finger drawing: a few token colours, three sizes, undo and clear.
- The client names round-start, successful-round-end, unsuccessful-round-end,
  player-guessed and timer-tick audio events. No audio asset was copied or listened
  to; sound character and loudness are not measured. PartyBox uses SDK cues.

Inspected client: `https://skribbl.io/js/game.js`, 59,391 characters;
UTF-8 SHA-256 `5bbecae0727c84008b08e006dceb5838c42237e48ae2c8a0faddd1484cf57829`.

## Living-room adaptation

The fun is recognizing a sketch while it is still becoming something. The drawer
needs immediate ink, forgiving tools and a choice they can draw. Guessers need a
clear remaining-letter pattern, fast resubmission and a personal success beat.
The reveal should preserve the finished picture beside the answer long enough
for the room to laugh at the guesses.

| Beat   | TV                                              | Drawer phone                                  | Guessing phone                                       | Phone-only room                                                   |
| ------ | ----------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Ready  | Who is drawing next and the simple rules        | Drawer's role explained                       | Guessing role explained                              | The same introduction and roster.                                 |
| Choose | Drawer's name; prompts stay secret              | Three original prompts with difficulty        | “The drawer is choosing.”                            | Same role-specific screen; no direction to a TV.                  |
| Draw   | Large live picture, blanks, timer, solved count | Secret prompt, finger canvas, compact toolbar | Guess field, own feedback; public sketch when needed | Sketch and blanks above the guess field; drawer has their canvas. |
| Reveal | Answer, frozen drawing, gains and totals        | Own drawer gain                               | Own guess gain and total                             | Answer, drawing and compact standings.                            |
| Done   | Final standings and ties                        | Own result                                    | Own result                                           | Complete final standings.                                         |

The chosen word and unchosen prompts must be absent from TV and every other
controller view until reveal. A solved player's phone can say “Correct” without
echoing the answer to the whole room. Incorrect guesses and near misses stay
private: otherwise a loud chat feed can accidentally publish the word. Spectators
see the shared stage without drawing tools or a guess form.

Bots must not read the selected answer to guess. Their original vocabulary is the
same 300 entries shipped as content. A guesser can filter by the public mask,
use seeded sampling, and remember its own prior attempts. Stronger bots narrow
the public pattern faster; no network service or image recognition is claimed.
A drawing bot can know its own assigned word and construct original simple
strokes. Disconnects cannot strand a phase: choice auto-selects, draw has a cap,
and the absence of eligible guessers or a departed drawer ends the turn.

## Original content audit

`games/draw-and-guess/content/words.json` contains 300 distinct, family-friendly
entries, 100 each easy/medium/hard. Categories are animal, food, object, nature,
place and activity. Easy entries have simple silhouettes; medium entries add
distinctive details; hard entries include compound scenes, actions and specialized
objects. This difficulty classification is our editorial judgement, not measured
reading-level evidence. Accepted aliases cover common spelling or naming variants.
No source game's pack was read or copied.
