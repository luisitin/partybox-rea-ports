# JOBS: PartyBox ports of web games and party-app flows

Each job builds one **complete PartyBox game** in `games/<id>/`, in the exact shape of `games/curve-fever/` (the reference port), against the real SDK in `packages/`. Research the original first (RULES.md, "Research first"), then design the living-room version: TV at 1920x1080 as the stage, every player on a phone (390x844), 2-8 players, phone-only rooms supported, bots for empty seats, a round that reads from 3 m with no explanation. Original art only (inline SVG, canvas, CSS); never the original's assets or name.

Every job also delivers: `games/<id>/README.md` as the spec (phases table for TV and phone, phone-only table, inputs, scoring, edge cases, settings, sources), fixtures per phase, contract tests wired like curve-fever, a sim of 1,000 seeded bot games at 2, 4 and 8 players, and the job folder files in RULES.md.

Manifest `category`: `arcade` for the P-jobs, `party` for the Q-jobs; `tags` from the reference manifest; English only.

## Names (owner 10-11: official names, personal use; overrides the working titles below)

Use these as the manifest `name` and the game `id`. A PR already open under a working title renames its folder, id and strings on its next push. Before building, check the PartyBox monorepo game list for the same game (Quiz Rush = Lightning Round and Draw and Guess = Broken Pencil turned out to be duplicates): an overlap becomes an upgrade of the existing game, not a new one.

| Job | Name                               | id                     |
| --- | ---------------------------------- | ---------------------- |
| P01 | Kahoot!                            | `kahoot`               |
| P02 | Kahoot! team mode                  | `kahoot (mode)`        |
| P03 | Quizizz                            | `quizizz`              |
| P04 | Skribbl.io                         | `skribbl`              |
| P05 | Agar.io                            | `agar-io`              |
| P06 | Slither.io                         | `slither-io`           |
| P07 | Paper.io 2                         | `paper-io`             |
| P08 | Hole.io                            | `hole-io`              |
| P09 | 2048                               | `2048`                 |
| P10 | Wordle                             | `wordle`               |
| P11 | Tetris                             | `tetris`               |
| P12 | Flappy Bird                        | `flappy-bird`          |
| P13 | Chrome Dino                        | `chrome-dino`          |
| P14 | Crossy Road                        | `crossy-road`          |
| P15 | Doodle Jump                        | `doodle-jump`          |
| P16 | Stack                              | `stack`                |
| P17 | Helix Jump                         | `helix-jump`           |
| P18 | Color Switch                       | `color-switch`         |
| P19 | Piano Tiles                        | `piano-tiles`          |
| P20 | Fruit Ninja                        | `fruit-ninja`          |
| P21 | Pong                               | `pong`                 |
| P22 | Tank Trouble                       | `tank-trouble`         |
| P23 | Bonk.io                            | `bonk-io`              |
| P24 | Haxball                            | `haxball`              |
| P25 | Worms                              | `worms`                |
| P26 | Mini Golf (Golf With Your Friends) | `mini-golf`            |
| P27 | Wii Sports Bowling                 | `bowling`              |
| P28 | Darts 301                          | `darts`                |
| P29 | Air Hockey                         | `air-hockey`           |
| P30 | TypeRacer                          | `typeracer`            |
| P31 | Minesweeper                        | `minesweeper`          |
| P32 | Dots and Boxes                     | `dots-and-boxes`       |
| P33 | Connect Four                       | `connect-four`         |
| P34 | Othello                            | `othello`              |
| P35 | Ultimate Tic-Tac-Toe               | `ultimate-tic-tac-toe` |
| P36 | Checkers                           | `checkers`             |
| P37 | Liar's Dice                        | `liars-dice`           |
| P38 | Blackjack                          | `blackjack`            |
| P39 | Texas Hold'em                      | `texas-holdem`         |
| P40 | Werewolf                           | `werewolf`             |
| P41 | Spyfall                            | `spyfall`              |
| P42 | Word Association                   | `word-association`     |
| P43 | Would You Rather                   | `would-you-rather`     |
| P44 | Jeopardy!                          | `jeopardy`             |
| P45 | Family Feud                        | `family-feud`          |
| P46 | Wheel of Fortune                   | `wheel-of-fortune`     |
| P47 | The Price Is Right                 | `price-is-right`       |
| P48 | Deal or No Deal                    | `deal-or-no-deal`      |
| P49 | Who Wants to Be a Millionaire      | `millionaire`          |
| P50 | Heads Up!                          | `heads-up`             |

