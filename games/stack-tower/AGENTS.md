# stack-tower — local rules

- README.md is the spec. Keep timings, scoring and phone-only screens accurate.
- Imports: @partybox/game-sdk; React in client; test/tool imports are verification only.
- One reducer file per phase; no clocks, timers, randomness or I/O in server code.
- Moving geometry is shared by server, bot and SVG; event.now alone judges a drop.
- Drops carry attempt and level to reject stale duplicate packets. Best height survives retries.
- Verify only this game: pnpm vitest run games/stack-tower; typecheck; format.
- Generate fixtures/media with pnpm exec tsx jobs/P16-stack-tower/tools/render.tsx.
