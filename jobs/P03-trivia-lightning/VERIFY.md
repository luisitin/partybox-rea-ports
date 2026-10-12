# P03 — Verification record

Runner `r3-local`, branch `job/P03-trivia-lightning`, PR [#3](https://github.com/luisitin/partybox-rea-ports/pull/3).
This record describes the final resumed implementation and evidence inspected on 2026-10-12 UTC.
Command results attributed to the primary runner are reported results; JSON counts and coverage
below were independently inspected. Earlier 110/119-test and 60/65-page baselines are superseded.

The final local game run passed **153 tests in seven files**, typecheck and format passed,
all **20 planted faults were caught**, and all **21,000 seeded games / 105,000 seats finished**.
The final combined capture has **82 static pages with zero geometry issues** and **61 passing
mounted interaction checks / 14 additional PNGs**. All **183 media hashes match**. CI on the
evidence push and three consecutive stable KEEP GOING audits remain completion gates below;
this record does not claim those unfinished gates have passed.

## Commands and results

PowerShell blocks `pnpm.ps1`, so local commands use `pnpm.cmd`; CI uses `pnpm`.
All Vitest commands are restricted to this game. No whole-suite browser run was performed.

| Check                               | Exact command                                                                                                                                                                                       | Recorded result                                                                                                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation                        | `corepack enable`, then `pnpm.cmd install`                                                                                                                                                          | Completed once; recorded in NEXT.md. No new dependencies.                                                                                                                                                                                   |
| Types                               | `pnpm.cmd typecheck`                                                                                                                                                                                | PASS, exit 0, final primary-runner check.                                                                                                                                                                                                   |
| Complete game and SDK contract      | `pnpm.cmd vitest run games/trivia-lightning --maxWorkers=1 --pool=threads`                                                                                                                          | PASS, exit 0: 153 tests, seven files, 59.94 s; primary-runner result recorded at `2026-10-12T01:44:53Z`.                                                                                                                                    |
| Focused rules, screens and SSR      | `pnpm.cmd vitest run games/trivia-lightning/__tests__/game.test.ts games/trivia-lightning/client/screens.test.tsx games/trivia-lightning/__tests__/evidence.test.tsx --maxWorkers=1 --pool=threads` | PASS: 75 tests in 1.66 s, before the final complete run.                                                                                                                                                                                    |
| Simulation and properties           | `pnpm.cmd vitest run games/trivia-lightning/__tests__/simulation.test.ts games/trivia-lightning/__tests__/property.test.ts --maxWorkers=1 --pool=threads`                                           | Included in the final successful complete run; simulation JSON contains all 21 completed groups.                                                                                                                                            |
| Mutation check                      | `node jobs/P03-trivia-lightning/mutate.mjs`                                                                                                                                                         | PASS, exit 0: final rerun caught 20/20 by rule assertions, primary-runner session 27138. Originals restored in `finally` after each fault.                                                                                                  |
| SSR evidence generation             | `$env:PB_WRITE_EVIDENCE='1'; try { pnpm.cmd vitest run games/trivia-lightning/__tests__/evidence.test.tsx --maxWorkers=1 --pool=threads } finally { Remove-Item Env:PB_WRITE_EVIDENCE }`            | PASS; final evidence contains 82 HTML pages, reducer-derived public interaction views and phase fixtures. SSR also passed in the complete run.                                                                                              |
| Combined static and mounted capture | `$env:P03_CPU_CAPTURE='1'; try { node jobs/P03-trivia-lightning/capture.mjs } finally { Remove-Item Env:P03_CPU_CAPTURE }`                                                                          | PASS: layout captured at `2026-10-12T01:43:18.280Z`; 82 static pages, zero fit findings. Mounted report at `2026-10-12T01:43:38.403Z`: 61/61 checks and 14 captures. Browser closure independently proven; profile deletion returned EBUSY. |
| Formatting                          | `pnpm.cmd format`                                                                                                                                                                                   | PASS, exit 0, final whole-repository check, primary-runner session 56509. The three regenerated fixtures that failed latest CI were corrected locally.                                                                                      |
| Media budget                        | `Get-ChildItem -LiteralPath jobs/P03-trivia-lightning/media -File \| Measure-Object Length -Sum`                                                                                                    | Inspected after lossless PNG optimization: 183 files / 9,919,608 bytes, below 10,000,000 bytes.                                                                                                                                             |
| Media integrity                     | `Get-ChildItem -LiteralPath jobs/P03-trivia-lightning/media -File \| Sort-Object Name \| Get-FileHash -Algorithm SHA256`                                                                            | PASS: primary runner regenerated all 183 SHA256SUMS.txt records and independently recomputed all hashes; zero mismatches.                                                                                                                   |
| PR CI                               | `gh pr checks 3`                                                                                                                                                                                    | Green final-head run pending evidence push. Head `b94ee1e` failed only formatting of three regenerated fixtures; that failure is not a green result.                                                                                        |

## SDK contract, rules and regressions

The local wrapper selects only `trivia-lightning` with `PB_CONTRACT_SHARD` and imports the real
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

The final rerun passed against the final implementation and restored unmutated sources.
This verifies these planted faults, not every possible fault.

## Screens, mounted interactions and cleanup

SSR uses actual components, mapped CSS modules, design tokens and representative shell
header/footer space. Sixteen fixtures cover race, podium steps 1/2/3, done, feedback, finished,
ties, tie podium, longest authored question, maximum-text question/feedback, adversarial ranking,
departed return, freeze and terminal feedback. Each has TV 1920×1080 plus player/spectator phones
390×844 in TV-room and phone-only modes: 80 pages. Two extra active-phone pages exercise an
unbroken 64-character freeze-source name: **82 HTML and 82 matching static PNGs**. Phase JSON
fixtures retain race, podium and done states.

The final [media/layout.json](media/layout.json) records zero capture errors, undersized controls,
offscreen elements, horizontal/vertical document overflow, clipped text and scroll containers
across all 82 pages. The 15 reported podium placeholders are intentional staged reveal markup,
not clipping or fit findings. Maximum question/option/explanation text and eight distinguishable
long names are included. Earlier label overlap and 24 clipped names were fixed before this run.

The same Chrome process and page then mounted real React controls with reducer-derived public
views. [media/interaction.json](media/interaction.json) stores the full report once; layout.json
contains only its report path, passed status and counts. **All 61 checks and 14 capture layouts
pass**, including:

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

The primary runner's visual review covers race, full named final standings, staged medals,
eight-way ties, frozen and departed phones, maximum question/feedback text, terminal explanations,
pending/retry states and both spectator modes. Geometry supports fit; it does not measure how
quickly a human understands the screen. Mounted cue checks observe semantic sound/haptic calls,
not speaker audio quality or physical-device vibration.

The initial GPU-enabled final capture hung and was recovered by exact private-profile cleanup
before opening the fallback browser; it is not counted as a pass. The completed run sets
`P03_CPU_CAPTURE=1`, disables GPU rendering and limits renderer processes. Its `finally` cleanup
uses CDP membership plus native PID/creation/exit checks: all **eight observed Chrome members**
and the launcher are exited, `verifiedClosed: true`, and the exact debugging endpoint is checked
and closed. Four owned processes needed forced closure. No active owned Chrome remains.
Windows retained the exited process records and locked the temporary profile; `profileRemoved`
is **false**, with the recorded EBUSY warning. Profile deletion is not claimed.

PNG files were optimized losslessly using the existing Pillow installation; no new dependency
was installed. Duplicate interaction-capture.json was removed. Inspected inventory is **82 HTML,
96 PNG and five JSON files**, **183 files / 9,919,608 bytes**. The primary runner refreshed
SHA256SUMS.txt for every media file and independently recomputed all 183 hashes: zero mismatches.

## CI and KEEP GOING completion gates

Inspected `.github/workflows/P03.yml` has the required pull-request filters for the game/job/
workflow, Ubuntu latest, a 30-minute timeout, read-only contents permission, only `actions/*`,
Node 24, Corepack, frozen-lockfile installation, typecheck, format and game-only single-worker
tests. Earlier implementation heads passed CI, but the latest `b94ee1e` run failed format only
on three regenerated fixtures. The corrected fixtures passed local `pnpm.cmd format`. The final
evidence push must receive a green PR check before the PR leaves draft.

[LOOP.md](LOOP.md) records eight player-visible improvement passes: phone standings, readable
named lanes, occupied podium beats, informed rival choice, score-derived lead cues, request
acknowledgement, return/verdict identity and readable completion/stable identity. Their measured
gains are regression behavior, removed waits, fit or explicit information; no human comprehension
or network latency gain is asserted. Three consecutive audits with no player-visible gain are
still pending the primary runner's final KEEP GOING passes. Completion requires their actual
records plus green CI; no earlier baseline substitutes for them.

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
