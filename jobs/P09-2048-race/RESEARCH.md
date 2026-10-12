# P09 2048 research: equal-seed race

## Current resume evidence (2026-10-12, r1-local)

The canonical product is 2048. A read-only scan found no overlap among126 core
manifests at `e73c6a2fb776ae355769ffa8074a24ace996b6d6`.
Native headless Chrome played the pinned classic original on October12 at14:28UTC
from a temporary read-only checkout outside this repository. A fresh profile began
with two2tiles. Twelve ordinary arrow inputs produced11accepted moves and24points.
The saved public board/score reads and original start/midgame PNGs are in
games/2048/fidelity/. The port uses those identical visible states as comparison
fixtures; this establishes matched geometry/HUD moments, not identical RNG.

The hosted creator URL redirects to play2048.co's2026 redesign. Classic revision
478b6ec remains the studied reference. No original code/fonts/assets ship; review
PNGs are the fidelity evidence required by RULES. The own-game reducer/controller
capture room exercises actual accepted merges and checks public CSS clocks against
the pinned source timings. Original audio was not heard. The provider-unavailable
attempt and engine VM transcript below are historical, superseded where noted.

## Historical reconstruction (2026-10-11)

Researched on 2026-10-11. The original mechanics were inspected through the
creator's public repository and cross-checked against an independently written
C++ engine. Public source was read for behavior; none of its implementation,
styles, fonts, branding, images, or sounds are included in the port.

## Evidence and access

