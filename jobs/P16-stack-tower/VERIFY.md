# P16 verification

Only this game's tests ran. No whole-suite browser run. Final scoped run: 91 tests across seven files, exit 0, including the legitimate-identity regression. Windows uses `--pool=threads --no-isolate` to avoid fork shutdown pressure.

| Check                 | Exact command                                                                                                  | Result                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install               | `corepack enable` then `pnpm.cmd install`                                                                      | Pass; pnpm 12.4.2, locked dependencies, no additions                                                                                                                            |
| Typecheck             | `pnpm.cmd typecheck`                                                                                           | Pass; repeated after client/tests                                                                                                                                               |
| Format                | `pnpm.cmd format`                                                                                              | Pass; checked green                                                                                                                                                             |
| Tests / SDK contracts | `pnpm.cmd vitest run games/stack-tower --maxWorkers=1 --pool=threads`                                          | Pass: 90 tests, six files, including 20 real SDK checks scoped to this game. Windows teardown warned before exit 0.                                                             |
| Simulation            | `pnpm.cmd exec tsx jobs/P16-stack-tower/tools/sim.ts`                                                          | Pass: 1,000 seeds at every count 2–8 (7,000 matches). Median round 45,000 ms at every count, max match 51,000 ms, under 120,000 ms estimate × 2.                                |
| Properties            | Scoped tests above                                                                                             | Pass: seeds 1, 2, 3 × 80 cases plus 1,000 distinct sampled seeds; reproduction corpus seed `0x1651011`. Geometry, immutable state, deterministic replay and mixed event traces. |
| Mutations             | `node jobs/P16-stack-tower/tools/mutate.mjs`                                                                   | Pass: 20/20 real source faults caught. Each original file restored in finally. Evidence media/mutations.json.                                                                   |
| Render                | `pnpm.cmd exec tsx --import ./jobs/P16-stack-tower/tools/css-loader.mjs jobs/P16-stack-tower/tools/render.tsx` | Pass: 20 actual React HTML screens (initial, play, score, done × TV, phone, phone-only, spectator, remote).                                                                     |
| Capture / fit         | `node jobs/P16-stack-tower/tools/browser.mjs --research`                                                       | Pass: 20 PNGs, 1920×1080 / 390×844, no elements beyond viewport, TV text ≥32px, timer96px. One headless Chrome closed in finally.                                               |
| CI                    | `.github/workflows/P16.yml`                                                                                    | Pending draft PR                                                                                                                                                                |

## Mutation faults

M01 double floor scoring; M02 combine best across attempts; M03 keep streak after trim;
M04 grow past base; M05 reverse trim center; M06 remove half overhang; M07 never alternate axis;
M08 remove cooldown; M09 retain attempt serial; M10 erase best on retry; M11 extend reveal;
M12 fail round expiration; M13 accept stale level; M14 accept stale attempt; M15 fail pause slider shift;
M16 accept stale timer; M17 accept disconnected input; M18 TV RNG leak; M19 phone RNG leak;
M20 suppress terminal results. All caught, with failing tests in the JSON evidence.

## Visual QA

Hand reviewed eight-player TV, phone-only retry, final phone standings, initial timing stage,
remote stage and spectator. Distinct numbered seats, labeled state, native thumb-sized button,
all eight standings visible. Fixed insufficient TV overscan to 5% token padding and shortened
generic alignment text. Media total was 4.25 MB before final evidence, below the 10 MB budget.

## Process correction

A milestone staging operation overlapped temporary mutation M03. Verified its exact difference,
restored normal streak-reset source in corrective commit 92e7b1a, and confirmed the runner restored
all worktree files. Mutation and commit operations are now sequential.
