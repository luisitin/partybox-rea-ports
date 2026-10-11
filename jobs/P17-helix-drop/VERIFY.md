# Verification — P17 Helix Drop

All results below are completed local commands, not expected outcomes.

| Check               | Exact command                                                                               | Result                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Install             | `corepack enable`, `pnpm install`                                                           | Completed once; lockfile unchanged; no dependencies added.                                                                       |
| Types               | `pnpm typecheck`                                                                            | Exit 0.                                                                                                                          |
| Format              | `pnpm format`                                                                               | Exit 0; all matched files use Prettier code style.                                                                               |
| Game + SDK contract | `pnpm vitest run games/helix-drop --maxWorkers=1`                                           | Exit 0; 6 files, 50 tests. Actual SDK suite scoped to this game.                                                                 |
| Fresh screens       | `pnpm vitest run games/helix-drop/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads` | Exit 0; four tests. All phases plus spectator, charged, recovery and exhausted states.                                           |
| Mutation campaign   | `node jobs/P17-helix-drop/mutate.mjs`                                                       | Exit 0; 20/20 actual planted bugs caught by assertion failures. Source restored after every case.                                |
| Static browser fit  | `node jobs/P17-helix-drop/capture.mjs`                                                      | 21/21 fit at 1920×1080 TV and 390×844 phone. One installed Edge process; finally closes only its owned profile.                  |
| Property/replay     | Included in the full game command                                                           | Seeds 1, 2, 3 (1,000 fast-check cases each), plus seeds 1, 2, 3 and 1,000 PRNG seeds for mixed-input replay/frozen-state checks. |
| Bot campaign        | Included in the full game command                                                           | 9,000 races: 1,000 at each of 2/4/8 players and easy/normal/sharp. Every race terminates and ranks every roster member.          |

## Simulation results

Full rows are in SIMULATION.json. Median play duration in milliseconds (2 / 4 / 8 players): easy 23,280 / 28,580 / 33,580; normal 23,880 / 29,600 / 34,180; sharp 22,980 / 29,180 / 31,980. The longest complete match is 66,500 ms, below the two-minute estimate × 2 limit of 240,000 ms.

## Mutation evidence

MUTATIONS.json records failed assertion counts. The initial launch attempt yielded no valid JSON and is excluded; the successful harness launches the existing Vitest Node entry directly, one worker, threads. Infrastructure/import failures never count as caught mutations.

| #   | Planted bug                               | Caught assertion tests |
| --- | ----------------------------------------- | ---------------------- |
| 1   | score current attempt instead of best     | 1                      |
| 2   | negate depth score                        | 2                      |
| 3   | results available before terminal phase   | 3                      |
| 4   | double rotation speed                     | 2                      |
| 5   | halve gravity                             | 1                      |
| 6   | downward bounce impulse                   | 2                      |
| 7   | remove fall speed cap                     | 1                      |
| 8   | stuck steering lease                      | 1                      |
| 9   | shorten recovery beat                     | 1                      |
| 10  | two-gap shield instead of three           | 2                      |
| 11  | never consume smash charge                | 1                      |
| 12  | danger charges two lives                  | 2                      |
| 13  | recovery erases best depth                | 1                      |
| 14  | deeper floor reduces personal best        | 3                      |
| 15  | gap ignores ball edge margin              | 1                      |
| 16  | danger excludes its boundary              | 1                      |
| 17  | race exceeds one-minute cap               | 5                      |
| 18  | reverse a right hold                      | 1                      |
| 19  | TV leaks internal steering lease          | 1                      |
| 20  | controller gives all lanes to every phone | 1                      |

## Manual visual review and hygiene

Reviewed TV play/reveal/done and phone modes by hand: all eight lanes/standings visible, distinct labelled hold controls, safe/gap/danger geometry, charged/recovery/exhausted feedback, winner and personal placement. TV body text is 36 px or larger; timer is 96 px. Phone controls exceed 44×44 px. The shell reserves 64 px and phone footer 32 px. Continuous SVG sectors remove distracting seams, and small SVG floor labels are suppressed on TV in favour of the readable floor footer. LAYOUT.json records measurements for all 21 cases.

No original assets/code copied; no new dependencies or runtime network calls. State/reducer are deterministic, inputs validate, hidden lease/PRNG data are omitted, disconnect/pause/reconnect are covered. Every source file is under 300 lines. Media is below 10 MB; SHA256SUMS.txt covers every HTML and PNG.

Limit: CUA exposes no interactive browser, so original live play was unavailable. The installed Edge was used only for our local static evidence; this is not a claim of interactive original-game research.

## CI and improvement loop

Draft PR and CI status are recorded in NEXT.md. LOOP.md records the post-green review rounds. PR stays draft until the per-job workflow is green.
