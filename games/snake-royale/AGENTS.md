# Snake Royale

- README.md is the gameplay spec. Original art and mechanics only; no copied assets.
- Server is pure and JSON; time comes from event.now and randomness from state.rng.
- Each phase has a reducer and fixture. Regenerate with the job's artifacts test.
- Tests: pnpm vitest run games/snake-royale. Never run another game's tests.
- Inputs carry absolute heading plus boost together. Public arena; no hidden game data.
- Keep bodies, food and clock catch-up bounded; scoring is current mass at round end.
