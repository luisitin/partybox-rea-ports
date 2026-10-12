# P09 2048 sources and provenance

Current resume (2026-10-12): canonical product/id 2048 replaces Merge Sprint. The
pinned classic original was played in a fresh Chrome profile using ordinary keys.
The hosted URL redirects to the redesigned 2026 play2048.co site; the studied
classic revision is the explicit reference. Fresh independent access used the
[pinned raw engine](https://raw.githubusercontent.com/nneonneo/2048-ai/41e298f4571a9505e421e3a19af7a1cb372a368c/2048.cpp). Original access/probes below date from
2026-10-11. Only mechanics/behavior were studied; no original-game or solver code/assets ship.

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

The first browser-provider attempt was unavailable; the engine VM transcript is
historical research. On October 12, native headless Chrome played a temporary,
read-only checkout of the pinned original outside this public repository.
Two fresh-profile starting tiles and 12 arrow inputs (11 accepted) produced
score24. Public DOM reads and PNGs are retained in games/2048/fidelity/. The
port comparison uses those same visible boards/scores as fixtures. No original
runtime code or assets were copied into this repository. Original PNGs are
required review evidence; the original font is absent from the shipped game.

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

No third-party runtime asset is used. The capture-only host font below has its
own recorded license.

## Current capture provenance

The phase and stress captures replace the old fake-host/spectator-misrouting baseline.
They use published SDK components, correct public roles/providers and reconstructed pinned
PartyBox host chrome/global rules at `6ce46e613d3705624a56647592979613c4d6e468`.
TV Stage is 854.8 px (788.8 px inner); phone header/counter are 60/27.6 px.
The owner core advanced to `e73c6a2fb776ae355769ffa8074a24ace996b6d6` with 126 manifests;
fresh read-only checks found no 2048 overlap or relevant host geometry CSS changes.

Capture-only Nunito Variable 5.3.0 bytes and full SIL OFL in `media/NUNITO-LICENSE.txt`
come from the pinned PartyBox host via completed P01 evidence. They are not original 2048 assets
or a new runtime dependency. Source/media hashes are in `media/current-source.json` and
`SHA256SUMS.txt`. The labelled receipt stress frame supplies text to the actual SSR status slot;
effects are verified by behavioral tests and the actual accepted-move motion room.
The29 current static frames and10 fidelity PNGs were individually reviewed;
all media/fidelity hashes share the job's combined10MB budget. Motion comes from
a temporary real own-game reducer/controller room, not a PartyBox server session.

Native Chrome research superseded the unavailable in-app provider: the pinned
classic original was played with ordinary keys in a fresh profile. VM probes
remain historical engine evidence. No original audio was heard.
