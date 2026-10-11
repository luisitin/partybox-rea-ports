# P16 Skyline Stack

Complete PartyBox arcade port: 2–8 simultaneous towers, one-tap phone timing,
45-second race, cut overlap, perfect-streak regrowth, best-height retries,
phone-only stage, spectators, three bot strengths and deterministic reconnect.

## Run

```sh
corepack enable
pnpm install
pnpm vitest run games/stack-tower
```

The shell loads `games/stack-tower/client/tv-entry.ts` and `phone-entry.ts`.
The pure plugin is `games/stack-tower/server/index.ts`.

## Check

```sh
pnpm typecheck
pnpm format
pnpm vitest run games/stack-tower --maxWorkers=1
pnpm exec tsx jobs/P16-stack-tower/tools/sim.ts
```

Additional scoped media and mutation tools are documented in VERIFY.md.
On Windows PowerShell use `pnpm.cmd` to avoid execution-policy restrictions.
Spec: `games/stack-tower/README.md`. Research and provenance: RESEARCH.md,
SOURCES.md. Test measurements: VERIFY.md. Continuation: NEXT.md and LOOP.md.

Original art only. No new dependencies or runtime network access.
