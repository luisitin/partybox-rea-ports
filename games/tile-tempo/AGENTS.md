# tile-tempo — local rules

- README.md is the playable spec; update it when timing, inputs, views or scoring change.
- Keep one reducer per phase in server/phases/ and one JSON fixture per phase.
- Server code is pure: time comes from events, randomness from state.rng, no I/O.
- All players use one seeded sequence; only the owning controller receives its next four rows.
- Tap inputs carry an absolute row index. Ignore duplicate, stale and future row inputs.
- A valid wrong-column tap ends only that player's run; tile count is the sole ranking key.
- Phone-only controllers include the public race standings. Spectators have no tap controls.
- Use SDK primitives and --pb-* design tokens; honour reduced motion and label states in text.
- No external art, music, runtime requests or new dependencies.
- Verify this game with pnpm vitest run games/tile-tempo; never launch a whole-suite browser run.
