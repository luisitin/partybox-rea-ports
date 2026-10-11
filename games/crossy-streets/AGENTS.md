# Crossy Streets

- README.md is the game specification; update it with every rule change.
- Server is pure: event time and seeded state only. Highest row is never reduced by a crash.
- Every timer judges intermediate 50 ms collision samples. Do not skip ahead past hazards.
- Pause shifts the match clock; relative world and eagle clocks stay held.
- Each phase has a fixture; final score and done must come from one replay.
- Test only this game: `pnpm vitest run games/crossy-streets`.
- All artwork is original inline SVG and uses PartyBox tokens.
- No body collisions: racers may share cells without blocking one another.