## P01 Quiz Rush (Kahoot-style live quiz as the PartyBox house quiz)

Study the Kahoot live-quiz flow end to end (join by code on a phone, the TV lobby with names popping in, the countdown, the question shown on the TV while phones show only four coloured shape buttons, the speed-weighted score, the per-question podium beat, the music that rises and cuts, the streak bonus, the final podium). Build it as PartyBox's general quiz engine: `content/schema.ts` holds question packs (ship 3 packs of 20 original questions: general knowledge, movies, science); TV = question + timer + answer bar chart reveal; phone = the four shape buttons only, then "correct / too slow" with points and rank; speed scoring, streaks, a results podium with a top-3 reveal beat. Phone-only mode shows the question on the phone. Make the pacing the best thing about it: no dead air between questions.

## P02 Quiz Rush: team mode and pack editor (depends on P01)

Team mode (2-4 teams, team talk window before answering), the "answer on the TV" variant where phones vote, and a text pack format with a validator script so the owner can drop in new packs. Add 2 more packs (sports, music).

## P03 Trivia Lightning (Quizizz / Blooket-style self-paced quiz race)

Everyone answers at their own pace on the phone; the TV shows a race track with each player's progress and a power-up or two (freeze a rival, double points). Study Quizizz and Blooket's "Gold Quest" loop for the self-paced feel. Reuse P01's pack schema if it has merged, else define a compatible one.

## P04 Draw and Guess (Skribbl / Gartic-style)

One player draws on the phone (canvas with a few colours and sizes), the TV shows the drawing live and the word's blank letters, the others type guesses on their phones; points for speed, the drawer scores when people guess. Word lists are original (ship 300 words in 3 difficulties). Bots guess from a seeded vocabulary. Study skribbl.io and Gartic for the round flow, hints and the word-choice beat.

## P05 Blob Arena (Agar.io-style)

Everyone is a blob on one arena shown on the TV; the phone is a joystick pad; eat pellets to grow, eat smaller blobs, split to lunge. 90 s rounds, 3 rounds, mass at the end scores. Study agar.io's feel (mass to speed, split timing) and tune for 8 players on one TV.

## P06 Snake Royale (Slither.io-style)

Like P05 but snakes: boost to lunge, cut others off, the body becomes food. Study slither.io's boost cost and collision rules.

## P07 Paper Territory (Paper.io-style)

Each player claims territory by drawing loops from their base; cutting a trail kills. The TV is the map, the phone a d-pad. 2 minutes, most area wins. Study paper.io 2 for the loop-closing rule.

## P08 Hole Swallow (Hole.io-style)

Each player is a hole that grows by swallowing things in a city; swallow smaller holes. The TV is the city, the phone a joystick. 90 s. Study hole.io for size thresholds.

## P09 2048 Race

Everyone plays the same seeded 2048 board on their phone (swipe); the TV shows every board small with the best tile big; first to 2048 or highest score at 3 minutes wins. Study the merge rules exactly.

## P10 Word Guess Race (Wordle-style)

Same secret 5-letter word for everyone, 6 guesses, on the phone keyboard; the TV shows every player's coloured grid filling in without the letters. Original word list. Fewest guesses, then speed. 3 rounds.

## P11 Tetris Clash

Everyone plays a seeded piece sequence on the phone (tap-and-swipe controls designed for a thumb); the TV shows all boards; cleared lines send garbage to a chosen rival. 2 minutes or last standing. Study the guideline rotation and garbage rules in public Tetris-guideline summaries.

