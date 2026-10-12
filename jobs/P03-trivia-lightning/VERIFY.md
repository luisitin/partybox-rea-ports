# P03 — Verification record

Runner `r3-local`, branch `job/P03-trivia-lightning`, PR [#3](https://github.com/luisitin/partybox-rea-ports/pull/3).
This record describes the resumed implementation, renamed to **Quizizz** (`games/quizizz`,
manifest/shared ID `quizizz`) under the owner's official-name amendment, on 2026-10-12 UTC.
The branch and job-evidence slug remain unchanged for claim/PR continuity. Command results
attributed to the primary runner are reported results; JSON coverage was independently inspected.
Historical commands retain the paths actually used; old naming is not relabeled as a new run.

The renamed-game rerun passed **153 tests in seven files** in **243.93 s**, and typecheck passed.
It regenerated **82 SSR pages**, phase fixtures, public interaction views and the simulation.
The **21,000 seeded games / 105,000 seats** finished. Prior **20/20 caught mutations** remain
rule evidence because the rename changes no rules. The renamed capture passed all **82 layouts**
and **61 mounted checks / 14 additional PNGs**. Browser closure is independently verified.
All **183 media hashes match**, at **9,839,146 bytes**. Renamed implementation CI is green,
and audits 9-11 complete the three consecutive stable KEEP GOING rounds.

## Commands and results

PowerShell blocks `pnpm.ps1`, so local commands use `pnpm.cmd`; CI uses `pnpm`.
All Vitest commands are restricted to this game. No whole-suite browser run was performed.

| Check                                                 | Exact command                                                                                                                                                                                       | Recorded result                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation                                          | `corepack enable`, then `pnpm.cmd install`                                                                                                                                                          | Completed once; recorded in NEXT.md. No new dependencies.                                                                                                                                                                                                                         |
| Renamed-game types                                    | `pnpm.cmd typecheck`                                                                                                                                                                                | PASS, exit 0, immediately before the renamed-game rerun in primary-runner session 25677.                                                                                                                                                                                          |
| Renamed game, SDK contract, simulation and properties | `pnpm.cmd vitest run games/quizizz --maxWorkers=1 --pool=threads` with `PB_WRITE_EVIDENCE=1`                                                                                                        | PASS, exit 0: 153 tests, seven files, 243.93 s; began `2026-10-12T02:14:01Z`, primary-runner session 25677.                                                                                                                                                                       |
| Prior focused rules, screens and SSR                  | `pnpm.cmd vitest run games/trivia-lightning/__tests__/game.test.ts games/trivia-lightning/client/screens.test.tsx games/trivia-lightning/__tests__/evidence.test.tsx --maxWorkers=1 --pool=threads` | Historical pre-rename PASS: 75 tests in 1.66 s. The complete renamed-game run above supersedes this validation.                                                                                                                                                                   |
| Mutation check                                        | `node jobs/P03-trivia-lightning/mutate.mjs`                                                                                                                                                         | Prior pre-rename PASS, exit 0: 20/20 caught by rule assertions, session 27138. That invocation targeted `games/trivia-lightning/__tests__/game.test.ts`; the harness now targets `games/quizizz`, and the rule implementation is unchanged. Originals were restored in `finally`. |
| Renamed SSR evidence generation                       | `$env:PB_WRITE_EVIDENCE='1'; try { pnpm.cmd vitest run games/quizizz --maxWorkers=1 --pool=threads } finally { Remove-Item Env:PB_WRITE_EVIDENCE }`                                                 | PASS as part of session 25677: regenerated 82 HTML pages, reducer-derived public interaction views, phase JSON fixtures and simulation evidence.                                                                                                                                  |
| Renamed static and mounted capture                    | `$env:P03_CPU_CAPTURE='1'; try { node jobs/P03-trivia-lightning/capture.mjs } finally { Remove-Item Env:P03_CPU_CAPTURE }`                                                                          | PASS, exit 0, session 21046: 82 pages / zero fit findings at `2026-10-12T02:20:28.239Z`; 61/61 mounted checks / 14 captures at `2026-10-12T02:20:51.455Z`. Native browser and exact endpoint closure verified; profile retained with EBUSY.                                       |
| Final formatting                                      | `pnpm.cmd format`                                                                                                                                                                                   | PASS, exit 0, after renamed capture/evidence and scoped formatting writes.                                                                                                                                                                                                        |
| Final media budget                                    | `Get-ChildItem -LiteralPath jobs/P03-trivia-lightning/media -File \| Measure-Object Length -Sum`                                                                                                    | PASS: 183 files / 9,839,146 bytes, below 10,000,000 bytes; lossless PNG optimization verified identical pixels.                                                                                                                                                                   |
| Final media integrity                                 | `Get-ChildItem -LiteralPath jobs/P03-trivia-lightning/media -File \| Sort-Object Name \| Get-FileHash -Algorithm SHA256`                                                                            | PASS: regenerated all 183 SHA256SUMS.txt records and independently recomputed each hash; zero mismatches.                                                                                                                                                                         |
| PR CI                                                 | `gh pr checks 3`                                                                                                                                                                                    | PASS: renamed implementation `67ec95a`, run 38195659698; stable audit 10 `3f66a89`, run 38195782172. Latest documentation head is checked before leaving draft.                                                                                                                   |

## SDK contract, rules and regressions

The local wrapper selects only `quizizz` with `PB_CONTRACT_SHARD` and imports the real
SDK contract suite. Settings variants cover a short power-free race, a maximum-length Movies
race and Science. Contract hooks forbid private answer keys, deck and runner internals in views.

The complete run covers:

- Pure, deterministic transitions; private questions and own feedback; spectator/unknown IDs;
  duplicate or stale question, answer, Next and earning-charge inputs.
- 100-point base scoring, +20 streak steps capped at +60, miss reset, speed-independent points,
  next-correct-only doubling, energy capped at one and replay protection after a refill.
- Exactly three-second rival freeze; self, unknown, finished, departed, offline and already-frozen
  targets refused without spending energy; no score theft or stacked active freeze.
- Reconnect restoring cursor, verdict, score and power; pause shifting the shared cap and private
  freeze deadlines; terminal roster preservation; idle cap and all-disconnected completion.
- One finished seat leaving other connected racers active; exact-cap rejection; stale timers;
  clocks never moving backward; accepted input overtaking a queued beat still reaching results.
- Occupied competition-rank podium beats, shared first and delayed winner identity. Two distinct
  players use steps [2,3] / 9 s; eight tied winners [3] / 4.5 s; tied winners plus third [1,3] / 9 s;
  three distinct scores [1,2,3] / 13.5 s. Only empty ranks lose their wait.
- Scored/place-labeled rival choices, eligible-leader fallback, manual choice retention and
  original avatar colour slots surviving a standings reorder.
- Permanent leavers returning to a public watching stage without controls; named freeze
  attribution; stable accepted-answer cue identity across podium/results pushes; terminal own
  explanation retention; semantic screen keys advancing with questions/verdicts/podium beats
  while remaining stable across clock ticks.

Actual React screen assertions cover TV privacy, both phone modes, spectators, own feedback,
power-free play, score-derived lead/tied-lead cues, all-player results and terminal explanations.
Phone rank and score during podium appear at step 3, with the winner reveal.

The content suite validates 60 original questions in three 20-question packs: bounded prompt /
option / explanation text (100 / 40 / 150 characters), nonblank strings, unique IDs, distinct
trimmed/case-folded choices, exactly 20 questions per pack, correct-index bounds and unknown-field
rejection. Bot factual knowledge is independently authored; hidden-key perturbation tests below
check that strategy cannot read the answer key.

## Seeded simulation

`simulation.test.ts` runs seeds 1–1,000 at **every count 2–8**, for easy/normal/sharp strengths:
21 groups, **21,000 games and 105,000 seats**. Defaults are 12 questions, a 90-second race cap
and powers enabled. Virtual time uses the reducer's 500 ms beat and podium deadlines; each
bot schedules its own seeded decision. Delays are easy 1,000–2,200 ms, normal 900–1,800 ms,
sharp 650–1,300 ms. A null response is rescheduled so frozen bots recover. No real sleep or
browser is used by this simulator.

Every game must reach `done`, preserve its original roster, have finite nonnegative scores,
respect its race cap and complete within `estimatedMinutes × 2 = 360,000 ms`. Each group must
finish over 95% of seats, use doubling and, for sharp bots, use freezes. The final JSON records
**all 21,000 games and all 105,000 seats finished**, longest race **47,313 ms** and longest match
**60,813 ms**. Every group used doubles and every sharp group used freezes.

Required 2/4/8-player medians, in milliseconds:

| Players | Strength | Median race | Median complete match |
| ------- | -------- | ----------: | --------------------: |
| 2       | Easy     |    40,458.5 |                49,433 |
| 2       | Normal   |    35,174.5 |                44,137 |
| 2       | Sharp    |    26,706.5 |              35,428.5 |
| 4       | Easy     |    41,578.5 |                54,957 |
| 4       | Normal   |    35,946.5 |              49,308.5 |
| 4       | Sharp    |    28,893.5 |                38,612 |
| 8       | Easy     |    42,207.5 |              55,493.5 |
| 8       | Normal   |      36,522 |              49,653.5 |
| 8       | Sharp    |      29,934 |              35,417.5 |

All counts, maxima, accuracy and power-use totals are retained in
[media/simulation.json](media/simulation.json). These are seeded bot-scheduler measurements,
not measured human party durations or evidence that a power improves human win odds.

## Property sequences

`property.test.ts` checks fixed seeds **1, 2, 3** plus **1,000 reproducibly sampled seeds** from
fast-check generator seed `0x503`. Each has 64 mixed events: **64,192 transitions**, across
supported roster sizes, packs, question counts, caps and power settings. Inputs include stale
IDs/cursors, invalid player IDs/charges, powers, current/stale timers, disconnect/reconnect,
pause/resume and irrelevant speech events.

Each transition deep-freezes and serializes the previous state, replays the event on a second
state and requires byte-equal output. Invariants cover declared phases, bounded JSON round-trip,
finite nonnegative counters, correct ≤ answered ≤ deck length, streak ≤ correct, energy ≤ one
and 100–320 points per correct answer. Views forbid private keys, enforce spectator privacy and
match only the receiving player's feedback. Every sequence resumes, reaches results and fuzzes
the terminal reducer for totality.

A separate perturbation changes all private correct indices/explanations while keeping prompts
and options fixed: TV and phone views remain equal, as do nine bot-input comparisons (three
strengths × RNG seeds 1/2/3). This is an invariance check, not a claim of human-like knowledge.
Idle completion also covers **56 setting extremes**: counts 2–8 × questions 6/20 × caps 60/180 ×
powers off/on, requiring a complete zero-score roster within the manifest budget.

## Twenty planted faults

Each mutation runs only `game.test.ts` in a fresh single-worker subprocess. Syntax/import
failures do not count. [media/mutations.json](media/mutations.json) records a rule assertion
failure and exit code 1 for each of these **20/20 caught faults**, exceeding the required 19/20:

1. Base score +10.
2. Uncapped streak.
3. Wrong answers score.
4. Triple instead of double.
5. Invert correct verdict.
6. Miss keeps streak.
7. Energy every two correct.
8. Double costs no energy.
9. Accept answer before Next.
10. Accept stale question ID.
11. Accept stale answer cursor.
12. Accept stale Next cursor.
13. Accept answer at the exact cap.
14. Shorten freeze to two seconds.
15. Answer while frozen.
16. Allow self freeze.
17. Stack active freezes.
18. End when only one seat finishes.
19. Skip the winner podium beat.
20. Leak the answer key on phones.

The pre-rename final mutation rerun passed and restored unmutated sources. The current harness
uses `games/quizizz`; naming changes did not alter the tested rule implementation. This record
retains that prior rule evidence and does not claim a fresh post-rename mutation invocation.
It verifies these planted faults, not every possible fault.

## Screens, mounted interactions and cleanup

SSR uses actual components, mapped CSS modules, design tokens and representative shell
header/footer space. Sixteen regular fixtures cover race, podium steps 1/2/3, done, feedback,
finished, ties, tie podium, longest authored question, maximum-text question/feedback, adversarial
ranking, departed return, freeze and terminal feedback. Each has TV 1920×1080 plus player /
spectator phones 390×844 in TV-room and phone-only modes: 80 pages. Two extra active-phone pages
exercise an unbroken 64-character freeze-source name. The renamed run regenerated all **82 HTML
pages**, with official Quizizz strings and `games/quizizz` CSS paths. Race/podium/done phase JSON
fixtures and reducer-derived interaction public views were also regenerated.

The renamed [media/layout.json](media/layout.json), captured at `2026-10-12T02:20:28.239Z`,
records **82 pages with zero findings** for capture errors, undersized controls, offscreen elements,
horizontal/vertical overflow, clipped text or scroll containers. Fifteen podium placeholders are
intentional reveal markup. The same Chrome/page then mounted real React controls:
[media/interaction.json](media/interaction.json), at `2026-10-12T02:20:51.455Z`, records
**61/61 passing checks and 14 passing capture layouts**, including:

- Eligible scored targets, explicit choice surviving reorder, disconnect fallback and invalidated
  choices remaining cleared after a rival returns.
- Exact answer/Next/power inputs; zero extra requests on repeat taps; disabled pending controls;
  authoritative acceptance; four-second unconfirmed retries; unrelated standings pushes unable
  to acknowledge a request; energy-charge identity retained across replacement-target retries.
- Energy spending feedback avoiding attribution to the last requested power when another action
  won the same charge; accepted double/freeze facts derived from public state.
- Retained own feedback while Next is pending, accepted next question and score, departed watching
  mode, maximum-length freeze attribution, terminal explanation retention and answer-identity
  deduplication across race/podium/done plus direct podium mounting.

The primary runner's hand review covers race, full named final standings, staged medals,
eight-way ties, frozen/departed phones, maximum question/feedback text, terminal explanations,
pending/retry states and both spectator modes. The new official-name TV race and maximum terminal
phone captures were inspected again and fit. Geometry supports fit; it does not measure human
understanding. Mounted cue checks observe semantic sound/haptic calls, not speaker acoustics or
physical-device vibration.

The pre-rename GPU-enabled attempt hung and was recovered through exact private-profile cleanup;
it is not counted as a pass. The final renamed run uses `P03_CPU_CAPTURE=1` and one Chrome/page,
closed in `finally`. Its cleanup proves all seven observed CDP members, earlier utility records
and the launcher exited through native PID/creation/exit checks, with `verifiedClosed: true` and
the exact endpoint checked/closed. Five owned processes needed forced closure. Windows retains
exited process records and a locked profile: `profileRemoved: false`, EBUSY. No active owned
Chrome remains; profile deletion is not claimed.

The final inventory contains **82 HTML / 96 PNG / five JSON**, **183 files / 9,839,146 bytes**.
Lossless PNG optimization used the existing Pillow installation and verified identical pixels;
no dependency was installed. Duplicate interaction-capture.json was removed. All 183 final
SHA256SUMS.txt records were regenerated and independently recomputed: zero mismatches.

## CI, naming and KEEP GOING completion gates

The official-name amendment in fresh JOBS.md/RULES.md requires manifest `name: Quizizz`,
`id: quizizz`, `games/quizizz` and updated strings/paths. The inspected PartyBox monorepo inventory
contains 111 games at `475a8f7` (origin/main `1c813f9`); no Quizizz or self-paced quiz race overlaps.
Lightning Round has synchronized TV question/reveal/wager phases rather than per-player cursors.
[ASSUMPTIONS.md](ASSUMPTIONS.md) records the inventory and continued separate-port decision.

`.github/workflows/P03.yml` uses the renamed game filter/test command and retains the required
job/workflow filters, Ubuntu latest, 30-minute timeout, read-only contents permission, only
`actions/*`, Node 24, Corepack, frozen-lockfile install, typecheck, format and game-only tests.
Prior implementation head `b67e5ec` passed [run 38193988918](https://github.com/luisitin/partybox-rea-ports/actions/runs/38193988918).
Stable-audit-9 head `43c69d1` passed [run 38194604291](https://github.com/luisitin/partybox-rea-ports/actions/runs/38194604291).
Renamed implementation `67ec95a` passed [run 38195659698](https://github.com/luisitin/partybox-rea-ports/actions/runs/38195659698).
Stable audit 10 `3f66a89` passed [run 38195782172](https://github.com/luisitin/partybox-rea-ports/actions/runs/38195782172).
The primary runner checks the latest documentation head with `gh pr checks 3` before making
PR #3 ready and marking the main claim DONE; prior results are not relabeled as that head's check.

[LOOP.md](LOOP.md) records eight player-visible improvement passes: phone standings, readable
named lanes, occupied podium beats, informed rival choice, score-derived lead cues, request
acknowledgement, return/verdict identity and readable completion/stable identity. Measured gains
are regression behavior, removed waits, fit or explicit information; no human comprehension or
network latency gain is asserted. Stable audits 9-11 each found zero new player-visible gain.
Root and independent read-only reviews covered score/choices, phone/spectator stages and recovery;
all three actual records are in LOOP.md. Local checks, final capture/cleanup, media budget/hashes
and renamed implementation CI passed. The final documentation head receives the same CI before
PR readiness and claim completion.

## Research and practical limits

[RESEARCH.md](RESEARCH.md), [SOURCES.md](SOURCES.md) and [ASSUMPTIONS.md](ASSUMPTIONS.md) document
vendor documentation paired with independent firsthand published reports, and transient public
Wayground/Quizizz client inspection. Direct Blooket HTTP returned 403; the connected computer-use
surface had no available browser. No complete live original multiplayer game was played, no
stranger's room was joined, and exact current reward odds, music and timing constants remain
unverified. Those source limits are retained rather than treated as passed live research.

Question wording, art and styling are original. No vendor code/assets, external fonts, tracking
or runtime network dependencies were copied. Scoring, energy, rival freeze and finite shared-seed
race rules are explicit PartyBox adaptations. P01's absent schema was handled with the documented
compatible local pack boundary. The public snapshot exposes SDK primitives rather than a full
LAN host: SSR, mounted controls and bot/property tests do not constitute a networked human game
or an eight-stranger living-room playtest. No such session or audio-acoustics test is claimed.
