# pong-party

- The spec is README.md; update it when mechanics change.
- Server state is pure JSON; time only comes from events and randomness from the seeded SDK.
- One file per phase; regenerate every phase fixture after changing the state.
- All arena information is public. Views never expose future spawn angles or the RNG.
- Only SDK imports in server, SDK UI and React in client; no runtime network calls.
- Verify only this game: `pnpm vitest run games/pong-party --maxWorkers=1`.
- Job tools and measured evidence live in `jobs/P21-pong-party`.
