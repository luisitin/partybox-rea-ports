# fruit-slice — local rules

- README.md is the spec. Keep scoring, timings and phone-only behaviour in sync.
- Server code is pure; all time is relative to `began`, randomness from `state.rng`.
- Each wave is shared, but cuts and bomb locks belong to each player separately.
- Swipes carry the wave and judged frame; reject stale, duplicated and disconnected input.
- Test only this game: `pnpm vitest run games/fruit-slice --maxWorkers=1`.
- Regenerate fixtures with `pnpm tsx jobs/P20-fruit-slice/fixtures.ts`.
