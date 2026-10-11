# word-guess-race — local rules

- README.md is the spec. Keep timing, inputs, clue allocation, scoring and phone-only tables true.
- Server code is pure and deterministic; use only event.now and state.rng. Compose phases in server/index.ts.
- Phases are guess, reveal and done; each needs a matching JSON fixture.
- A live secret and other players' guessed words must never enter TV/public views or accessibility text.
- Own private guesses persist across reconnect; old-round and late inputs cannot score.
- Exact clues consume answer letters first; each leftover occurrence is matched at most once.
- Scoring is fewer guesses, then active solve time; one point per opponent beaten. Unsolved players tie at zero.
- Words are original editorial selections, lowercase ASCII with five letters; accepted includes all answers.
- Import only @partybox/game-sdk, local game modules and React in client. No new dependencies or runtime calls.
- Honor pb design tokens and reduced motion; clue state always has a mark/text as well as color.
- Phone-only players and spectators see public stage progress; spectators have no input controls.
- Run pnpm vitest run games/word-guess-race only; root runner owns typecheck, format, CI and one-browser capture.
- Record research, checks, mutation results, media hashes and KEEP GOING gains under jobs/P10-word-guess-race.
