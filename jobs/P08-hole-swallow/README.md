# P08 Hole.io

Upgrade the existing Hole.io card imported as T-1141: 2–8 phone-controlled holes, authored projected city models and close local cameras. Grow from small street props to cars/buildings and swallow smaller rivals. Root selected a shared 90-second Battle-style party round: swallowed players permanently watch live leaders; no retry race.

This upgrades the same card without owner deployment. [UPGRADE.md](UPGRADE.md) records the adapter boundary. Final growth/scoring/ranking and fit are settling; [NEXT.md](NEXT.md) and [VERIFY.md](VERIFY.md) hold root's current checkpoints. Previous checks are historical.

## Run and check

Install once per clone with corepack enable then pnpm install. Load games/hole-io through a PartyBox host.

```powershell
pnpm typecheck
pnpm format
pnpm vitest run games/hole-io --maxWorkers=1
pnpm exec tsx jobs/P08-hole-swallow/simulate.ts
pnpm exec tsx jobs/P08-hole-swallow/fixtures.ts
node jobs/P08-hole-swallow/mutate.mjs
node jobs/P08-hole-swallow/render.mjs
node jobs/P08-hole-swallow/capture.mjs
```

Run only this game's tests. Captures use at most one headless browser, closed in finally; CHROME_PATH selects the installed browser. No new dependencies or runtime network/file reads.

[Fidelity references](../../games/hole-io/fidelity/REFERENCES.md) preserve complete official PC/current mobile marketing files with attribution/hashes; historical mobile observations are separate. Matching captures/comparison remain pending, with no near-identity claim.

Game spec: games/hole-io/README.md (draft awaits frozen mechanics). Research/provenance: RESEARCH/SOURCES. Assumptions/upgrade: ASSUMPTIONS/UPGRADE. Root owns NEXT/VERIFY/LOOP, campaigns, final CI and convergence. PR stays draft until every binding check passes.
