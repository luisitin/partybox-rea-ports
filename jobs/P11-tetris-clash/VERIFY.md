# P11 verification

Runner: `r11-local`. Windows uses `pnpm.cmd` because its PowerShell shim is blocked.
Only Block Clash tests run; `--maxWorkers=1` limits CPU use.

| Check        | Exact command                                                                                                                                                              | Result                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Install once | `corepack enable`, `pnpm.cmd install`                                                                                                                                      | Passed; existing lockfile and dependencies retained.                                                                                                         |
| Types        | `pnpm.cmd typecheck`                                                                                                                                                       | Passed, including the optimized strategy.                                                                                                                    |
| Formatting   | `pnpm.cmd format`                                                                                                                                                          | Initial failure from temporary browser profile and generated HTML; profile archived and HTML formatted; repeat passed.                                       |
| Scoped tests | `pnpm.cmd vitest run games/block-clash --maxWorkers=1 --reporter=default --reporter=json --outputFile=jobs/P11-tetris-clash/tools/test-results.json`                       | Initial 68/69 assertions passed. Bot helper import and SDK skipper timeout repaired; final repeat pending.                                                   |
| Bots         | `pnpm.cmd vitest run games/block-clash/__tests__/bots.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=jobs/P11-tetris-clash/tools/bot-results.json` | Running 1,000 seeds at each count 2–8, cycling all three strengths.                                                                                          |
| Mutation     | `node jobs/P11-tetris-clash/tools/mutate.mjs --out jobs/P11-tetris-clash/tools/mutation-results.json`                                                                      | Passed: 20/20 executable mutations caught, 44 baseline assertions, source hashes restored.                                                                   |
| Properties   | Included in the scoped game command; `pnpm.cmd vitest run games/block-clash/__tests__/properties.test.ts --maxWorkers=1`                                                   | Passed: explicit seeds 1, 2, 3 plus 1,000 generated seeds; also 1,000 rotation cases.                                                                        |
| SDK contract | `pnpm.cmd vitest run games/block-clash/__tests__/contract.test.ts --maxWorkers=1`                                                                                          | Passed 20/20 in the final scoped run. Real SDK suite imported through the game's unique shard; wrapper allows 60 seconds under desktop contention.           |
| Screens      | `pnpm.cmd vitest run games/block-clash/__tests__/screens.test.tsx --maxWorkers=1`                                                                                          | Passed three phase render assertions. Writes 15 HTML files: each phase TV, player with TV, player phone-only, spectator with TV, spectator phone-only.       |
| Capture      | `node jobs/P11-tetris-clash/tools/browser-check.mjs`                                                                                                                       | One isolated existing Chrome instance; 12 PNGs at 1920×1080 / 390×844. Every phase inspected by hand. Browser closed in cleanup; no whole-suite browser run. |
| CI           | `.github/workflows/P11.yml`                                                                                                                                                | Draft PR and workflow run pending. Ubuntu, 30-minute limit, read-only permissions, actions/* only.                                                           |

## Mutation inventory

1–4. Single/double/triple/four-line score tables. 5. Hard-drop points. 6. Combo score. 7. Back-to-back multiplier. 8. Outgoing attack table. 9. Cancellation before outgoing garbage. 10. Hold once per piece. 11. Hold re-enabled after lock. 12. Pending queue cap. 13. Garbage insertion batch cap. 14. Ceiling top-out. 15. Spawn top-out. 16. JLSTZ wall-kick order. 17. I-piece wall kicks. 18. 120-second play exit. 19. Score phase exit. 20. Hidden future piece leakage.

The mutation report records each changed source expression and command result; each bug
is planted alone and reverted in `finally` before the next mutation.

## Screen inspection

Play: eight wells, names, scores, target and 96px timer remain on the TV. The phone's
own board, three previews, hold, rival selector and six controls remain inside 390×844.
Buttons measure at least 52px; the rival selector is 44px. Browser measurements showed
viewport and scroll dimensions equal, with no element outside the viewport.
Score/done: eight standings rows fit on both devices. Phone-only users and spectators
see all eight wells locally; their standings fit below. Spectators have no controls.
Original SVG/CSS uses PartyBox tokens and shape marks; elimination includes the word OUT.
Media is below 10 MB. Hashes are regenerated after final formatting.

## Research limitation

The official live game's menu and Hold/Next panels rendered, but Play produced a black
canvas. Movement and original audio could not be measured live. Manuals and independent
public implementations supplied the mechanics evidence; ASSUMPTIONS.md records attempts.

## Placement search optimization

`pnpm.cmd vitest run games/block-clash/__tests__/strategy.test.ts --maxWorkers=1`
passed all three checks. The preserved original evaluator and occupancy-mask evaluator
returned exactly the same plans on 1,000 seeded grids ? all three strengths (3,000
comparisons), plus every piece/rotation on empty boards and phase fixtures. Grid purity
was checked. This lowers allocation cost without changing the move heuristic.