The original repository is [Gabriele Cirulli's 2048](https://github.com/gabrielecirulli/2048).
The independent primary source is [nneonneo/2048-ai](https://github.com/nneonneo/2048-ai):
its author supplies a separate executable engine, not another rendering of the
original JavaScript. The inspected revisions and individual pages are recorded
in [SOURCES.md](SOURCES.md).

Browser play was attempted with the computer-use tool against
`https://gabrielecirulli.github.io/2048/`. The tool returned
`Browser is not available: iab`; its inventory contained no browsers or apps.
Therefore no visual or audio play session is claimed. No headless browser was
started for research.

As a fallback, the upstream `tile.js`, `grid.js`, and `game_manager.js` were
fetched into memory and executed in a temporary Node VM. Input, storage, and
rendering adapters were inert. This exercised the original gameplay engine with
16 directional inputs, followed by seven targeted probes. A fixed random draw
made the transcript reproducible. These sources were not saved into the repo.

## Cross-confirmed mechanics

Every row below is supported by both [the original engine](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/js/game_manager.js)
and [the independent engine](https://github.com/nneonneo/2048-ai/blob/41e298f4571a9505e421e3a19af7a1cb372a368c/2048.cpp).
The independent engine's tile ranks represent 2 and 4 as ranks 1 and 2.

| Rule                                                                     | Original evidence                       | Independent evidence                             |
| ------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------ |
| Four directions on a 4 by 4 board                                        | `application.js`, `getVector`           | 16-cell board and `execute_move`                 |
| Start with two tiles                                                     | `startTiles`, `addStartTiles`           | `initial_board`                                  |
| A fresh tile is 2 with probability 0.9, otherwise 4                      | `addRandomTile`                         | `draw_tile`, chance-node weights                 |
| A fresh tile selects a uniformly random vacant cell                      | `grid.js: randomAvailableCell`          | `insert_tile_rand`                               |
| Slide toward the chosen edge through empty cells                         | `findFarthestPosition`, traversal order | move-table construction                          |
| Equal neighbors merge; unlike values do not                              | merge condition                         | move-table construction                          |
| A newly merged tile cannot merge again in the same input                 | `mergedFrom` guard                      | one-pass merge traversal                         |
| Score increases by the values of tiles created by merges                 | score increment                         | merge-history score, subtracting free spawned 4s |
| Spawn exactly one tile after a changed board; no-op inputs spawn nothing | `moved` branch                          | unchanged-board check before insertion           |
| Loss means no direction changes the board                                | `movesAvailable`                        | four-direction legal-move loop                   |

The original marks a win when a merge produces 2048, then offers continued play.
That UI flow is directly evidenced by the original's `won` flag and
`keepPlaying`; the independent solver deliberately continues beyond 2048.
P09's first-to-2048 finish and three-minute clock are the job's adaptation.

## Original-engine play and probes

The manual direction sequence was left, down, right, up, left, down, left, up,
right, down, left, up, left, down, right, up. Merge scores across its inputs were
0, 4, 4, 4, 8, 16, 20, 20, 24, 24, 24, 28, 28, 28, 36, 44. The final rows were
`[2,0,4,2]`, `[2,0,8,8]`, `[0,0,4,4]`, `[0,0,0,0]`. The first left input was a
no-op, illustrating that futile swipes cannot farm tiles or points.

These focused probes temporarily counted rather than placed the post-move
spawn, so the listed rows describe the merge result before that new tile:

| Input             | Direction | Result         | Added score | Spawn calls |
| ----------------- | --------- | -------------- | ----------- | ----------- |
| `[2,2,2,2]`       | left      | `[4,4,0,0]`    | 8           | 1           |
| `[2,2,4,0]`       | left      | `[4,4,0,0]`    | 4           | 1           |
| `[2,2,2,0]`       | right     | `[0,0,2,4]`    | 4           | 1           |
| `[2,4,8,16]`      | left      | `[2,4,8,16]`   | 0           | 0           |
| `[1024,1024,0,0]` | left      | `[2048,0,0,0]` | 2048        | 1           |

A full alternating 2/4 checkerboard had no available move. Changing one cell so
two equal cells were adjacent made that full board playable. A full board alone
must never mean loss.

## Timings, feedback, and feel

The original has no timed round: a move resolves when the player acts. Its
[stylesheet](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/style/main.scss)
specifies 100 ms tile travel, 200 ms spawn/merge effects with 100 ms delay, a
600 ms score-rise effect, and an 800 ms ending overlay after a 1200 ms delay.
These are original source-specific measurements. The port's own live reducer/
controller room checks public CSS clocks against those durations; its transient
frames are labeled ours-only rather than paired original frames.
The [input adapter](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/js/keyboard_input_manager.js)
accepts arrows, WASD, and one-finger dominant-axis swipes longer than 10 px.
Its input is immediate rather than turn-paced.

Inference from that feedback structure and engine play: satisfaction comes
from predicting where a whole row lands, earning a visibly larger number, and
recovering space before the board jams. The high tile is an achievement; the
score reflects all merges. Swiping rapidly without planning fills the board.
No upstream audio hook is present in the inspected entry and actuator scripts;
audio was not directly heard. Use PartyBox's own cues only.

## Living-room design decisions

The phone owns its board, score, goal, and swipe surface. Visible direction
buttons provide a discoverable equivalent for players who cannot swipe; arrows
or WASD/HJKL support keyboard play. All four controls need accessible direction
names, one visible focus state, and a disabled state after a board jams.

The TV shows every board together, with each name, score, and enlarged best
tile. Eight boards can sit in two rows of four; the clock and race goal remain
the focal header. The best tile is display information, while timeout standings
follow the job's highest-score rule. Equal scores share a place. A player who
jams keeps their earned score and final board under the original Game over
overlay. Ending all-jammed play early avoids dead air.

The shell already owns rules, readiness, and countdown; enter play immediately.
At the first accepted 2048 merge, freeze the race and clearly name that winner.
Otherwise stop at 180 seconds and reveal the score standings. A short results
beat should permit slow readers to identify their position, using SDK reading
time rather than a guessed fixed reading interval.

Equal seed means equal initial board and a separate random cursor for each
player. Advance a cursor only for that player's successful moves. Identical
move histories then reproduce identical boards regardless of other players'
input order. For different board layouts, use the same next random vacant-cell
rank against that player's own empty cells. This is an explicit adaptation;
the original uses unseeded randomness. Never reveal seed/cursor/future spawns
through views, and bots must evaluate visible boards without peeking ahead.

Phone-only play keeps the same primary board and all race context on the phone,
using the SDK provider/hook. Spectators receive a public race stage with no
controls. Results need all eight names to fit the 390 by 844 frame. A refreshed
phone reconstructs the current board from authoritative state; a disconnect
does not hold the clock or reset progress.

Preserve quick feedback using PartyBox motion tokens; remove transforms under
reduced motion. Use token colors, numeric labels, and words for state. No
upstream palette, fonts, branding, art, or sound is reused. Bot difficulty can
increase from legal-move choice to empty-space/merge evaluation to a shallow
visible-board search; the independent solver's README supports empty space,
edges, and corners as strategic features, not a need to copy its algorithm.
