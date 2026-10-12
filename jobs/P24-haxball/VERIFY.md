# P24 verification

Runner `r3-local`, branch `job/P24-haxball`; implementation milestone `c51f050`.
Install is reused from P03. These actual results are reported by root; this documentation
pass ran no tests or browsers. Implementation is complete; final verification is pending.

| Check                  | Exact command                                                                                                     | Actual result                                                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript             | `pnpm.cmd typecheck`                                                                                              | PASS before SSR, and PASS again after the paused VIP End fix.                                                                                                                                                                                                                    |
| Client helpers         | `pnpm.cmd vitest run games/haxball/client --maxWorkers=1 --pool=threads`                                          | PASS: 23 tests / 2 files.                                                                                                                                                                                                                                                        |
| SSR evidence           | `PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/haxball/__tests__/evidence.test.tsx --maxWorkers=1 --pool=threads` | PASS: 11 tests / 1 file; 167.30 s. Started 2026-10-11 22:12:57 local / 2026-10-12 03:12:57 UTC. Final source evidence rerun remains required.                                                                                                                                    |
| Focused rules          | `pnpm.cmd vitest run games/haxball/__tests__/game.test.ts --maxWorkers=1 --pool=threads`                          | First run: 23 pass / 7 incorrect expectation failures, corrected. Rerun: 30/1 PASS, 495 ms, start 22:21:45 local / 03:21:45 UTC. Latest after paused VIP End regression/fix: 31/1 PASS, 489 ms, start 22:26:11 local / 03:26:11 UTC. Local date 2026-10-11; UTC date 2026-10-12. |
| Static/mounted capture | `node jobs/P24-haxball/capture.mjs`                                                                               | 55 static HTML/PNG pages: zero geometry or typography findings. Mounted setup failed with `SyntaxError: Unexpected identifier 'object'`; overall capture exit 1. Private browser verified closed; cleanup recorded in `media/layout.json`. Mounted verification is not passed.   |
| Complete game scope    | `PB_WRITE_EVIDENCE=1 pnpm.cmd vitest run games/haxball --maxWorkers=1 --pool=threads`                             | Initial shard interrupted before results after the pause audit found a bug; NOT PASSED. New full rerun is running as root session 2934; no result yet.                                                                                                                           |

`PB_WRITE_EVIDENCE=1` denotes the environment setting, not a PowerShell command prefix.
Set `$env:PB_WRITE_EVIDENCE = '1'`, run the stated command, then restore/remove the variable.

Pending gates:

- Final `pnpm.cmd format`, complete scoped tests and actual SDK Haxball-only contract.
- Property seeds 1/2/3 plus 1,000 reproducible sampled seeds: freeze/replay/JSON/privacy/termination.
- Default two-90-second-half simulation: 1,000 games at every count 2–8 (7,000 total), all three
  strengths; measured medians/maxima, kicks/goals, strategy coverage and estimate × 2 bound.
- `node jobs/P24-haxball/mutate.mjs`: 20 valid faults one at a time; ≥19 assertion failures;
  syntax/import failures do not count; originals restored in `finally`.
- Fix mounted setup and verify actual held controls/cues; manually inspect final TV/phone,
  phone-only/spectator and edge screenshots. Static geometry alone does not establish usability.
- Final retained media <10 MB, every media SHA-256 in SHA256SUMS.txt, green P24 PR CI,
  PR publication and three post-green KEEP GOING rounds without player-visible gains.

Original live practice and a human eight-stranger network playtest were unavailable. Research,
simulation, SSR and mounted evidence must not be presented as original live play.
