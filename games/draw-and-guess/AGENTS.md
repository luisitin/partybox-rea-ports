# Draw and Guess

- README.md is the game specification; keep it true.
- Server time comes only from events and randomness from state.rng.
- Keep choices and the selected word off every non-drawer view until reveal.
- Bots guess from the public mask and vocabulary, never the selected word.
- Bound stroke and guess histories; replayed stroke sequence numbers are ignored.
- Run only `pnpm vitest run games/draw-and-guess --maxWorkers=1`.
