# P10 handoff

- Runner: `r9-local`; branch: `job/P10-word-guess-race`.
- Implemented: three-round reducer, 260 answers / 1,204 accepted words, three honest bot strengths, private phone boards, letterless TV grids and every phase fixture.
- Verification scripts: `simulation.ts` runs 1,000 seeds at every count 2–8 and all three bot strengths; `fixtures.ts` creates actual reachable fixtures through three rounds and derives `done` from `reveal-last`.
- Verified locally: typecheck, 40 server tests, seven game-local SDK contract tests and 13 screen tests. The second capture pass has all 12 phase/surface screens fitting with zero overflow; real 44px phone keys. First spectator capture overflow was fixed. Browser capture closes its own Chromium in `finally`.
- CI: `.github/workflows/P10.yml`, PR-only, read-only, Node 24, one Vitest worker and 21,000 seeded simulations.
- Running: 21,000 seeded matches; 20 source mutations run sequentially after the first milestone commit. Server paths are frozen during mutations.
- Remaining: record simulations and mutation results, full game path tests and global type/format checks, hash media, create draft PR with this job's README body, wait for P10 CI green, then KEEP GOING and claim the next queue job.
