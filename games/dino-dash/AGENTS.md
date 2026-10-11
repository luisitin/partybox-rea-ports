# dino-dash — local rules

- README.md is the spec; keep timings, physics, scoring and view descriptions true.
- One file per phase under server/phases/; each phase needs fixtures/<phase>.json.
- Server code is pure: event.now supplies time, state.rng supplies randomness.
- Imports only @partybox/game-sdk (+ react for client); no runtime network or dependencies.
- Every lane uses the same seeded course, ramp and collision rules; death freezes distance.
- Jump is a tap and duck is a hold. Cancel, key release and disconnect must not latch duck.
- Phone-only and remote players receive a readable public stage; spectators have no controls.
- Use original comet/rock/bird art and SDK cues; never include source game media or branding.
- Targeted check: pnpm vitest run games/dino-dash; also run pnpm typecheck and pnpm format.
- Verification and handoff live in jobs/P13-dino-dash/; keep NEXT.md current.
