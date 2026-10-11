# P09 Merge Sprint

A complete PartyBox race based on the sliding number puzzle studied for P09.
2–8 players race identical starting boards and move-indexed tile luck.
First to 2048 wins; at three minutes, highest merge score wins.
Swipes and four accessible arrow buttons control each phone board.
The TV shows all boards, best tiles, merge scores and a large race clock.
Phone-only players and spectators see the race without needing a TV.

## Run

`corepack enable`, then `pnpm install` (Windows: `pnpm.cmd install`).
Load `games/merge-sprint/server/index.ts` and the TV/phone entries via the SDK.
The public repository contains the SDK, not the full PartyBox network shell.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/merge-sprint --maxWorkers=1`
- Evidence, exact commands and results: VERIFY.md.
- Original mechanics and living-room changes: RESEARCH.md and SOURCES.md.
- Assumptions: ASSUMPTIONS.md. Resume point: NEXT.md.
- Screens and checksums: media/ and SHA256SUMS.txt.
- Quality iterations: LOOP.md.

All implementation, tile art and styling are original. No runtime networking,
tracking, copied source, external assets, or new dependencies.
