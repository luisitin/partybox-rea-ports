# P12 Flappy Lanes

A complete PartyBox arcade port: original gliders, identical seeded archway courses,
one-tap flight, 2–8 racers, three rounds, phone-only play and three bot strengths.

Run in the PartyBox shell through the game's TV/phone entries. This public SDK checkout
does not contain the shell; static screens and deterministic headless tools are included.

Checks: `pnpm typecheck`, `pnpm format`, `pnpm vitest run games/flappy-lanes --maxWorkers=1`.
Verification details, research, provenance and continuation notes live beside this file.
Tools under `tools/` produce fixtures, simulation measurements and screen evidence.

No copied assets, runtime network requests or new dependencies.
