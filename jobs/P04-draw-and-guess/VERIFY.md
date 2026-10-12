# P04 verification

R34 countdown scope:

- `gh run view 38204596894 --log`: current R32/R33 CI is green for44c437e,41s; all331tests in32files pass in20.14s, including7,000matches and SDK/property checks.
- Pre-fix `node jobs/P04-draw-and-guess/tools/playcheck.mjs` reproduces the new assertion: the same mounted TV has5ticks before early end/restart and5after, rather than10. The script exits1 through finally, and process inspection confirms no active harness browser before the retry.
- The source resets the tick mask when entering a fresh draw from another phase. Pause and clock-offset updates stay draw-to-draw; reconnect initializes its own marker and cannot replay a past cue. Post-fix `node jobs/P04-draw-and-guess/tools/playcheck.mjs`:57checks pass, exit0; rematch tick total5→10, paused extras0, phone success1after solved remount and2after next-match solve.26chunks take one Undo, both endpoint errors0px, paused dot spacing280.7ms, all draft/brush/exact-once recovery checks and zero viewport overflows remain green. One browser closes in finally. No markup/CSS or server source changed.
- Final `pnpm.cmd typecheck`, `pnpm.cmd format` and `git diff --check`:pass, exit0. Scoped Prettier follows the generated report. `node jobs/P04-draw-and-guess/tools/hash-media.mjs`:68files,2,157,072bytes; hashes current.
- CI38205795568 is green for final gameplay source a476457: frozen install, typecheck, format and331tests in32files (26.69s), including7,000matches/contracts/properties. Latest9227289 documentation CI38205957432 is also green. R35/R36 are read-only gameplay reviews; no local verification is repeated for unchanged source.

R25/R26 milestone: local typecheck passes, exit0. Scoped ink packet/pause/target
tests pass23checks in1.41s; scoped guessDraft/draft-recovery tests pass24checks
in1.56s. Commands use `pnpm.cmd vitest run games/skribbl/client/<file>` with
`--maxWorkers=1 --pool=threads`. Full client and enhanced native checks are
running; this milestone does not claim their results. Source formatting passes.

Final R25/R26 verification:

- `pnpm.cmd vitest run games/skribbl/client/inkPackets.test.ts games/skribbl/client/inkPause.test.ts games/skribbl/client/inkUndoTarget.test.ts --maxWorkers=1 --pool=threads`:23checks pass, exit0,1.41s.
- `pnpm.cmd vitest run games/skribbl/client/guessDraft.test.ts games/skribbl/client/draft-recovery.test.tsx --maxWorkers=1 --pool=threads`:24checks pass, exit0,1.56s.
- `pnpm.cmd vitest run games/skribbl/client --maxWorkers=1 --pool=threads`:107checks in9files pass, exit0,17.55s. `pnpm.cmd typecheck`:pass, exit0.
- The first enhanced native run sampled the compact endpoint before queued delivery drained and exited1 through finally. A bounded endpoint observation replaces that timing assumption; the game assertion and endpoint are unchanged. Its unique profile has no running processes.
- `node jobs/P04-draw-and-guess/tools/playcheck.mjs`:44native checks pass, exit0. Ordinary/compact endpoint error remains0px;18chunks need one Undo. Known-unsent dots retain their preview and deliver exactly two packets195.3ms apart. Dirty paused tail resumes as [100,120]→[500,300]→[900,480], one Undo; unmounted queues send0packets. Undo aimed at a rejected new dot sends0Undo and preserves the older authoritative dot. Paused guesses retain their field without a receipt, remount safely and retry manually; automatic retries0. Unsent/newer text survives real Controller remount using the real SDK draft scope; accepted text stays cleared. All normal/Safari/keyboard/paused layouts have zero overflow and audio retains one success/five ticks/no paused extras.
- CI38200206897 passes31s for270eb72: install, typecheck, format and complete scoped suite (318checks,31files,14.35s), including7,000terminating simulations, SDK contracts and seeded properties. Server sources are unchanged from the fresh20/20mutation campaign.
- Manual review of the two new native pause screenshots confirms preserved dots, disabled tools and a readable retry field at390×500. Browser closes in finally; no active harness browser remains. Existing33SSR HTML/PNG captures remain unchanged; the two live PNGs bring media to68files/2,110,941bytes. Prettier runs after report generation and `node jobs/P04-draw-and-guess/tools/hash-media.mjs` updates all hashes.

