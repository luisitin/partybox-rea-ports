# P04 verification

Windows11, Node24.19.0, pnpm12.4.2. `pnpm.cmd` is the Windows launcher for the
documented pnpm commands; PowerShell blocks pnpm.ps1. Only this game was tested.

| Check                        | Exact command                                                                                                   | Result                                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install once                 | `corepack enable`; `pnpm.cmd install`                                                                           | Pass, frozen dependency graph; no new dependencies.                                                                                                             |
| Types                        | `pnpm.cmd typecheck`                                                                                            | Pass.                                                                                                                                                           |
| Format                       | `pnpm.cmd format`                                                                                               | Final check recorded after media formatting below.                                                                                                              |
| Game and actual SDK contract | `pnpm.cmd vitest run games/draw-and-guess --maxWorkers=1`                                                       | 65tests passed, including20SDK contract checks. No other game's tests are loaded.                                                                               |
| Properties                   | Same scoped command                                                                                             | Seeds1,2,3:100generated traces each; seed0x50404:1,000generated random game seeds; SDK fuzz across all phases.                                                  |
| Bots                         | `$env:WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/draw-and-guess/__tests__/simulation.test.ts --maxWorkers=1` | 7,000seeded games:1,000per legal count2-8, distributed334easy/333normal/333sharp. All terminate.                                                                |
| Fixtures/screens             | `$env:WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/draw-and-guess/__tests__/evidence.test.tsx --maxWorkers=1`  | 7tests pass;5fixtures from one actual8seat match,25HTML screens: every phase TV/phone/phone-only/spectator/artist, including last reveal.                       |
| Browser fit                  | `node jobs/P04-draw-and-guess/tools/capture.mjs`                                                                | 25PNG captures at1920×1080/390×844;0viewport overflows on each. One browser, finally closed.                                                                    |
| Mutation                     | `node jobs/P04-draw-and-guess/tools/mutate.mjs`                                                                 | 20/20planted bugs caught by assertions, originals restored in finally, restored baseline passes.                                                                |
| Media/hash                   | `node jobs/P04-draw-and-guess/tools/hash-media.mjs`                                                             | 50media files under10MB, each SHA256 recorded after final formatting.                                                                                           |
| CI                           | `.github/workflows/P04.yml`                                                                                     | PR #1 workflow38175082215 passed in39seconds; marked ready only after green. Frozen install, types, format, scoped tests, read-only permissions,30minute limit. |

At2/4/8players median drawing duration (easy/normal/sharp) is
32/4/4seconds,40/8/4seconds and40/12/4seconds. Longest8seat match417seconds,
below the1,440second estimate×2 limit. Optional2lap60second boundary runs pass.
Exact count/strength summaries live in `tools/simulation-results.json`.

Mutation cases and proof: `tools/mutation-results.json`, with original/mutant
hashes and assertion logs under `tools/mutation-logs/`: M01basepoints,
M02speedpoints, M03reversed speed, M04artist points, M05score accumulation,
M06repeat scoring, M07wrong guesses, M08TV answer, M09choices, M10phone secret,
M11choice permission, M12drawing permission, M13Undo order, M14Clear,
M15stroke limit, M16hint timing, M17timeout, M18duration, M19rotation,
M20pause clock. All20caught; no syntax/import failure counted as a kill.

Hand inspection: TV has one clear drawing,96px timer,32px+ roster text,
eight visible seats. Phone drawing tools and guess bar fit; phone-only reveal
shows the answer, picture and all8scores. Spectators have no input controls.
The SSR artist pad is deliberately blank because canvas paints after mount;
the public SVG shows the actual fixture ink. `tools/layout-results.json` keeps
all viewport and44px target measurements. Initial Windows browser launcher
handoffs required DevToolsActivePort discovery; cleanup closed only job-owned
temporary profiles. Static evidence is original game UI, with no source assets.

Original interactive research was unavailable through CUA; public client
inspection plus independent source documentation is recorded honestly in
RESEARCH.md. The public repo omits the private registry/sim CLIs named by older
reference instructions, so actual SDK contract and local evidence tools are used.

R1: `node jobs/P04-draw-and-guess/tools/playcheck.mjs` runs the actual React
controller and reducer through local Vite in one browser, closed in finally.
Eight checks pass: real pointer chunk merging (20 packets/gesture), one Undo,
delayed Clear/Undo ordering, actual canvas ink, phone-only guessing fit,
390×500 keyboard-height guessing fit, immediate point receipt and solved fit.
`tools/playcheck-results.json` records 62 accepted revisions and zero overflow.
The 750-packet minute regression preserves its final point in one gesture,
with ≤3,500 points and views below 64KiB. Disconnected solvers retain an accurate
progress denominator; final two-player receipts survive immediate reveal/done.
R1 evidence now has 27 HTML and 27 PNG files, all phases plus artist progress
and solved feedback. Repeated mutation campaign catches all20bugs after R1.

