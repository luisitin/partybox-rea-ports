# Blob Arena

- README.md is the spec. Keep tuning, fixtures and measured checks in sync.
- Server is pure; time comes from event.now and every random draw advances state.rng.
- Physics uses a 100 ms grid. Relative clocks stay fixed when the match pauses.
- Each phase lives in server/phases/; spectators never receive controls.
- Run only `pnpm vitest run games/blob-arena`; verification tools live in jobs/P05-blob-arena/.