R28 compact palette:

- `node jobs/P04-draw-and-guess/tools/playcheck.mjs`:45checks pass, exit0. Compact bitmap98.016×58.797→181.344×108.797px (3.42×area); normal358×214.797px remains unchanged, both5:3 and0px projection error. All six full labels fit one row, selected Gray retains its check/aria-pressed, and every button is46px high versus the44px token minimum. FIFO, pause, Undo, draft/remount, sounds and keyboard probes still pass; paused dot spacing is245.5ms. The identical duplicate fallback media rule introduced during parallel editing was removed; computed styling is unchanged.
- `$env:WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/skribbl/__tests__/evidence.test.tsx --maxWorkers=1 --pool=threads`:10checks pass, exit0,1.48s; all33HTML files regenerated.
- `node jobs/P04-draw-and-guess/tools/capture.mjs`:33captures pass, exit0, zero viewport overflows; its one browser closes in finally after the live browser had completed. Manual normal/compact artist review verifies readable full color names, selection mark, larger canvas and all tools fitting.
- Scoped Prettier follows all generated results and fixtures. `node jobs/P04-draw-and-guess/tools/hash-media.mjs`:68files,2,157,072bytes, hashes updated. No server sources changed.
- The initial final-format check reports the33regenerated HTML files as unformatted and exits1. `pnpm.cmd exec prettier --write 'jobs/P04-draw-and-guess/media/*.html'` fixes them; hashing is rerun afterward. Final `pnpm.cmd format` and `git diff --check` pass, exit0.
- CI38201146096 passes56s for0dec027: install/typecheck/format and complete scoped suite318checks in31files,26.92s, with all7,000matches and SDK/property checks. This is final gameplay source; subsequent no-gain reviews change documentation only.

R30 artist refresh:

- `pnpm.cmd vitest run games/skribbl/client/inkDraft.test.ts games/skribbl/client/inkPackets.test.ts games/skribbl/client/inkPause.test.ts games/skribbl/client/inkUndoTarget.test.ts --maxWorkers=1 --pool=threads`:32checks pass, exit0,2.18s. Nine new cases cover strict/bounded restore, queued strokes/tail, contiguous revision rebase,80ms mount gate, removal before send, no duplicate tail, targeted Undo/paused held ack, legacy metadata and malformed/backward/oversized snapshots. `pnpm.cmd typecheck`:pass, exit0.
- First `node jobs/P04-draw-and-guess/tools/playcheck.mjs` attempt times out at Page.navigate before game checks and exits1 in finally. No active profile remains. Target activation now precedes navigation; that RPC alone has a bounded30s deadline.
- Retried command passes51native checks, exit0. Two never-sent dots survive real same-turn Controller remount, drain exactly once in order, and a subsequent remount duplicates0packets. A dirty tail survives with [100,120]→[500,300]→[900,480], sends once and takes one Undo. The existing wrong-player unmount check sends0packets, and all pause/guess/draft/layout/audio checks remain green. Compact181.344×108.797px and46px full-label controls remain unchanged; projection/viewport errors0. Paused dot spacing189.1ms.
- The successful browser reaches finally and has no active process. Rendered markup/CSS is unchanged from R28, so33SSR captures remain current; native pause PNGs are regenerated. Scoped report formatting and `node jobs/P04-draw-and-guess/tools/hash-media.mjs` update all68hashes,2,157,072bytes. Server sources/mutation evidence remain unchanged.
- Final `pnpm.cmd format` and `git diff --check`:pass, exit0. CI38202484673 passes54s for2b12e79: install/typecheck/format and complete scoped suite327checks/32files in24.55s, with all7,000simulations, SDK contracts and seeded properties. R31 is a read-only gameplay review.

