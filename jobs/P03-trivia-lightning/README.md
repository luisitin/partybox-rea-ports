# P03 Quizizz

A self-paced trivia race for 2–8 players. Each phone shows its own question and four labeled
answers; the TV shows named race lanes, progress, scores and a shared clock. Original question
packs, three bot strengths, phone-only play and spectator views are included.

The Quizizz / Gold Quest research contributes independent pacing, immediate personal feedback
and a shared standings race. The port uses earned energy for a brief rival freeze or doubling
the next correct answer. Scoring and those abilities are original PartyBox rules.

## Run

```sh
corepack enable
pnpm install
pnpm vitest run games/quizizz
```

Import `game` from `games/quizizz/server/index.ts` in a PartyBox registry; load the
matching `client/tv-entry.ts` and `client/phone-entry.ts` on each surface. The reference repo
publishes SDK primitives rather than a complete LAN room host.

## Check

```sh
pnpm typecheck
pnpm format
pnpm vitest run games/quizizz
```

The game's tests cover pure deterministic transitions, the SDK contract, private answer keys,
three bot strengths, reconnect/pause, seeded simulations, and phone-only/spectator rendering.
The verification log records exact commands, timings, 20 planted mutations and media hashes.
CI runs the same checks scoped to this game.

- Game spec: `games/quizizz/README.md`
- Research / provenance: `RESEARCH.md`, `SOURCES.md`, `ASSUMPTIONS.md`
- Verification: `VERIFY.md`, `SHA256SUMS.txt`, `media/`
- Handoff / improvement passes: `NEXT.md`, `LOOP.md`

The official Quizizz name follows the owner's JOBS.md naming instruction. All question text,
art and styles are original; no vendor assets, code, fonts, tracking or runtime calls are used.
Live-original research limits are disclosed in ASSUMPTIONS.md.