## P12 Flappy Lanes

One-tap flapper; everyone runs the same seeded course in lanes on the TV; last alive wins the round. 3 rounds. Study the original's flap impulse and gap spacing.

## P13 Dino Dash (Chrome dinosaur-style)

Same seeded obstacle run for all, one tap to jump, hold to duck; the TV shows every runner in lanes; farthest at death wins. Study the Chrome offline game's speed ramp.

## P14 Crossy Streets (Crossy Road-style)

Hop forward across roads and rivers; everyone on one wide TV map, phones give four directions; farthest in 60 s wins; the eagle takes anyone idle. Study the lane generation rules.

## P15 Doodle Climb (Doodle Jump-style)

Tilt or hold-left/right to steer a bouncing character up platforms; the TV shows every climber side by side; highest wins. Seeded platform layout.

## P16 Stack Tower

One tap to drop the sliding block; perfect drops grow it back; the TV shows every tower; highest after 45 s wins. Study the original's tolerance for a perfect drop.

## P17 Helix Drop (Helix Jump-style)

Hold left/right to spin the tower; the ball drops through gaps; the TV shows every tower; deepest wins.

## P18 Colour Gate (Color Switch-style)

One tap; pass gates matching your colour; the TV shows all players in lanes; farthest wins.

## P19 Piano Tiles Race

Tap the black tiles on the phone; the TV shows everyone's tile count and speed; a wrong tap ends the run; most tiles in 30 s. Same seeded tile sequence.

## P20 Fruit Slice

Swipe to slice fruit on the phone; the TV shows every player's combo meter and a shared fruit fountain; bombs end a streak. 60 s.

## P21 Pong Party

Up to 8 paddles around an octagonal arena on the TV; the phone is a slider; balls multiply; lose a life when a ball passes you. Study multiplayer pong variants for arena shapes.

## P22 Tank Trouble

Top-down mazes on the TV; the phone has a steering pad and fire; bouncing shells; last tank standing. Study tanktrouble.com for the bounce and power-up rules. 5 rounds.

## P23 Bonk Arena (Bonk.io-style)

Round balls on physics platforms; push rivals off; the phone is left/right/jump plus heavy mode. Study bonk.io's feel. Last standing wins the round.

## P24 Head Soccer (Haxball-style)

Two teams of balls kick a puck into goals on the TV pitch; the phone is a d-pad and kick. 2 halves of 90 s. Study haxball for the kick physics and team sizes.

## P25 Artillery Worms (Scorched-Earth-style)

Turn-based artillery on a destructible 2D hill; the phone sets angle and power with a dial; the TV shows the shot. Up to 8 turns each. Study the classic angle/power/wind loop.

## P26 Mini Golf Crowd

Everyone putts the same seeded hole at once on the TV (ghost balls), the phone is a pull-back shot; fewest strokes over 6 holes. Study the classic browser mini-golf feel.

## P27 Bowling Night

Everyone bowls the same lane in turn (or all at once on 8 lanes on the TV); the phone swipe sets speed and spin. 5 frames. Original pins and ball art.

## P28 Darts 301

Phone flick throws a dart; the TV shows the board and scores; 301 countdown with doubles out. Up to 8 players, 2 teams option.

## P29 Air Hockey Rush

Two players per table, four tables on the TV; the phone is the paddle pad; winners rotate. 60 s matches.

## P30 Type Race

Everyone types the same seeded passage on the phone keyboard; the TV shows cars moving by progress; WPM and accuracy scored. Original passages (ship 60).

## P31 Minesweeper Race

Same seeded board for all on the phone; the TV shows cleared percentage per player; first clear or best at 3 minutes. Study the first-click-safe rule.

## P32 Dots and Boxes Tournament

Pairs play on the phone, the TV shows every board; winners play winners. Bots for byes.

## P33 Connect Four Ladder