R32/R33 tool and personal-cue refresh:

- `pnpm.cmd vitest run games/skribbl/client/inkDraft.test.ts games/skribbl/client/inkPackets.test.ts games/skribbl/client/inkPause.test.ts games/skribbl/client/inkUndoTarget.test.ts --maxWorkers=1 --pool=threads`:36checks pass, exit0,3.63s; four new cases cover validated brush-only snapshots, safe hydrate/send removal, legacy defaults and malformed/backward metadata. `pnpm.cmd typecheck`:pass, exit0 before the later cue change.
- `node jobs/P04-draw-and-guess/tools/playcheck.mjs`:54checks pass, exit0. Gray/Thick survive an empty-FIFO remount; the next native stroke uses color5/width18; tools remain selected after send with0replayed packets. All existing ink/draft/pause/fit/audio checks pass.
- The added solved-phone cue assertion then fails as intended on the prior source: before1cue, after2cues, exit1 through finally. Controller seeds its marker from restored solved state and clears it on unsolved state. First verification attempt times out during Page.navigate before game checks, closes its profile and exits1. Retry passes55native checks, exit0; solvedPhoneCues=1 and remount adds0. All prior fields remain green, including191.1ms paused dot spacing. A further next-match success assertion is in progress; no final result is claimed yet.
- Final `node jobs/P04-draw-and-guess/tools/playcheck.mjs`:56checks pass, exit0. A fresh SDK match scope reuses the same Controller instance; a new correct answer advances private cue total1→2 exactly once. Restored solved screen remains at1. All earlier probes pass:24chunks need one Undo, both endpoint errors0px, paused spacing178ms, unchanged compact/full-label geometry, exact-once ink/brush/draft recovery, zero automatic guesses and zero viewport overflow. Browser reaches finally and closes. Final local `pnpm.cmd typecheck`:pass, exit0. Markup/CSS remain unchanged, so existing SSR/native images remain current; format/hash checks follow the final report.

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

R11: `pnpm.cmd vitest run games/draw-and-guess/__tests__/ink.test.ts games/draw-and-guess/__tests__/ink-geometry.test.ts --maxWorkers=1`
passes14checks. Maximum original-trace distance to simplified segments falls
from200to0logical pixels for an isolated sharp tip, and from200to0.499pixels
for the curved trace with ten large bends. Thirty warmed3,501-point curved
compactions measure0.676ms median and0.950ms p95 on this desktop; no timing
threshold is asserted. Tests also cover frozen input, deterministic output,
endpoints, direction reversals, full-minute streaming, complete Undo and wire
limits. R10 PR workflow38178466414 passed in41seconds.

R12-R14: `$env:WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/draw-and-guess --maxWorkers=1 --disableConsoleIntercept`
passes177tests in18files in82.16seconds, including7,000terminating matches,
real SDK contract, seeded properties,54-picture recognition, no-repeat bot
turns,75pointer coordinate probes and private draft/receipt boundaries.
Easy/normal/sharp median drawing times at2/4/8seats are24/4/4,32/8/4 and
32/12/4seconds. Worst8-seat elapsed is401seconds (<1,440). Easy completion
is at least99.95% in this easy-deck template corpus; normal/sharp100%.
This run exited0 despite Windows fork-cleanup timeout warnings under load;
no warning is counted as an assertion success. R11 CI passed in36seconds.
Typecheck and scoped formatting pass. Actual compact artist/retry browser
measurements and refreshed PNG/hash evidence are the next verification step.

R15-R20 final checks:

- `pnpm.cmd typecheck`: pass, exit0.
- `$env:WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/draw-and-guess --maxWorkers=1 --pool=threads --disableConsoleIntercept`:246tests in23files pass in81.24s, exit0. The one-worker thread pool avoids the desktop fork-cleanup warnings; no other game was loaded. SDK contract, seeds1/2/3 plus1,000generated seeds, all7,000bot matches and evidence generation pass. Median drawing seconds at2/4/8seats remain24/4/4,32/8/4 and32/12/4 for easy/normal/sharp; worst8-seat match401s (<1,440s).
- `node jobs/P04-draw-and-guess/tools/playcheck.mjs`:24actual browser checks pass, exit0. Both 5:3 canvases retain release-only endpoints with0px projection error. Safari visual500/layout844, ordinary390×844 and keyboard390×500 controls have zero overflow.18packets form one complete Undo gesture; accepted guesses clear, rejected retries return, newer drafts survive old receipts. One success cue and exactly5final ticks remain correctly deduplicated. Browser closes in finally; unique-profile cleanup handles Windows launcher PID handoff.
- `node jobs/P04-draw-and-guess/tools/capture.mjs`:33screens pass with zero viewport overflow, including compact artist, longest word, all8long-name tied winners and every phase/role. Manual image inspection confirms readable TV drawing/mask/timer, full phone names, scores, winner labels and compact guessing controls. Artist SSR canvas is blank by design; live checks confirm actual painted ink.
- `node jobs/P04-draw-and-guess/tools/mutate.mjs`:20/20current-source mutants caught by assertions; originals restored in finally; restored baseline green. New draw matching retains the scoring/privacy mutation anchors. Source hashes/logs were regenerated.

Milestone CI38192396855 failed only formatting of newly regenerated
`playcheck-results.json`; browser output must precede final Prettier and hashing.
The PR was returned to draft until final checks and refreshed CI pass.

Final `pnpm.cmd format` passes, exit0. Final formatting followed browser output;
`node jobs/P04-draw-and-guess/tools/hash-media.mjs` hashes all66HTML/PNG files
(2,080,808bytes, under10MB). `git diff --check` passes. No game source changed
after the246-test suite; only formatting and evidence/documentation followed.

R21: `pnpm.cmd vitest run games/draw-and-guess/__tests__/choice-reading.test.tsx games/draw-and-guess/__tests__/evidence.test.tsx --maxWorkers=1 --pool=threads`
with WRITE_EVIDENCE=1 passes14checks, exit0, in1.14s. Four added cases render
eight artist screens using the highest-word-count legal hands. The SDK
new-action reading budget drops3,030ms per hand; worst10,608→7,578ms, within
the existing8,000ms clock. Shortening only the instruction would leave8,011ms,
so the artist heading also shrinks. CI38193636532 passed48s before this review.

R21 final `pnpm.cmd typecheck` passes, exit0. The new SSR fixture supplies the
SDK's required `vip:null`; the initial missing-field compiler failure was fixed.
`node jobs/P04-draw-and-guess/tools/capture.mjs` recaptures all33screens with
zero overflow and closes its one browser in finally. Scoped Prettier follows
capture output; `node jobs/P04-draw-and-guess/tools/hash-media.mjs` hashes66files
totaling2,076,820bytes. Server mechanics are unchanged since the246-test run;
CI will run all250checks including the four new rendered-copy cases.

R22 owner update and SDK sync:

- `git merge --no-edit origin/main` incorporates the owner's official name table and current SDK. The public folder/id/name is now games/skribbl / skribbl / Skribbl.io; historical job paths and branch remain stable.
- `pnpm.cmd typecheck` passes, exit0, after fixing three new adapter-test fixture types (presence mode, Settings annotation and numeric bot seed).
- `pnpm.cmd vitest run games/skribbl/server/upgrade.test.ts games/skribbl/client/upgrade.test.tsx --maxWorkers=1 --pool=threads`:26checks pass, exit0, in970ms. Default telephone state/context/hooks and metadata are retained. Inputs cannot cross modes; private views remain private; pause/resume mirrors agree. Nine wrapped live matches at2/4/8seats × seeds1/2/3 equal direct live state/results throughout. No private implementation is imported by these tests.
- `$env:WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/skribbl/__tests__/evidence.test.tsx games/skribbl/__tests__/choice-reading.test.tsx --maxWorkers=1 --pool=threads`:14checks pass, exit0,1.11s. Vite reports a desktop shutdown timeout after assertions; this warning is recorded and does not substitute for a successful check.
- `node jobs/P04-draw-and-guess/tools/playcheck.mjs`:24native checks pass, exit0.37packets remain one Undo gesture; projection remains0px and all normal/Safari/keyboard layouts fit.
- The first renamed capture stalled before saving an image. Its isolated profile was closed, then the script reached finally and exited1. The harness now bounds RPC/open/endpoint fetches and activates its target before waiting for animation frames. `node jobs/P04-draw-and-guess/tools/capture.mjs` then passes all33screens, exit0, with zero overflow and one browser closed in finally. Manual inspection confirms the shorter artist instructions and all three large choices fit.

Historical commands above use the original working folder. Current commands
use games/skribbl; mutation server source is unchanged by the rename, and its
20/20assertion logs remain the measured prior campaign rather than edited logs.

The refreshed full run exceeded Vitest's5s default in its independent dense
geometry check under desktop load (24s); its functional assertions completed.
The20repeat, nonasserting benchmark was unnecessary in every test run and is
removed. The same deviation, corner, wire, endpoint, immutability and determinism
assertions retain a bounded60s deadline. Earlier isolated performance measurements
remain historical evidence; the focused rerun and full final results follow.

Final release evidence for89baf2d:

- CI38196617993 passes36s: install, typecheck, format and `pnpm vitest run games/skribbl --maxWorkers=1`;276tests in27files pass in14.98s, including all7,000bot matches, real SDK contracts and seeded properties. Worst8-seat match remains401s. This is the complete green final-source suite.
- The duplicate local one-worker run was stopped after its old geometry timeout and after logging all21strength/count summaries. It is not reported as a green run. The corrected `pnpm.cmd vitest run games/skribbl/__tests__/ink-geometry.test.ts --maxWorkers=1 --pool=threads` passes all3checks, exit0,1.12s. No geometric assertion was removed.
- Final local typecheck passes, exit0. Scoped Prettier follows evidence output, `git diff --check` passes, and66media files are hashed (2,076,820bytes). Both live browser scripts completed before a new one was launched; the successful capture closes its only browser in finally.

R23 timeout choice:

- `pnpm.cmd vitest run games/skribbl/__tests__/choice-timeout.test.ts games/skribbl/__tests__/game.test.ts --maxWorkers=1 --pool=threads`:35checks pass, exit0,1.23s. `pnpm.cmd typecheck`:pass, exit0.
- `pnpm.cmd vitest run games/skribbl/__tests__/choice-timeout.test.ts --maxWorkers=1 --pool=threads --disableConsoleIntercept`:11checks pass, exit0,771ms; printed1,000seed measurements show human medium/hard automatic choices340/338→0/0 and bots331/345→0/0. Timeout uses the same hint shuffle/RNG as explicitly selecting that easy word; no extra randomness or deadline changes.
- Existing fixtures/captures use explicit selections or an easy deck, so rendered evidence is unchanged. The mutation campaign is refreshed against the updated phase source with a single thread worker per invocation; it runs sequentially and restores every source in finally.
- `node jobs/P04-draw-and-guess/tools/mutate.mjs`:20/20fresh mutants caught by assertions, exit0; all current sources restored in finally and restored baseline green. Logs and source hashes now use the renamed game and R23phase source. Each child command is scoped to this game's game.test.ts with one thread worker.
- CI38198077870 passes47s for ab84117, with install/typecheck/format and the complete scoped suite (287checks,28files including the11new timeout cases). All7,000seeded simulations and SDK/property checks pass. R24 is a read-only gameplay review; no game source changed after this green result.
