# P12 Flappy Lanes

A complete PartyBox arcade port: original gliders, identical seeded archway courses,
one-tap flight, 2–8 racers, three rounds, phone-only play and three bot strengths.

Run in the PartyBox shell through the game's TV/phone entries. This public SDK checkout
does not contain the shell; static screens and deterministic headless tools are included.

Checks: `pnpm typecheck`, `pnpm format`, `pnpm vitest run games/flappy-lanes --maxWorkers=1`.
Verification details, research, provenance and continuation notes live beside this file.
Tools under `tools/` produce fixtures, simulation measurements and screen evidence.

Reproduce the evidence from the repo root:

```sh
node --import tsx jobs/P12-flappy-lanes/tools/simulate.ts 1000
node jobs/P12-flappy-lanes/tools/mutate.mjs
node --import tsx jobs/P12-flappy-lanes/tools/fixtures.ts
node --import ./jobs/P12-flappy-lanes/tools/register-css.mjs --import tsx jobs/P12-flappy-lanes/tools/screens.tsx
node jobs/P12-flappy-lanes/tools/capture.mjs
node jobs/P12-flappy-lanes/tools/hash-media.mjs
```

The simulation covers every count from 2 to 8 and every bot strength. Capture uses one
headless Chrome process with cleanup in finally; set `FLAPPY_BROWSER` for another binary.
Open the generated HTML or PNGs in `media/` to review each phase and phone mode.

No copied assets, runtime network requests or new dependencies.
