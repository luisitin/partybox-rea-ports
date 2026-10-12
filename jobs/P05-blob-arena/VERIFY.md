# P05 verification

Runner r4-local; official game Agar.io / agar-io; historical job slug P05-blob-arena.

The inherited r5-local head 4f9e6aa passed [CI 38180746625](https://github.com/luisitin/partybox-rea-ports/actions/runs/38180746625). The official-name recovery head 672d748 passed [CI 38209133722](https://github.com/luisitin/partybox-rea-ports/actions/runs/38209133722). These green checks preceded the new lifecycle, fairness and layout fixes. They do not prove the current changes.

The rename pilot used `PB_SIM_RUNS=1 pnpm.cmd vitest run games/agar-io --maxWorkers=1`: 105/105 tests, seven files, seven complete matches, 54.99 s. `pnpm.cmd typecheck` passed. This is a pilot, not the required 7,000-match result.

Current verification is pending source freeze. Required checks: typecheck, whole formatting check, the scoped game tests and real SDK contracts, 1,000 complete matches at every count 2-8, fixed seeds 1/2/3 and 1,000 generated properties, 20 serial semantic mutations, current phase/role/stress captures at 1920x1080 and 390x844 with 80 px shell reservations at both ends, media under 10 MB and every SHA-256 byte match, fresh green PR CI.

Only this game's tests run, with one worker. Full simulations run in scoped CI. The SDK 5,000-event cap, binding three 90-second rounds and existing dependencies are unchanged. No original-site browser is launched. The new capture runner must own one local headless browser and close it in finally.

Historical results remain in the existing raw reports and [r5-history/VERIFY.md](r5-history/VERIFY.md). Old fit used bottom zero and is historical evidence only. Original access attempts and old preview inputs retain their r5-local provenance.
