# @partybox/game-sdk

Everything a game may import. Re-exports the contract types and `z` from `shared`, adds helpers and UI
primitives, and hosts the contract tests that run against every game.

## Entries

- `src/index.ts` — the PURE public surface: contract types, `z`, rng, reducer/view helpers (what `games/*/server` imports).
- `src/ui.ts` — `@partybox/game-sdk/ui`: the React primitives (what `games/*/client` and the client shells import, ADR-023).
- `@partybox/game-sdk/match`, `/speech`, `/reading`, `/testing` and the `/ui/<name>` pack components: see
  their modules below.

## Modules

One doc per module in `docs/sdk/` (T-0086): a new helper is written up in its module's doc, a new
module gets a doc and a line here. `pnpm check-drift` checks this list against the folder.

- [assets](../../docs/sdk/assets.md) — stable library ids and pure `assetUrl(id, form)` links (ADR-079)
- [answer-pack](../../docs/sdk/answer-pack.md) — the answer-pack schema and test; `compareCodeUnits`
- [card-hand](../../docs/sdk/card-hand.md) — `ui/card-hand`: the shared hand of cards (fan, arrange, sort, drag to play)
- [client-module](../../docs/sdk/client-module.md) — what a game's `client/*-entry.ts` export (ADR-050); the TV strip flags
- [contract-tests](../../docs/sdk/contract-tests.md) — the suite every game passes; `testKit` for its unit tests
- [controller](../../docs/sdk/controller.md) — the phone primitives (`Screen`, `PrimaryButton`, `VipNext`…), `usePhoneOnly`
- [curves](../../docs/sdk/curves.md) — `ui/curves`: `spring`, `settleTime`, `cubicBezier`, `easings` for fixed-target JS motion (W3C easings, a damped spring)
- [match](../../docs/sdk/match.md) — typed answers, `@partybox/game-sdk/match` (ADR-048)
- [minigame](../../docs/sdk/minigame.md) — run any game as a 20-90 s minigame in a board game: `minigameStart`/`minigameReduce`, `ui/minigame` (ADR-087)
- [names](../../docs/sdk/names.md) — `playerName`, `joinNames`
- [pack](../../docs/sdk/pack.md) — `ui/bid-pad`, `ui/dial`, `ui/face-picker`… on subpaths of their own
- [reading](../../docs/sdk/reading.md) — how long a screen of words stays up, `@partybox/game-sdk/reading`
- [rhythm](../../docs/sdk/rhythm.md) — `rhythm` (chart, judge, `defineRhythmGame`) and `ui/rhythm` (track, pads, TV and phone views): Jamboree's Rhythm Kitchen games (T-0636)
- [kaboom](../../docs/sdk/kaboom.md) — `kaboom` (`defineKaboomGame`, the 250 ms world clock, S/A/B/C grade) and `ui/kaboom` (team bar, act button, TV and phone frames): Jamboree's Kaboom Squad games (T-0646)
- [recap](../../docs/sdk/recap.md) — `isoDay`, `recapName`, `recapMarkdown`
- [reduce](../../docs/sdk/reduce.md) — `composeReduce`, the reduce skeleton in its one order
- [rng](../../docs/sdk/rng.md) — rng helpers on `RngState`; `drawFromDeck`
- [pieces](../../docs/sdk/pieces.md) — a game's pieces directory: GLB files read into meshes, `@partybox/game-sdk/pieces` (ADR-076)
- [scoring](../../docs/sdk/scoring.md) — ranks, results (co-op, teams), `pickAwards`
- [settings](../../docs/sdk/settings.md) — a game's settings at init; `impliedBy`
- [speech](../../docs/sdk/speech.md) — the reader, server side, `@partybox/game-sdk/speech` (ADR-045)
- [timer](../../docs/sdk/timer.md) — phases, `applyVip`, pause and resume, connections
- [turns](../../docs/sdk/turns.md) — teams, majority votes, whose turn
- [tv](../../docs/sdk/tv.md) — the TV primitives (`Stage`, `BigText`, `Timer`, `Scoreboard`…)
- [table3d](../../docs/sdk/table3d.md) — isolated Three thumbnails and lazy R3F/Rapier solids (provisional T-0320 subset)
- [gamepad](../../docs/sdk/gamepad.md) — a PS5 pad on the phone: `PadProvider`, `usePadPress`, `PadGlyph`, focus ring, Switch-by-position buttons
- [ui](../../docs/sdk/ui.md) — avatars, chips, server clocks, beats, stored choices, the reader, language
- [views](../../docs/sdk/views.md) — view envelopes, `vipSkipLabel`, `spectator`

## Test

`pnpm vitest --project game-sdk` (helpers) · `pnpm vitest --project 'contract*'` (every game)

`GameStation` / `StationPiece`: a game's corner of the opening living room, see `docs/sdk/client-module.md`.

## Must NOT go here

Engine or server imports, sockets, game-specific logic, anything a game shouldn't be allowed to call.
