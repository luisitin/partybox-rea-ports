# P04 Draw and Guess

A complete PartyBox drawing party for 2–8 phones: private prompt choice, live
strokes, timed letter hints, speed scoring, artist rewards, bots and phone-only
play. No original-game assets or runtime external calls.

## Run and check

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm format
pnpm vitest run games/draw-and-guess --maxWorkers=1
```

The SDK contract is imported by this game's scoped tests. Unit tests check
privacy, clocks, scoring and bounded drawing. Seeded simulations exercise 1,000
games each at 2, 4 and 8 players; properties include seeds 1, 2, 3 and 1,000 others.
Verification commands and measured outcomes are recorded in VERIFY.md.

## Deliverables

- `games/draw-and-guess/`: manifest, full spec, server phases, TV/phone views,
  original word pack, fixtures and tests.
- `RESEARCH.md`, `SOURCES.md`, `ASSUMPTIONS.md`: evidence and design decisions.
- `VERIFY.md`: exact checks, simulation metrics and mutation results.
- `media/` and `SHA256SUMS.txt`: rendered screens and integrity hashes.
- `LOOP.md`, `NEXT.md`: quality iterations and resumable status.
- `.github/workflows/P04.yml`: scoped read-only pull-request CI.

The game spec contains the phase tables, phone-only behaviour, inputs, scoring,
settings and edge cases. Public UI/client research informed mechanics; no code,
word pack, image, font, sound or brand artwork was copied.
