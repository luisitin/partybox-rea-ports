# P03 — Verification record

This is the verification record for `job/P03-trivia-lightning`, runner `r3-local`, on
2026-10-11. Recorded results below are either inspected files or the primary runner's reported
command results. The final local game run passed all 110 tests across seven files. Typecheck,
format and all 20 mutations passed; the final 60-page capture and recorded visual review passed.
All 123 media hashes match the refreshed manifest. Format will be rerun after these edits; CI and
KEEP GOING remain pending. This document does not yet claim that every RULES.md check passes.

## Commands and current results

Commands use `pnpm.cmd` on this Windows desktop because PowerShell blocks `pnpm.ps1`.
CI uses the equivalent `pnpm` commands. The test filter is always this game; no whole-suite
browser run is part of this verification.

| Check                          | Exact reproduction command                                                                                                                                      | Current recorded result                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install once                   | `corepack enable` then `pnpm.cmd install`                                                                                                                       | Completed, recorded in NEXT.md. No new dependencies.                                                                                                                    |
| Types                          | `pnpm.cmd typecheck`                                                                                                                                            | PASS: exit 0, primary runner session 95850.                                                                                                                             |
| Format                         | `pnpm.cmd format`                                                                                                                                               | PASS: exit 0, primary runner session 32688. Rerun after final documentation edits pending.                                                                              |
| Game, screens and SDK contract | `pnpm.cmd vitest run games/trivia-lightning --maxWorkers=1 --pool=threads`                                                                                      | PASS: 7 files, 110 tests, 119.74 s, exit 0; began 2026-10-11T21:19:46Z.                                                                                                 |
| Simulation and properties      | `pnpm.cmd vitest run games/trivia-lightning/__tests__/simulation.test.ts games/trivia-lightning/__tests__/property.test.ts --maxWorkers=1 --pool=threads`       | All 42 tests included in the successful complete 110-test run. Stable `media/simulation.json` confirms all 21 groups and 21,000 games.                                  |
| Mutation check                 | `node jobs/P03-trivia-lightning/mutate.mjs`                                                                                                                     | PASS: final 20 tested, 20 caught, exit 0, session 58641. Originals restored in `finally` after every fault.                                                             |
| Static SSR evidence            | Set `PB_WRITE_EVIDENCE=1`, then `pnpm.cmd vitest run games/trivia-lightning/__tests__/evidence.test.tsx --maxWorkers=1 --pool=threads`, then clear the variable | PASS: SSR test in complete 110-test run; 60 HTML files, 12 states x 5 surfaces, with matching final PNG capture.                                                        |
| Chrome capture and geometry    | `node jobs/P03-trivia-lightning/capture.mjs`                                                                                                                    | PASS: 2026-10-11T21:28:52.140Z, 60 pages, all issue counts zero. Hand review passed; cleanup recovery verified closed/profile removed/endpoint closed at 21:35:03.559Z. |
| Media budget                   | `Get-ChildItem -LiteralPath jobs/P03-trivia-lightning/media -File \| Measure-Object Length -Sum`                                                                | PASS: 6,021,995 bytes across 123 media files, below 10 MB.                                                                                                              |
| Media integrity                | `Get-ChildItem -LiteralPath jobs/P03-trivia-lightning/media -File \| Sort-Object Name \| Get-FileHash -Algorithm SHA256`                                        | PASS: refreshed SHA256SUMS.txt has 123 records for all 123 media files; independently recomputed all hashes, zero mismatches.                                           |
| Job CI                         | `gh pr checks --watch`                                                                                                                                          | Pending PR and workflow run. Record URL, commit, check name and conclusion before leaving draft.                                                                        |

The complete local test run began at `2026-10-11T21:19:46Z` and passed in 119.74 s, exit code 0
(primary runner session 80776). Its 110 tests include the SDK contract, rule and screen tests,
content validation, SSR generation, all simulation groups and all property sequences, including
the hidden-key bot assertion. Replace the remaining pending cells with actual results before
marking the job complete.

## Contract, rule and regression coverage

The local contract wrapper discovers the game list, sets `PB_CONTRACT_SHARD` to only
`trivia-lightning`, and imports the real SDK contract suite. Settings variants include a short
power-free race, the maximum-length Movies race, and Science. Hidden-field hooks forbid the
deck, answer keys and other private runner state in public views.

The inspected game tests exercise:

- 100-point base scoring, +20 streak steps capped at +60, miss reset, speed independence,
  doubling only the next correct answer, and energy capped at one.
- One cursor per seat, own feedback only, duplicates and stale question/answer/Next inputs,
  spectators and unknown IDs, and private-key isolation.
- Exactly three-second freeze; self, unknown, finished, offline and already-frozen targets
  refused without consuming energy; no score theft or stacked freeze.
- Reconnect restoring cursor/verdict/score/power, pause shifting the shared cap and private
  freeze clock, terminal roster preservation, idle cap and all-disconnected exit.
