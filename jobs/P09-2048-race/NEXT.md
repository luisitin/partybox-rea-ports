# P09 resume

## Latest r1-local checkpoint (2026-10-12 12:27 UTC)

Canonical `games/2048` is implemented; PR #12 remains draft. Typecheck PASS after
numeric ID and local pinned-host spectator opt-in repairs. Game-only command
`pnpm vitest run games/2048 --maxWorkers=1 --pool=threads --reporter=default --reporter=json --outputFile=C:/Users/luisi_xlnbc7h/AppData/Local/Temp/r1-local-2048-tests-20261012.json`
PASS: 91/91 tests, nine files, 20.74 s, exit 0. Includes the unmodified 20 SDK
contracts, 1,003 race seeds, rendered reading floors, feedback and numeric-ID checks.
Initial run failed three old `Best tile` copy expectations; updated to the new
`Best` label and reran the full game green. Two earlier type failures exposed that
the public kit lacks the pinned core spectator field; the phone module uses a local
intersection type, with the real host runtime opt-in retained.

Actual collapsed-strip TV Stage 854.8/inner788.8 px; phone60+27.6 px chrome.
Local Nunito/OFL and pinned global reset replace the historical fake harness.
First actual capture showed TV header overlap26.65px; compact best/score rows
remove it. Current15 captures pass frame bounds, no clipped items, header separation,
32px game body and44px targets; browser27260/113056 closed in finally, zero living
owned children. Four representative frames reviewed by hand; all15/adversarial
long-name/target/paused/receipt review remains required. Font ink overhang metrics
remain explicit and must be reviewed; they are not silently deleted.
Capture file navigation timed out once and closed browser114580; current CDP
setDocumentContent loads exact HTML and local font bytes.

Fresh simulation is PARTIAL: see completedGames/incomplete in simulation.json.
All recorded groups terminate within480000ms; median play180000ms. Counts/strengths
not present remain required. Owned process108044/59484 was stopped for the session
deadline after complete group records were saved. Historical21k/20mutation results
below remain baseline only. Fresh mutation rerun, full simulations, adversarial
captures/manual QA, final CI and three consecutive no-gain rounds are pending.
Shared manifest validator now allows leading digits under docs/DECISIONS.md;
owner core is unchanged and also needs that validator when importing this port.

## Earlier resume checkpoint (historical)

## Current canonical resume (2026-10-12, r1-local)

- Claim `206c2c0`; branch `job/P09-2048-race`, merged fresh main. Canonical game `games/2048`, id/name 2048. Former Merge Sprint name/path is historical; 117 core manifests were checked with no overlap.
- PR #12's former ready/CI 38180992082 result is baseline only; it is reopened draft pending new checks. No current type/test/capture/CI PASS is claimed.
- Root owns pinned-host capture; server owns visible-text reading floors; client owns canonical copy, spectator routing and accepted-move feedback. Old 15-image fake chrome and spectator SSR misrouting do not verify actual-host/read-only behavior.
- Research was reopened: original hosted page and independent pinned raw engine were confirmed. No live interaction/audio session was performed. Historical original-engine VM probes remain labelled evidence.

Remaining work:

1. Finish current server/client repairs and root's pinned-host TV/phone/spectator captures; verify readable numbers, all eight boards/results, touch targets, actual spectator controls absence and owned-browser closure.
2. Run `pnpm.cmd typecheck`, `pnpm.cmd format`, and only `pnpm.cmd vitest run games/2048 --maxWorkers=1 --pool=threads`. Refresh properties/SDK evidence and verify canonical discovery/fixtures.
3. Regenerate all-count/all-strength 21,000 simulations with current reveal reading timing and the twice-estimate completion limit. Run meaningful mutations/restoration checks against current source; do not reuse historical counts as PASS.
4. Refresh media/source hashes and decimal 10 MB total, push milestones, pull --rebase before every claim commit, refresh PR #12 (title P09 2048/body job README) and require new-head CI before marking ready.
5. Begin the current KEEP GOING loop after green: root records five weaknesses, worst repair and measured outcome each round. Three consecutive no-gain reviews are pending; historical loop evidence does not release this resumed claim.

One own-game worker and at most one owned headless browser closed in finally. Owner core
stays read-only; no current completion/DONE claim.

## Historical prior-run handoff (superseded)

The following describes r8-local's former Merge Sprint work. Its ownership, paths, readiness
and remaining-action text are historical and do not override the current resume above.

### Original prior-run record

Claim P09 r8-local, branch job/P09-2048-race, game games/merge-sprint.

All local gates passed: typecheck, format, 76 own-game tests including actual SDK
contract and 1,003 race seeds, 21,000 bot games (all counts 2–8/all strengths),
20/20 mutations, all 15 TV/phone/player/spectator surfaces manually reviewed,
and all 31 media checksums independently verified. Media: 4,218,520 bytes.
Details and exact commands are in VERIFY.md. Server sources were restored after
mutations. Latest capture cleanup proved zero living owned browser processes.

Research and implementation milestone ea63c08 and verification milestone
a2a3aa7 are pushed. Main claims are refreshed via a temporary .claims-r8 worktree:
pull --rebase, edit only P09 line, commit/push main, remove worktree. The local
exclude hides that temporary directory; remove it before whole-repo formatting.

Remaining required work:

1. Push the final capture/verification evidence and refresh the main claim.
2. Open draft PR title P09 Merge Sprint, body exactly this job's README.
3. Wait for P09 CI green and mark ready; record URL/run in VERIFY.md.
4. KEEP GOING after CI: list five weaknesses, fix worst, measure, log and push.
   Known candidates: intent-only buzz, missing accepted-merge gain feedback,
   target-finish tie footer, and clearer phone-only buzzer scoring.
5. Repeat until three consecutive rounds give no player-noticeable gain.
6. Read fresh main claims and claim the next eligible lowest numbered job.

Do not repeat the completed simulation/mutations for client-only edits. Re-run
typecheck/format/own tests and recapture any affected surface, then refresh hashes.
Never run another game's tests or launch a second active headless browser.
