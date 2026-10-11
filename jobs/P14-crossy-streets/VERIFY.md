# Verification

Local core checks passed; screen fit and scoped PR CI are recorded below as they complete.

Setup: `corepack enable`, then `pnpm.cmd install` — passed; existing lockfile reused. No new dependency.

Original-play tool check: in-app browser creation unavailable; browser inventory empty. Alternate research evidence and limitation recorded in ASSUMPTIONS.md.

## Seeded simulations — passed

Exact final command, run in Git Bash with a TTY:

```sh
node --import tsx jobs/P14-crossy-streets/simulate.ts
```

Exit 0. `sim-results.json` records 7,000 completed games: seeds 1–1,000 at **every** supported player count, 2–8. Each count includes easy 334, normal 333 and sharp 333 games, cycling strengths by seed. The real reducer receives its current timer beat and schema-checked bot inputs. Every game produces complete results within the manifest estimate × 2 budget of 240,000 ms; state JSON stays within 256 KiB. Wall time: **291,345 ms**. Median play length is **60,000 ms** at every count; the score hold makes maximum total length **68,000 ms**.

| Players | Completed | Median play ms | Max total ms | Mean best rows/player | Deaths |
| ------- | --------- | -------------- | ------------ | --------------------- | ------ |
| 2       | 1,000     | 60,000         | 68,000       | 46.4705               | 8,152  |
| 3       | 1,000     | 60,000         | 68,000       | 46.4783               | 12,355 |
| 4       | 1,000     | 60,000         | 68,000       | 46.2835               | 16,289 |
| 5       | 1,000     | 60,000         | 68,000       | 46.4100               | 20,369 |
| 6       | 1,000     | 60,000         | 68,000       | 46.6333               | 24,123 |
| 7       | 1,000     | 60,000         | 68,000       | 46.5096               | 28,162 |
| 8       | 1,000     | 60,000         | 68,000       | 46.5524               | 32,361 |

This is 1,000 games per player count across three strengths, not 1,000 per strength. The optional additional 9,000-game full strength matrix was omitted after the required run exceeded the 90-second extra-work budget.

`sim-baseline.json` is explicitly **incomplete**: the old bot run was interrupted after 1,000 seeds each at 2 and 3 players. The completed two-player baseline is comparable with the final two-player run: mean best rows increased from 41.834 to 46.4705 (+11.08%); deaths decreased from 13,075 to 8,152 (−37.65%) after fixing recovery cadence. It is not counted toward final termination coverage.

After closing Windows loader workers, the executable cleanup was checked separately:

```sh
node --import tsx jobs/P14-crossy-streets/simulate.ts --runs 1 --players 2 --matrix full --out jobs/P14-crossy-streets/sim-cli-smoke.json
```

All three strengths complete seed 1 in 68,000 ms. This smoke run is separate from the 7,000-game evidence.

## Mutation check — passed 20/20

```sh
node jobs/P14-crossy-streets/mutations.mjs
```

Exit 0. The runner plants one bug in a production file at a time, runs **only** mechanic tests with one worker, records actual assertion failures in `mutation-results.json`, and restores the original file in `finally`. Transform/load failures do not count as catches. It invokes the equivalent of:

```sh
pnpm vitest run games/crossy-streets/__tests__/game.test.ts --pool=threads --maxWorkers=1
```

The actual subprocess is Node invoking `node_modules/vitest/vitest.mjs` with those arguments, avoiding Windows command shims. Original baseline: exit 0, 867 ms. Restored baseline: exit 0, 1,706 ms. **All 20 behavioral mutants were caught**, above the required 19. The record includes each real exit code, elapsed time and failed assertion.

| ID  | Planted bug                                    | Result |
| --- | ---------------------------------------------- | ------ |
| M01 | Score current row instead of highest row       | Caught |
| M02 | Award a new high score for a lethal hop        | Caught |
| M03 | Ignore the exact eagle idle deadline           | Caught |
| M04 | Reset the eagle clock with sideways hops       | Caught |
| M05 | Remove hop throttling                          | Caught |
| M06 | Respawn immediately at the next sample         | Caught |
| M07 | Erase the highest row on death                 | Caught |
| M08 | Logs stop carrying runners                     | Caught |
| M09 | Cars never collide                             | Caught |
| M10 | Water gaps become safe land                    | Caught |
| M11 | Trees permit hopping through them              | Caught |
| M12 | Side edges no longer kill                      | Caught |
| M13 | Judge only the final sample of a delayed timer | Caught |
| M14 | Race lasts 61 seconds                          | Caught |
| M15 | Accept timers before their deadline            | Caught |
| M16 | Accept stale or wrong-phase timer keys         | Caught |
| M17 | Score phase never exits                        | Caught |
| M18 | Leak authoritative RNG into stage views        | Caught |
| M19 | Send all future lanes to every screen          | Caught |
| M20 | Resume without shifting the simulation epoch   | Caught |

