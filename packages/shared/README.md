# @partybox/shared

Types and zod schemas everybody agrees on, plus the pure PRNG and id helpers. **Dependency: zod only.**

## Key files (Phase 1)

- `src/contract.ts` — `GameDefinition`, `GameStateBase`, `GameEvent`, views, results, manifest + settings schemas.
  View envelopes carry `phaseAt`, the start of the phase instance (ADR-097; the skip time of a beat skipped into while paused, ADR-101), and may carry `clockHeldAt` while held (ADR-096) for late/reloaded screens.
- `src/protocol.ts` — socket payload schemas (`join`, `input`, `vip`, pushes) and `RoomSnapshot`.
- `src/rng.ts` — counter-based PRNG: `RngState { seed, step }`, `[value, next]` helpers (ADR-019).
- `src/settings.ts` — `coerceSetting`: one setting value against its spec (the engine's lobby rule, and games' at init).
- `src/ids.ts` — room codes (no `0 O 1 I L`), player ids, tokens (given entropy from the host).
- `src/asset-schema.ts`, `src/asset-url.ts`, `src/assets.generated.ts` — library metadata, pure URL resolution and compact generated forms (ADR-079).
- `src/version.ts` — `PARTYBOX_VERSION`.
- `src/index.ts` — the only barrel.

## Test

`pnpm vitest --project shared`

## Must NOT go here

I/O, React, sockets, anything with a clock. Engine/game logic. Dependencies other than zod.
