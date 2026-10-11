# P09 sources and provenance

Accessed 2026-10-11. All links below are primary sources. Only mechanics and
behavior were studied. No external code or assets are shipped in this job.

## Original creator

[Gabriele Cirulli's source repository](https://github.com/gabrielecirulli/2048)
was inspected at `478b6ec346e3787f589e4af751378d06ded4cbbc` (master, verified with
`git ls-remote`). It describes the original game and links its inspirations.

- [Game manager](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/js/game_manager.js): initialization, slide/merge ordering, scoring, spawning, no-op input, win/loss, and continued play.
- [Grid](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/js/grid.js): empty-cell selection and board serialization.
- [Input adapter](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/js/keyboard_input_manager.js): four-direction keys, swipe threshold, dominant-axis selection, and ignored multitouch.
- [Stylesheet](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/style/main.scss): authored animation durations and ending-overlay delay; palette and font were not reused.
- [Actuator](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/js/html_actuator.js): board presentation, score additions, and terminal overlays.
- [Application entry](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/js/application.js): original 4 by 4 initialization.
- [Creator's license](https://github.com/gabrielecirulli/2048/blob/478b6ec346e3787f589e4af751378d06ded4cbbc/LICENSE.txt): MIT; no upstream implementation or asset was copied despite its availability.

The creator's hosted URL, `https://gabrielecirulli.github.io/2048/`, was the
target of the failed browser-play attempt. Browser inventory was empty. The
upstream engine was then exercised in memory through a Node VM; its transcript
and limitations are in [RESEARCH.md](RESEARCH.md).

## Independent primary implementation

[Robert Xiao / nneonneo's 2048 AI repository](https://github.com/nneonneo/2048-ai)
was inspected at `41e298f4571a9505e421e3a19af7a1cb372a368c` (master, verified with
`git ls-remote`). Its C++ engine is independent of the original JavaScript.

- [Engine](https://github.com/nneonneo/2048-ai/blob/41e298f4571a9505e421e3a19af7a1cb372a368c/2048.cpp): independently corroborates two starting tiles, 90/10 spawning, random empty cells, four-direction compression, one merge per move, score from merge history, no-op rejection, and loss when no move changes the board.
- [README](https://github.com/nneonneo/2048-ai/blob/41e298f4571a9505e421e3a19af7a1cb372a368c/README.md): author describes bot use and strategic empty-space/edge/corner features. Its solver is research context; the port's bot implementation is original.
- [License](https://github.com/nneonneo/2048-ai/blob/41e298f4571a9505e421e3a19af7a1cb372a368c/LICENSE): MIT; no solver code is copied or depended on.

The engine's representational cap at 32768 is irrelevant to the port's 2048
finish and is not adopted. The solver continues after 2048; first-to-2048 race
termination and the 180-second cap come directly from this repository's P09 job.

## Port provenance

- Rules: independently implemented from the researched behavior above.
- Race, shared seeding, finish order, and phone/TV split: P09, `RULES.md`, `docs/GAME_CONTRACT.md`, and `docs/DESIGN_SYSTEM.md`.
- UI: original React/CSS with `design/tokens.css` and published SDK primitives.
- Tiles: numeric text and CSS; no external artwork, logos, sprites, font files, or audio.
- Runtime: local SDK only; no calls to the original game, external research sites, or tracking services.

No third-party asset license is required because no third-party asset is used.
