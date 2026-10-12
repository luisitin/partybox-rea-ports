# P09 verification — current r1-local source

KEEP GOING has reopened validation for ranked final TV cards/shorter reading-safe
results, focus-preserving controls and phone-only identity. The figures below are
the immediately preceding green baseline until the final artifacts are regenerated.

Canonical `games/2048`, branch `job/P09-2048-race`. Prior working-name evidence is
historical; current proof is in the source-hashed JSON artifacts linked below.

| Check            | Exact command / evidence                                                                                     | Result                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install          | `corepack enable`; `pnpm.cmd install`                                                                        | PASS, existing lockfile/dependencies up to date                                                                                                                                                                                        |
| Types            | `pnpm.cmd typecheck`                                                                                         | PASS, exit 0 after current repairs                                                                                                                                                                                                     |
| Format           | `pnpm.cmd format`                                                                                            | PASS, exit 0; generated HTML uses a stable second embedded-CSS pass                                                                                                                                                                    |
| Own tests / SDK  | `pnpm.cmd vitest run games/2048 --maxWorkers=1 --pool=threads` (JSON reporter/output path in mutations.json) | PASS 102/102, nine files, 35.056 s; finished 2026-10-12T13:47:33.335Z; all client/test hashes stable                                                                                                                                   |
| Contracts        | Unmodified SDK suite imported by own-game contract.test.ts with discovery filtered to 2048                   | PASS 20 contracts; numeric manifest/fixture/content/termination/hidden-view checks included                                                                                                                                            |
| Properties       | Same own-game command                                                                                        | PASS seeds 1,2,3 + 1,000 distinct generated seeds; 20 mixed events each at 2/4/8 seats, full initial bytes, frozen private stream, dynamic bytes/views, monotone scores/moves and seat retention. Also 1,003 mass/symmetry/spawn cases |
| Sim              | `node --import tsx jobs/P09-2048-race/tools/simulation.ts`                                                   | PASS 21,000/21,000; every count 2–8 × easy/normal/sharp × seeds 1–1000; 313.121 s real runtime; stable server/manifest hashes                                                                                                          |
| Mutation         | `node --import tsx jobs/P09-2048-race/tools/mutate.ts`                                                       | 20/20 actual rule assertion kills; all planted sources restored and exact hashes rechecked; final baseline PASS                                                                                                                        |
| Baseline refresh | Set `MERGE_MUTATION_BASELINE_ONLY=1`, then same mutation command; unset afterward                            | Reuses retained kills only with exact affected-server/rules-test hashes, then reruns all own-game tests; current client/test source hashes stable                                                                                      |
| SSR screens      | `node --import ./jobs/P09-2048-race/tools/css-loader.mjs --import tsx jobs/P09-2048-race/tools/render.tsx`   | PASS every phase: TV1920×1080 + phone390×844, both presence modes, player/spectator; 12 extra stress frames                                                                                                                            |
| Static capture   | `node jobs/P09-2048-race/tools/capture.mjs`                                                                  | PASS27, zero outside/clipped/header or board-caption overlaps, all TV text≥32px and controls≥44px; browser closed in finally, remaining owned PIDs[]                                                                                   |
| Hash/budget      | `node --import tsx jobs/P09-2048-race/tools/evidence.ts`                                                     | PASS60 media files/checksums, 8,286,236bytes < decimal10MB; exact current sim/mutation/baseline source hashes checked                                                                                                                  |
| CI               | `gh pr checks 12`; `.github/workflows/P09.yml`                                                               | First repaired milestone2861584 green: [P09 run38257501623](https://github.com/luisitin/partybox-rea-ports/actions/runs/38257501623), kit38257501574. Final evidence/copy push must also be green before ready                         |

## Simulation measurements

Each group has 1,000 completed games; every group's median play is 180,000ms.
Total-duration group medians are 202,296–265,067ms. Worst total is 275,456ms,
below the manifest's twice-estimate limit480,000ms. Default race/reveal included.
Exact count/strength medians, accepted moves and end reasons: [simulation.json](simulation.json).
Run13:31:06.002–13:36:19.124 UTC. A preceding run detected source edits and refused PASS;
it was fully rerun against the repaired source.

## Mutations

Every item below produced failed rule assertions, with test names/counts recorded
in [mutations.json](mutations.json); syntax/import failures do not count.

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

The first full restored run was101/102 and took79.498s; only the property file
was reported failed at58.014s. Its exact assertion error was not retained, so timeout
is an inference. Optimizing repeated assertions/large immutable-stream serialization
preserved1,003×20events and passed property-only5/5 in2.077s (replay1.511s).
The final full source-stable102/102 rerun above is the green result. The tool now
retains failed assertion names/messages; history is kept in mutations.json.

## Manual visual QA and limits

All15 standard and12 stress frames reviewed: names, scores, boards, all eight rows,
winner/target/tie copy, no spectator controls, paused/blocked/receipt states and2/3 TV
seats. Correct public role/provider is used. Reconstructed pinned host stage854.8px
(inner788.8px), phone header60px + counter27.6px, local licensed Nunito.
The16-code-point long-name probe caught32 out-of-frame/clipped elements before repair;
current count0. Internal board/caption overlap probe also passes after board-slot repair.
Nunito ink overhang and intentional name ellipses remain in layout.json and were reviewed.

Receipt text is explicitly supplied to SSR's real status slot; feedback behavior is tested.
These are static screenshots, not a running PartyBox room. No live original browser/audio
play is claimed; repeated unavailable-provider attempts and engine-play fallback are documented.
Current source hashes: [media/current-source.json](media/current-source.json).
Every media checksum: [SHA256SUMS.txt](SHA256SUMS.txt).

KEEP GOING results are in [LOOP.md](LOOP.md); final CI/ready status is in [NEXT.md](NEXT.md).