- Finishing one seat without ending another connected seat, exact-cap input rejection, stale
  timer rejection, an old timer never moving the race clock backward, and completion after an
  accepted input overtakes a queued beat.
- Three podium beats, competition ranks and shared first, permanent-leaver bot targeting,
  60 bounded original questions, and independently authored bot factual knowledge.

Screen tests use the actual React components, including spectators, TV privacy, phone-only
wording, own feedback, final-answer feedback during podium, delayed winner identity, ties,
all-player final standings and a powers-disabled game. The spec now correctly says that own
rank/score during podium appear only at step 3, the winner reveal.

Content tests cover the 100-character prompt, 40-character option and 150-character explanation
limits; over-limit and blank strings; distinct trimmed/case-folded choices; unique IDs;
exactly 20 questions; correct-index bounds; and rejection of unknown fields.

Property verification exposed a scheduler regression: an accepted input could advance the clock
past a queued beat, then the stale-timer guard would repeatedly refuse that expired deadline.
Accepted inputs and resume now rearm the race beat when necessary. The direct unit regression
drives this state to `done` with SDK `finishGame`; it and all property sequences passed in the
complete 110-test run.

## Seeded simulation

`simulation.test.ts` runs seeds 1–1,000 for each player count 2, 3, 4, 5, 6, 7, 8 and each
easy/normal/sharp strength: **21,000 games and 105,000 player seats**. All groups use the default
12 questions, 90-second cap and powers enabled. The virtual clock is injected; the reducer's
500 ms beat and podium deadlines drive timers. Each bot schedules its own seeded decision:
easy 1,000–2,200 ms, normal 900–1,800 ms, sharp 650–1,300 ms. A null response is rescheduled,
so a frozen bot can recover. There is no real sleep or browser in the simulator.

Every game must reach `done`, include its complete original roster, have finite nonnegative
scores, finish its race within its configured cap and complete its match within
`estimatedMinutes × 2 = 360,000 ms`. Each group also requires over 95% of seats to complete
the finite deck, use of doubling, and use of freeze by sharp bots.

The inspected JSON records all **21,000 games completed**, all **105,000 seats finished**,
a longest race of **47,313 ms** and longest complete match of **60,813 ms**, both within budget.
Every sharp group exercised freezes; every group exercised doubles. These are bot-scheduler
measurements, not a measured human party duration.

| Players | Easy median race ms | Normal median race ms | Sharp median race ms |
| ------- | ------------------: | --------------------: | -------------------: |
| 2       |            40,458.5 |              35,174.5 |             26,706.5 |
| 3       |              41,047 |              35,663.5 |             28,226.5 |
| 4       |            41,578.5 |              35,946.5 |             28,893.5 |
| 5       |            41,697.5 |              36,133.5 |               29,155 |
| 6       |            41,873.5 |              36,241.5 |               29,444 |
| 7       |            42,075.5 |              36,414.5 |               29,654 |
| 8       |            42,207.5 |                36,522 |               29,934 |

Complete per-group match medians, maxima, answer accuracy and power counts are retained in
[media/simulation.json](media/simulation.json).

## Property sequences

`property.test.ts` checks fixed seeds **1, 2, 3** plus **1,000** seeds sampled reproducibly with
fast-check generator seed `0x503`. Each sequence contains 64 mixed events: **64,192 transitions**
across random supported roster sizes, packs, question counts, caps and power settings.
Inputs include stale IDs/cursors, invalid player IDs, powers, current and stale timers,
disconnect/reconnect, pause/resume and irrelevant speech events.

Every transition deep-freezes and serializes the previous state, replays the same event against
a second state and checks byte-equal deterministic output. Invariants require a declared phase,
bounded JSON round-trip, finite nonnegative counters, correct ≤ answered ≤ deck length,
streak ≤ correct, energy ≤ one and scores in the declared 100–320 points-per-correct bounds.
Views are checked for forbidden keys, spectator privacy and own-feedback identity. Every
sequence is resumed, driven to results, then fuzzed in the terminal state for totality.

A separate hidden-key perturbation changes every `correctIndex` and explanation while leaving
prompts/options fixed. TV and all phone views remain equal, and nine bot-input comparisons
(three strengths × RNG seeds 1, 2, 3) remain equal. This verifies that bot factual recall does
not read the private answer key. It is an invariance check, not a claim of human-like knowledge.

Idle tests additionally cover **56 combinations**: counts 2–8 × questions 6/20 × caps 60/180 ×
powers off/on. They require complete zero-score results within the manifest budget.

## Twenty planted faults

Each mutation runs only `game.test.ts` in a fresh single-worker subprocess. A syntax/import
failure does not count as catching a rule bug. The JSON records assertion failures for all 20:

| #   | Planted fault                 | Result |
| --- | ----------------------------- | ------ |
| 1   | Base score +10                | Caught |
| 2   | Uncapped streak               | Caught |
| 3   | Wrong answers score           | Caught |
| 4   | Triple instead of double      | Caught |
| 5   | Invert correct verdict        | Caught |
| 6   | Miss keeps streak             | Caught |
| 7   | Energy every two correct      | Caught |
| 8   | Double costs no energy        | Caught |
| 9   | Accept answer before Next     | Caught |
| 10  | Accept stale question ID      | Caught |
| 11  | Accept stale answer cursor    | Caught |
| 12  | Accept stale Next cursor      | Caught |
| 13  | Answer at exact cap accepted  | Caught |
| 14  | Shorten freeze to two seconds | Caught |
| 15  | Answer while frozen           | Caught |
| 16  | Allow self freeze             | Caught |
| 17  | Stack active freezes          | Caught |
| 18  | End when only one finishes    | Caught |
| 19  | Skip winner podium beat       | Caught |
| 20  | Leak answer key on phones     | Caught |

The final rerun against the scheduler change is 20/20, exceeding the required 19/20, exit code 0
(primary runner session 58641). Exact files and exit codes are in
[media/mutations.json](media/mutations.json). It verifies these faults, not every possible fault.

## Screens, geometry and hand review

`evidence.test.tsx` generates real SSR with actual CSS module mappings, design tokens and
representative shell header/footer space. Fixtures cover `race`, `podium`, `podium-2`,
`podium-3`, `done`, `feedback`, `finished`, `tie`, `tie-podium`, `long`, `stress` and
`stress-feedback`. Each has a TV at 1920×1080 plus 390×844 phones for player/spectator, both
with TV and phone-only: **60 HTML and 60 PNG** in the current inspected capture. Race, podium
and done JSON states are also retained in the game fixtures folder.

The stress question uses the schema's 100/40/150 text limits. The tie podium includes eight
full-length player names. Captures use one installed Chrome process and one page, with closure
and private temporary-profile cleanup in `finally`; no browser dependency was installed.

The final report at `2026-10-11T21:28:52.140Z` has zero capture errors, control issues,
offscreen elements, horizontal/vertical document overflow, textClipped entries and scroll
containers across all 60 pages. The primary runner replaced finish-flag Unicode glyphs with
original inline SVG after their metrics produced clipping findings. The earlier 45-page capture
also exposed eight-lane TV label overlap and prompted a layout refit.

The initial capture cleanup verification timed out. Recovery verified cleanup at
`2026-10-11T21:35:03.559Z`; `layout.json` retains the previous error and the actual recovery
result: `browser.verifiedClosed: true`, zero observed capture processes,
`profileRemoved: true`, and `endpoint.reachable: false`. The runner confirmed no active or
retained capture Chrome processes. Capture closure is verified rather than inferred from PNGs.

The primary runner hand-inspected the following final PNGs and reported all readable and fitting:

- TV race, complete final standings, podium steps 1/2/3, and the eight-way podium tie.
- Phone frozen race, own private feedback, maximum 100/40/150-character question/options/
  explanation, finished and done screens, podium steps 1/2, spectator podium, and ties.

The 60-page geometry audit covers both phone modes and spectators: no control-size issues,
offscreen elements, scrolling, overflow or unresolved clipping. SSR assertions enforce no
spectator controls and no phone-only TV directions. Reduced-motion and text/symbol state cues
are covered by inspected styling and markup. Keyboard interaction, live audio playback and a
human party session were not tested; static review does not claim those observations.

Final capture inventory: **60 HTML, 60 PNG, three JSON files; 6,021,995 bytes**, below 10 MB.
All 123 media hashes were refreshed and independently recomputed against SHA256SUMS.txt; zero mismatches.

## CI and KEEP GOING

`.github/workflows/P03.yml` is inspected: pull-request paths cover this game, job folder and
workflow; Ubuntu latest; 30-minute timeout; `contents: read`; only `actions/*` actions;
Node 24, Corepack, frozen-lockfile install, typecheck, format and this game's single-worker tests.
Actual GitHub run URL and green conclusion remain pending.

The independent eight-stranger review identified live rival context on active phones, track
position versus scoring clarity, blind roster-order freeze selection, empty-rank podium dead
air and power-request acknowledgement. Root owns fixes, measurement and LOOP.md. Required
three consecutive rounds with no player-visible gain remain pending, then queue work resumes.

## Research and practical limits

Sources and independent corroboration are in RESEARCH.md/SOURCES.md. A full live original
multiplayer session was not played: Blooket direct HTTP returned 403 and this runner's
connected computer-use surface had no available browser. Official documentation, firsthand
published recordings and transient Quizizz/Wayground public-client inspection provided the
fallback. Exact current Gold Quest reward odds, audio and timing constants are unverified.

Original question text, art and sound assets were not copied. Port scoring, energy and rival
freeze rules are explicit PartyBox adaptations. P01 had not merged, so the local compatible
pack schema is documented. Bot simulation, SSR and code review do not replace a live eight-person
PartyBox play session; no such human play session is claimed in this record.
