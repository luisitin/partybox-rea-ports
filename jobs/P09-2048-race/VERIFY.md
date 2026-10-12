# P09 verification — current r1-local source

Current source-hashed simulation, mutation and own-game test evidence is green for
canonical `games/2048`, branch `job/P09-2048-race`. Visual evidence, typecheck,
format and source/media guards pass. Repaired commit `ac19f53` passed P09 and kit
CI. Three consecutive no-gain reviews are recorded in LOOP.md; current final-head checks are visible on PR12.

| Check                      | Command / evidence                                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                    | `corepack enable`; `pnpm.cmd install`                                                                                         | PASS; existing lockfile/dependencies were up to date.                                                                                                                                                                                                                                                                                                                                         |
| Types                      | `pnpm.cmd typecheck`                                                                                                          | PASS final source, exit0, October12 15:20UTC.                                                                                                                                                                                                                                                                                                                                                 |
| Format                     | `pnpm.cmd format`                                                                                                             | PASS final source, exit0; three fixture JSON files were formatted, and `fixtures.ts --check` confirms exact semantic reproduction of the current seeded match.                                                                                                                                                                                                                                |
| Own tests / SDK            | `pnpm.cmd vitest run games/2048 --maxWorkers=1 --pool=threads --reporter=json --outputFile=<temporary directory>/vitest.json` | PASS **119/119**, ten files, **31,309 ms**; finished **2026-10-12T15:08:45.342Z**, exit 0. Every client/test source hash was unchanged before/after and matches the current worktree. Exact runtime output path is retained in `mutations.json`.                                                                                                                                              |
| Contracts                  | Unmodified SDK suite imported by own-game `contract.test.ts`, discovery filtered to 2048                                      | PASS 20 contracts within the final own-game run; numeric manifest/fixture/content/termination/hidden-view checks included.                                                                                                                                                                                                                                                                    |
| Properties                 | Same own-game command                                                                                                         | PASS seeds 1,2,3 + 1,000 distinct generated seeds; 20 mixed events per generated scenario across 2/4/8 seats, full initial bytes, frozen private stream, dynamic bytes/views, monotone scores/moves and seat retention. Also 1,003 mass/symmetry/spawn cases.                                                                                                                                 |
| Simulation                 | `pnpm.cmd exec tsx jobs/P09-2048-race/tools/simulation.ts`                                                                    | PASS **21,000/21,000**, 21 groups of 1,000; every count 2–8 × easy/normal/sharp × seeds 1–1000. **485,773 ms** real runtime; all server/manifest hashes stable and current.                                                                                                                                                                                                                   |
| Mutation                   | `pnpm.cmd exec tsx jobs/P09-2048-race/tools/mutate.ts`                                                                        | **20/20** genuine rule assertion kills; full failure names/messages retained, no syntax/import-only kills. Focused unmodified baseline PASS 42/42. All planted sources restored and exact current hashes rechecked.                                                                                                                                                                           |
| Baseline refresh           | `MERGE_MUTATION_BASELINE_ONLY=1`, same mutation tool; exact PowerShell command below                                          | PASS 119/119 after the fixture clock correction. Reused fresh kills only after exact affected-server/rules-test hashes matched; complete client/test hashes were stable and current.                                                                                                                                                                                                          |
| SSR screens                | `node --import ./jobs/P09-2048-race/tools/css-loader.mjs --import tsx jobs/P09-2048-race/tools/render.tsx` plus `--fidelity`  | PASS27 phase/stress HTMLs plus2 comparison fixtures, all29 current PNGs.                                                                                                                                                                                                                                                                                                                      |
| Static / fidelity / motion | `capture.mjs`, `fidelity.mjs`, `interactive-build.mjs`, `motion.mjs`; exact commands below                                    | PASS29 current static frames and10 fidelity PNGs individually reviewed; both visible states match original board/score;5 real accepted-move frames pass timing/handoff.                                                                                                                                                                                                                       |
| Hash/budget                | `node --import tsx jobs/P09-2048-race/tools/evidence.ts`                                                                      | PASS79 media/fidelity files with independently verified checksums, about8.25MB below decimal10MB; source guards all match. Final rerun follows document formatting.                                                                                                                                                                                                                           |
| CI                         | `gh pr checks 12`; `.github/workflows/P09.yml`                                                                                | PASS repaired ac19f53: [P09 run38269913419](https://github.com/luisitin/partybox-rea-ports/actions/runs/38269913419) and [kit run38269913417](https://github.com/luisitin/partybox-rea-ports/actions/runs/38269913417). [Current final-head checks](https://github.com/luisitin/partybox-rea-ports/pull/12/checks) must also be green before ready; review commits change documentation only. |

## Simulation measurements

Each cell below is a total-duration median in milliseconds, including play and
reveal. **Every count/strength group completed exactly 1,000 games**, and every
group's median play duration is **180,000 ms**.

| Players |    Easy |  Normal |   Sharp |
| ------- | ------: | ------: | ------: |
| 2       | 196,669 | 196,669 | 196,669 |
| 3       | 199,699 | 199,699 | 199,699 |
| 4       | 202,729 | 202,729 | 202,729 |
| 5       | 205,760 | 205,760 | 205,760 |
| 6       | 208,790 | 208,790 | 210,521 |
| 7       | 211,820 | 211,820 | 213,552 |
| 8       | 214,850 | 214,850 | 216,582 |

Worst total completion is **220,911 ms**, below the manifest's twice-estimate
limit **480,000 ms**. The sequential two-second bot cadence produced 20,902 clock
finishes and 98 blocked finishes; target payoff, boundary, pause/resume and reload
paths are covered by the final rule/controller tests. Every sampled bot input was
schema-valid, and every completion had finite scores for all seats and winners.

The fresh run started **2026-10-12T14:54:17.991Z** and finished
**2026-10-12T15:02:23.764Z**. [simulation.json](simulation.json) records exact
source hashes, medians, maxima, accepted moves, end reasons and complete counts.
The preceding intermediate run completed 21,000 but detected source edits and
refused PASS; the fresh run restarted from seed 1 after the final generalized
3,000 ms terminal payoff clock was released.

## Mutations and restored baseline

Every item below produced semantic rule assertion failures. Test names, counts and
exact failure messages/stacks are retained in [mutations.json](mutations.json);
syntax/import failures do not count.

1. Merge unequal tiles.
2. Wrong merged tile value.
3. Half merge points.
4. Reuse the second tile.
5. Reverse right input.
6. Ignore vertical merges.
7. No empty-cell mobility.
8. Wrong spawn normalization.
9. Always spawn a four.
10. No-op spends a spawn.
11. Duplicate input accepted.
12. No anti-flood interval.
13. Deadline accepts final move.
14. Target never ends race.
15. Blocked boards never end race.
16. Wrong draw index.
17. Score ignores earlier merges.
18. Finished loses to higher score.
19. Reveal timer never exits.
20. Future draws leak to public views.

The fresh post-mutation full baseline initially passed 118/119 in 28,477 ms. Its
only failure was the winning-board payoff test: a synthetic device timestamp of
50,000 ms was earlier than the SDK's shared real wall-clock reading, so static
rendering incorrectly treated the payoff as expired. The fixture now freezes the
device clock at `Date.now() + 1000` while preserving the server-time boundaries
20,000/22,999/23,000 ms, blocked payoff and pause/resume expectations. **No assertion
was weakened and no production server rule changed.** Exact initial failure and
green refresh remain in `baselineAttempts`.

The final refresh used this exact PowerShell command, keeping the original fresh
20 kills only after their affected-server and rules-test hashes matched:

```powershell
$env:MERGE_MUTATION_BASELINE_ONLY = '1'; try { pnpm.cmd exec tsx jobs/P09-2048-race/tools/mutate.ts } finally { Remove-Item Env:\MERGE_MUTATION_BASELINE_ONLY }
```

The final artifact has `passed: true`, `incomplete: false`, `restored: true` and
`restoredBaseline.sourcesStable: true`. Rehashing the current simulation sources,
affected mutation sources, focused rule tests and every final baseline client/test
source found **zero mismatches**. The test command ran only `games/2048` with one
thread worker; this verification agent started no browser.

Root's final diff audit caught a milestone that accidentally committed the planted
unequal-merge comparison while mutation testing was in progress. The working tree
retains the correct `a === values[i + 1]` rule, and all fresh evidence hashes that
restored equality source. The defect is repaired before the final push; the final
commit must retain those bytes and pass CI before the job is ready. No defective
milestone hash is used as current source provenance. That milestone's CI stopped
at format, so its tests did not run and CI did not detect the merge defect.

## Final visual QA

The final render uses the real SDK components/providers and reconstructed pinned
host chrome. `render.tsx` generates27 phase/stress HTMLs and `render.tsx --fidelity`
adds2 matched original-board fixtures. `node jobs/P09-2048-race/tools/capture.mjs`
captured all29 atTV1920×1080 orphone390×844. Every current frame passes viewport,
outside, clipping, board-caption and header-overlap checks. Essential TV text is
at least32px; all28 direction targets are at least44px. The29 current PNGs and
historical negative TV baseline were individually viewed. Raw overflow480 is
retained, not claimed zero:112 deliberate ellipses and font ink overhang were
reviewed separately from actual clipping. See `media/manual-review.json`.

`node jobs/P09-2048-race/tools/fidelity.mjs` reads public semantic board cells and
score text, verifies both against the original capture, checks280px square boards
and creates the4-column comparison. Root individually viewed all10 fidelity PNGs.
The pinned classic original was played with ordinary keys in a fresh profile;
the hosted site redirects to the2026 redesign. Exact boards/scores and provenance
are recorded in `games/2048/fidelity/{original,ours}-states.json`.

`node --import tsx jobs/P09-2048-race/tools/interactive-build.mjs`, then
`node jobs/P09-2048-race/tools/motion.mjs`, uses a temporary own-game room with the
real reducer, views and Controller. Real button inputs yield+4 and+2048 receipts.
Five transient frames show50/200ms ordinary and target merges, plus the target
overlay at2500ms. Public CSS checks pass100ms travel,200ms spawn/merge delayed100ms
and600ms score rise; the target then hands off to both final rows with no board
or controls. Source hashes are stable/current. JS debugger holds cleanup while
CSS clocks seek; these transients are ours-only, checked against original CSS.

Each browser closes in finally and exact-profile cleanup verified zero owned
Chrome PIDs. Temporary reference/bundle/profile files remain outside the public
repository. None of these is a running PartyBox server session; original audio
was not heard. The Arial fallback is the documented remaining font difference.
Fresh media/source provenance is in
[media/current-source.json](media/current-source.json), with checksums in
[SHA256SUMS.txt](SHA256SUMS.txt).

KEEP GOING results are in [LOOP.md](LOOP.md); final CI/ready status is in
[NEXT.md](NEXT.md).
