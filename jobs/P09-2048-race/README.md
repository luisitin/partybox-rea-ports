# P09 2048

The canonical port is `games/2048`, id/name **2048**, on `job/P09-2048-race`.
Merge Sprint was the former working name; it is superseded. Root checked 117 core game
manifests and found no overlap. P09 is resumed by `r1-local`; claim commit `206c2c0`.

Two to eight players race identical starting boards and move-indexed tile luck.
First to 2048 wins; at three minutes, highest merge score wins. Phones use swipes,
keyboard directions or four accessible buttons. TV shows boards, best tiles, scores and clock.
Phone-only/spectator presentation, feedback and reading-safe reveals are being verified.

[PR #12](https://github.com/luisitin/partybox-rea-ports/pull/12) was ready with
[CI 38180992082](https://github.com/luisitin/partybox-rea-ports/actions/runs/38180992082).
It is reopened as draft pending canonical-name/current-source checks. Prior 76 tests,
21,000 bots, 20 mutation kills and 15 captures are historical baseline, not current PASS.
The old capture used fake shell geometry and misrouted spectator SSR; actual-host fit and
read-only spectator evidence require fresh captures. No live original play is claimed.

Install once: `corepack enable`, then `pnpm install` (Windows: `pnpm.cmd`).
Load `games/2048/server/index.ts` and canonical TV/phone entries through the SDK.
The public kit provides the SDK; owner core is read-only.

Current checks (pending):

```powershell
pnpm.cmd typecheck
pnpm.cmd format
pnpm.cmd vitest run games/2048 --maxWorkers=1 --pool=threads
```

Refresh actual-host captures, all-count/strength simulations with new reading timing,
properties/mutations/restoration hashes, media sums and CI before marking ready.
Then complete a fresh KEEP GOING loop with three consecutive no-gain reviews.
No upgraded green result or DONE is claimed.

[VERIFY.md](VERIFY.md) distinguishes pending current gates from historical evidence.
[RESEARCH.md](RESEARCH.md) and [SOURCES.md](SOURCES.md) pair the original and independent engine;
[ASSUMPTIONS.md](ASSUMPTIONS.md) records limits. [NEXT.md](NEXT.md) is the resume point;
root owns [LOOP.md](LOOP.md). All tile art/implementation are original; no original-game
or solver code/assets, runtime networking, tracking or new dependencies are added.