Same as P32 with Connect Four; a 3-round ladder to a final shown big on the TV.

## P34 Reversi Showdown

Pairs play Reversi; the TV shows the boards and a bracket; strong bot via mobility heuristic.

## P35 Ultimate Tic-Tac-Toe

The 9x9 nested game in pairs; the TV explains the next-board rule with a highlight; bracket.

## P36 Checkers Blitz

Timed checkers pairs with a 20 s move clock; the TV shows all boards; bracket.

## P37 Liar's Dice

Hidden dice on each phone, bids on the TV, challenge beats; the TV reveals every cup at a challenge. Study the standard rules and the "spot on" variant as a setting.

## P38 Blackjack Table

Everyone plays against a dealer on the TV; the phone shows your hand and hit/stand/double; 10 hands; chips scored. Original card art.

## P39 Hold'em Table

Texas hold'em for 2-8 with blinds, phone hands, the TV board and pot; bots with a hand-strength strategy; 20 hands or last chips.

## P40 Werewolf Night

Hidden roles on phones, night actions by phone, day vote on the TV with a timer; the TV narrates (text) each beat. Study the standard roles and ship villager, werewolf, seer, doctor; settings for extra roles.

## P41 Spy Location

Everyone but the spy sees the location on the phone; a questions timer on the TV; vote beat; the spy guesses. Original location list (40 locations x 7 roles).

## P42 Word Association Chain

The TV shows a word; everyone types one associated word on the phone; matching another player's word scores; chains across rounds. Study the "Just One" / "Medium" feel for the scoring beat.

## P43 Would You Rather Live

Two options on the TV; everyone votes on the phone; the TV reveals the split with faces; guess-the-majority bonus. Ship 200 original prompts, all-ages.

## P44 Buzzer Trivia (Jeopardy-style board)

A category board on the TV; the fastest phone buzz answers by typing; wrong answers pass; daily-double beat; final wager round. Original clues (ship 5 boards).

## P45 Family Survey (Family-Feud-style)

Survey questions with ranked answers on the TV board; two teams, face-off buzz, steals. Ship 40 original surveys with plausible ranked answers.

## P46 Wheel Puzzle (Wheel-of-Fortune-style)

Spin on the phone, guess letters, solve the puzzle shown on the TV; bankrupt and lose-a-turn wedges. Ship 100 original puzzles.

## P47 Price Guess (Price-Is-Right-style)

Everyone guesses the price of an item shown on the TV (original item cards with made-up but plausible prices, no brands); closest without going over; a showcase round.

## P48 Deal or Not (Deal-or-No-Deal-style)

Cases on the TV, one player's game at a time with everyone else voting deal/no deal on their phones for a side bet; banker offers from expected value.

## P49 Millionaire Ladder (Who-Wants-to-Be-a-Millionaire-style)

One hot seat at a time with lifelines (ask the room: everyone votes on their phones); the TV shows the money ladder; rotate hot seats; original question packs.

## P50 Heads Up Charades

The TV shows the word to everyone except the guesser, whose phone shows a big "tilt to pass / skip" control; the team shouts clues; 60 s rounds; original decks (ship 5 decks of 60).

## Q01 Kahoot flow study for the PartyBox shell (study + prototype, no game folder)

Not a game: a written study of what Kahoot does in its lobby, join, countdown, question, reveal, podium and music beats that PartyBox's general system should adopt, with timings measured from public videos and the live product, plus a self-contained `prototype.html` in the job folder that plays the lobby-to-podium flow with the PartyBox tokens and placeholder questions. Output: `jobs/Q01-kahoot-flow/STUDY.md` (findings, each with a proposed PartyBox change and where it would live in the SDK or shell) and the prototype. Treat every finding as a recommendation for the core team.

## Q02 Jackbox room-flow study (study + prototype, no game folder)

Same shape as Q01 for the Jackbox Party Pack room flow: join, audience, pass-the-phone, the host voice, the "everybody's in" beat, the results screens. STUDY.md + prototype.html.
