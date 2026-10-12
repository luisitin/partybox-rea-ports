# 2048 — local rules

- README.md is the rules specification. Keep it accurate.
- Server code is pure; every phase has its own file and JSON fixture.
- Imports use only the PartyBox SDK; React is allowed in client code.
- Future spawn draws and RNG state never enter views or bot decisions.
- A changed move consumes one shared draw; a no-op consumes none.
- Run `pnpm vitest run games/2048 --maxWorkers=1` only.
- Job evidence and resume notes live in jobs/P09-2048-race/.