Harness history: the first command-shim attempt caught all 20 but timed out while closing its restored baseline; a direct-node fork-pool retry was interrupted before planting any bug. The successful evidence above uses Node directly, a thread pool and one worker. Source was restored in every planted-mutation attempt. These failed harness attempts are not counted as passing checks.

## Fixtures and property coverage

`pnpm.cmd exec tsx jobs/P14-crossy-streets/fixtures.ts` generated play, score and done fixtures from a real seed-14 eight-sharp-bot match after the final recovery fix. Play is sampled at 15 seconds. Done is exactly the score fixture played forward through the SDK `finishGame` helper; the fixture contract asserts this equality.

The scoped game suite includes fixed property seeds **1, 2, 3** and **1,000 generated seeds** from SDK `createRng(0x14c0ffee)`, with deterministic paired event traces, totality, declared phases, valid runner coordinates and JSON/state budgets. The SDK-backed scoped contract uses actual `loadGame`, `playGame`, `replay`, `fuzzOnce`, `hashState`, `finishGame` and test-kit helpers. Final test commands/results are recorded below by the root runner.

## Local core checks

- `pnpm typecheck` — exit 0 after correcting the tests' SDK pushed-view `vip` wrapper; production types pass.
- `pnpm vitest run games/crossy-streets --pool=threads --maxWorkers=1` — 5 files, 55 tests passed; 119.21 seconds on the shared desktop. No other game's tests ran. Includes 24 mechanic/lifecycle tests (three bot recovery regressions), 10 SDK contract tests, 5 property checks, 10 phone-only/reconnect checks and 6 screen checks.
- `pnpm vitest run games/crossy-streets/__tests__/screens.test.tsx --pool=threads --maxWorkers=1` — 6/6 passed in 1.04 seconds after fixing measured TV rail overflow and the phone's intrinsic narrow width.
- `pnpm format` initially identified regenerated JSON/HTML formatting. Only this job's generated files were formatted; the final green command is recorded with the release evidence.
- Final `CI=1 pnpm format` — exit 0, all matched files use Prettier style.

The earlier fork-pool run exposed a Windows worker-termination timeout. Final local tests use one thread worker; the CI workflow runs the same scoped suite with one worker on Ubuntu. No whole-suite browser run was performed.

## Screens — passed

`node jobs/P14-crossy-streets/capture.mjs` captures the actual React SSR components from all phase fixtures. One disposable headless Chromium visits twelve static HTML files sequentially and closes in `finally`. Each phase has TV (1920×1080), TV-connected phone, phone-only and spectator (390×844). The shell allowance is included: TV content height 944 px, phone content height 756 px.

All twelve records in `screen-metrics.json` are `fit: true`: no document overflow, no clipped heading/paragraph/list/control and all four play targets are at least 116.65×88 px. The first measured TV layout clipped the last racer and explanatory paragraph; constrained grid rows, explicit score line-height and removal of redundant rail prose eliminate the overflow. Full-width phone layout increases control width from 94.65 to 116.65 px. Logical SVG clipping keeps periodic hazard copies inside the playable map.

Root visually inspected play/score/done TV PNGs; research agent inspected all nine phone/spectator PNGs. All eight standings entries fit; the play map, numbers, directions, 128 px TV timer and final winner are readable. The result phone instruction and off-map status are queued for the required post-CI KEEP GOING loop.

`node jobs/P14-crossy-streets/hash-media.mjs` records SHA-256 for every HTML/PNG in `SHA256SUMS.txt` and enforces the 10 MiB media limit. CI status is recorded after opening the draft PR.

Final media: 24 files, 1,434,836 bytes. `sha256sum --check SHA256SUMS.txt` from the job folder — exit 0, all 24 match.