R2: `$env:WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/draw-and-guess --maxWorkers=1`
passes all86tests in47.08seconds, including the real20-check SDK contract,
properties, 7,000matches, gesture regressions and five recognition checks.
Recognition measures36exact pictures,144transformed cases,72reordered/chunked
cases,50rejected unrelated scribbles and60private-information independence
comparisons. The exact-only baseline recognizes0/144transformed cases; the
public geometry matcher recognizes144/144. No mutable cache or new dependency.
R1 PR workflow38176082254 passed in40seconds.

R3: `pnpm.cmd vitest run games/draw-and-guess/__tests__/game.test.ts games/draw-and-guess/__tests__/ink.test.ts --maxWorkers=1`
passes35checks. Three new regressions prove a departed choosing artist cannot
cause an empty reveal, pause/resume rotates at the resume time, and rejoined
artists cannot apply queued choices to the next artist's turn. R2 PR workflow
38176201266 passed in40seconds.

R4: `node jobs/P04-draw-and-guess/tools/playcheck.mjs` passes10livechecks.
Its two new checks prove first-tap Clear leaves paths and revision unchanged,
and the deliberate second tap clears. Remaining pointer/edit/fit checks pass.

R5: `pnpm.cmd vitest run games/draw-and-guess/__tests__/final.test.tsx --maxWorkers=1`
passes8checks in1.00seconds. Tests identify lone/joint winners, tied ranks,
all-zero eight-way ties and all8scores across TV/phone/phone-only/spectator;
previous-turn role/solve labels disappear only in final standings.

R6: `pnpm.cmd vitest run games/draw-and-guess/__tests__/handoff.test.ts games/draw-and-guess/__tests__/final.test.tsx games/draw-and-guess/__tests__/evidence.test.tsx --maxWorkers=1`
passes26checks in2.47seconds. The reveal-only next-artist label matches the
actual next turn and skips unavailable seats. New fit artifacts cover the
longest19-character word at390×500 and long-name eight-way tied standings.

R7: `pnpm.cmd vitest run games/draw-and-guess/client/palettecontrast.test.ts --maxWorkers=1`
passes31checks. Thirty computed ink/background pairs across all5themes exceed
3:1; minimum5.243:1. Daylight sixth ink improves2.464:1→7.617:1. Values come
from shipped palette/tokens rather than expected token assignments. Typecheck passes.

R8: `node jobs/P04-draw-and-guess/tools/playcheck.mjs` passes13checks. Actual
SDK SoundProvider captures one public solve cue, exactly5final-second ticks,
no replay on repeated views, and silence while paused. Each countdown second
has a per-turn deduplication bit. Browser closes in finally before Vite cleanup.
The harness pins existing React/Zod prebundling and waits for the250ms SDK clock
sample; development reloads and premature clock assertions are avoided.

R9: Regenerated actual SSR evidence and `node jobs/P04-draw-and-guess/tools/capture.mjs`
yield32HTML+32PNG screens. All32have zero viewport overflow; long-name final
rows have zero truncation (before7/8truncated). Longest-word, keyboard-height,
eight-way tie and reveal handoff screens were checked by hand. TV winner labels
inherit32px roster type. A Windows Vitest worker emitted a cleanup timeout after
10passing evidence assertions during desktop load; it exited0 and CI remainsgreen.

R10: `pnpm.cmd vitest run games/draw-and-guess/__tests__/bot-deck.test.ts games/draw-and-guess/__tests__/recognition.test.ts --maxWorkers=1`
passes14focused checks. Selected-deck filtering is measured across200seeds per
strength and difficulty. The7,000-match easy-deck corpus now has100% eventual
solves at all three strengths, with different latency and scores; this does not
claim general human-doodle recognition or medium/hard balance. At2/4/8seats,
median drawing seconds are easy24/32/32, normal4/8/12 and sharp4/4/4.
Worst8-seat elapsed time is393seconds, below the1,440second doubled estimate.
The initial full run passed146/147; its old strict solved-fraction comparison
failed on the now-valid equal100% solve fractions and was replaced by
monotonic completion plus strict speed/score comparisons.
The corrected simulation command passes all9checks and all7,000games in30.51s
with one worker. CI for R9 (workflow38178011652) passed in29seconds.
