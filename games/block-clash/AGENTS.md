# block-clash — local rules

- README.md is the spec; mechanics and views must agree with it.
- The server is pure: event time and state-rooted seeded randomness only.
- One file per phase; every phase has a JSON fixture.
- Never expose sequence, bot plans, or a rival's next or held piece in a view.
- Preserve the chronological gravity/lock scheduler and bounded lock resets.
- Test only this game: `pnpm vitest run games/block-clash`.
