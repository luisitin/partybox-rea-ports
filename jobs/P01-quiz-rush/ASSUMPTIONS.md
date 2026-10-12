# P01 assumptions and research limits

- The owner's current public-repository job/CLAIMS instructions govern this REA clone. The older
  PartyBox-team board and worktree workflow is not used here.
- The initial standalone build used the working name Quiz Rush. The owner's naming/overlap
  instruction supersedes it: the product is **Kahoot!**, id `kahoot`, upgrading existing Lightning
  Round. There is one canonical game; the historical job/branch slug remains `P01-quiz-rush`.
- The public branch carries the owner-authorized engine and a core host migration handoff. It
  does not mutate the owner's checkout or apply core registration/persistence migrations there.
- Live original play could not run: Computer Use had no browser inventory, its in-app browser
  was unavailable, and join/host sites returned JavaScript shells to the web reader. Official
  guides and independent host/player screenshot walkthroughs provide reconstruction evidence.
  No original transition durations, tempo ramps or live score latencies were measured.
- Official scoring help, re-read 2026-10-12, has no streak bonus. The job requires one, so the
  current port retains the inherited **300-point cap**, replacing the standalone design's 500 cap.
  Historical bonus sources are labelled. This is a PartyBox adaptation, not current scoring parity.
- The original under-0.5-second full-score exception has only a publisher source here. The port
  retains continuous clamped speed scoring rather than treating that exception as a verified requirement.
- The PartyBox shell handles codes, joining, lobby names and starting. The plugin has an intro
  beat after the shell start. It automatically advances and also preserves VIP Next/skip controls;
  reading floors and reveal/standings/podium durations are tuning choices, not original measurements.
- The implemented upgrade preserves wager default and absent-mode legacy behavior, 1–16 seats,
  EN 6,153/ES 5,561 libraries, custom/preset bets, final wager scoring, awards/recap and the
  100-second wager minigame. Classic is implemented as an additive mode, not a second registration.
- Both modes default to a **15-second requested answer minimum**, 5–30 step 5, extended to their
  visible-text reading floor. Wager bets have a 15-second minimum plus their reading floor. Early
  complete input holds the words until readable; speed arithmetic uses the original fixed answer end.
- Classic draws the exact requested question count without an extra finale; its three packs are
  English-only. Questions draw repeat-free from the seed; choices keep their authored order. The
  earlier standalone 20-second default, choice shuffling and fixed beat minima are historical.
- Phone-only rooms and `canSeeTv: false` players receive public stage information. Classic players
  beside a visible TV use shape-only pads; inherited wager phones retain prompts and labelled answers.
  Spectators/permanently departed seats never answer. Temporary reconnects keep accepted picks/scores.
- Classic answers require question-id and phase-start stamps, and first server acceptance is final.
  Same-choice retry is delivery recovery. Answers at/after the original deadline are too late; wrong
  and missing answers give zero and break streaks except that a wager final can lose its stake.
- Tied totals share competition ranks. Classic podium tiers preserve ties and skip unoccupied ranks.
  The last chart withholds public final standings. During podium, only already-unveiled tiers expose
  rivals' totals; a player's own total remains visible. Complete standings return at done.
- The sixty classic questions are authored using stable general facts, not copied publisher content.
  Paired game-research evidence is in RESEARCH/SOURCES; pack-fact references and ambiguity decisions
  are in [CONTENT_SOURCES.md](CONTENT_SOURCES.md). Existing library sources/licences remain attached.
- The brief's English-only requirement scopes the three newly authored classic packs. Retaining
  inherited Spanish support is an explicit preservation exception. `questionLang` identifies actual
  question language independently of host `contentLang`. Public manifest category is `arcade`.
- Existing Lightning Round already integrated P01 charts and connected/open/deadline guards via
  T-1117. Those are retained baseline behavior, not new upgrade gains. Later reading budgets preserve
  the scoring window while extending visible holds; they need fresh upgraded evidence.
- Core source/provenance is pinned in core-base. Inventory hashes describe the prepared input
  snapshot, not the final modified game. Inherited file art and licensed file music are excluded;
  inline authored visuals and SDK synthesized beds are retained. No new dependency/runtime API is needed.
- The manifest estimate is now 26 minutes, with an adjustable prediction based on question and
  player counts. This includes reading-safe holds; it is not a measured original Kahoot duration.
- Initial static captures showed black labels on wager buttons because the helper shell omitted
  the pinned core `global.css` rule making button/input colour inherit. The helper now matches that
  rule. This was a capture artifact, not a newly identified wager colour defect in the core host.
- The earlier 82 clean frames used a fake 900 px TV stage. Their fit/safe-margin claims do not
  establish pinned-host fit. Playing-phase captures reserve the 133.2 px header, 152.8 px player strip,
  22 px bar and 80 px footer at 1920×1080, leaving a 692 px Stage/626 px inner area. Hiding shell
  names/scores during intro, reveal and podium preserves the player strip's reserved height.
- The actual phone question shell has a 60 px VIP header, 27.6 px counter strut and 4 px bar at
  390×844. It has no permanent host footer or duplicate main-area timer. Capture typography now
  uses pinned global h2 sizing/weight and Nunito Variable, rather than a silent Segoe fallback.
  The existing local font asset and OFL 1.1 licence are included solely for faithful capture;
  no dependency was added and the owner's core source was not changed.
- Reveal stages own their rosters and ranked standings. Ordinary wager separates chart/race from
  all-seat ranked totals; visible-TV phones show a compact receipt at the standings beat. Staged
  phones receive the public chart/board. Final wager choreography retains bets/verdicts/deltas and
  now shows every seat's total, including sixteen-player boards. Classic switches to a board for
  3+ tied entries at any rank; pairs retain podium plinths with readable wrapping wide names.
- Round 1 repaired the measured 15 → 0 default race-name truncations in the old harness.
  Its 226/226 tests and CI 38229318876 at `4cf1a53` remain historical baseline evidence.
- Round 2 baseline is verified: 238/238 tests in 26 files, 416.59 s; 32,000 seeded matches,
  2,006 property seeds and fresh 20/20 behavioral mutation kills against 72 baseline tests.
  CI 38235645918 passed at `e189d22`. All 91 actual-host/Nunito captures, including the rank
  separator, pass; owned browser PID 39756 closed in finally. Hash checks passed 226 media files,
  9,843,669 B, and matched all 76 runtime-source, six restoration, font and token hashes.
- Session 94152 passed typecheck. Formatting failed only for VERIFY.md while that document was
  being edited; it is not recorded as a format PASS. The earlier mutation-overlap check is also
  not a final formatting result. Later source changes require fresh types/format/evidence/hashes.
- Round 3 removes the obsolete minimum combining choices and roster text from disjoint previous
  phone layouts, preserving max actual TV/phone/staged reading floors plus 2 s. Eight-seat EN/ES
  examples improve 58,063 → 53,734 / 63,257 → 56,331 ms. Regenerated typical wager medians save
  433 ms at eight players (84,906 → 84,473) and 1,732 ms at sixteen (115,642 → 113,910); longest
  sixteen-player wager match remains 1,425,695 ms. The examples are not typical-match gain claims.
- Round-3 pacing local checks pass: 240/240 tests, 26 files, 881.47 s, session 36474 exit 0;
  32,000 simulations and 2,006 property seeds regenerated. Fresh mutation session 84630 passes
  20/20 against 72 baseline tests, exit 0, source restored. Pacing CI 38239089152 is green at bd91828;
  later Finale/copy changes need their own checks.
- Root omitted the regenerated fixture from `8cb7355`, an avoidable incomplete milestone;
  CI 38238453616 failed its answer-chart deadline comparison. Root added the fixture at `df5322a`;
  CI 38238947209 then failed 21 unformatted fixtures. They were formatted in `bd91828` and
  CI 38239089152 passed. Neither failure is counted as PASS. Main claim refresh is `646f3a0`.
- Round 4 repairs results Finale fit and static Classic start wording. Real Results Stage is
  866.8 px/758.8 px inside with winner hero/recap; all sixteen bets/deltas/totals remain at 32 px.
  EN/ES step 3 distinguishes Classic podium from Wager's final bet. Copy stays static because
  core about-copy is cached by game id/language, not settings; current runtime has changed.
- Current capture passes 94/94 with zero overflow/clipped/unstyled elements or scrolling. One
  explicit before-repair comparison from the same three-winner/sixteen-wide-name reducer state
  has 85 clipped items; 95 records include that deliberate baseline, not a current failure.
  Ninety of the earlier 91 PNGs are byte-identical to e189d22; the remaining old frame changes
  the standings rank separator. Shared evidence CSS preserves actual selectors/tokens/font.
  Final media hashes: 235 files/8,279,090 B, below decimal 10 MB.
- Browser PID 87684 verified closed in finally. EPERM deferred profile cleanup only. Typecheck
  41896 and format 66656 pass; format follows the second evidence.css formatting pass. Full
  60859 passes 241/241 tests, 26 files, 534.17 s, exit 0, without PB_WRITE_EVIDENCE. All 93
  frozen game/test hashes match before/after; 77 capture-source/six restoration/font/token
  hashes match. Verification summary identifies the exact tested working tree at
  133356320d66ebdccf3def6e2c384f61581d1e77. Pushed 1333563/claim 3addcbb; CI 38241666750
  is green. PR #2 body was refreshed.
- Independent review covered all twelve sheets plus native cases. Ninety of the earlier 91
  PNGs are byte-identical to e189d22; the remaining old frame changes the intended rank middot.
- Round 5 applies own four-column/two-line 32 px stakes cards only at 13–16 seats; ≤12 retains
  SDK. Four normal positive-score names' ellipses → zero with 416 px name space; all sixteen
  scores/placed marks remain visible. Spanish 40-character/five-digit/long-leader/all-placed
  cases pass. Archived stakes-before PNG and loop-5 fit JSON preserve the comparison.
- First capture 39757 failed 20 clipped last-row items. Specific div.wagerStage and wrapping
  32 px rules fixed them; helper now copies exact pinned global muted/caption rules. The old
  90/91 PNG identity proof belongs only to round 4 before this helper correction.
  Final 50244 PASS 95/95 current plus one explicit 85-clipped Finale baseline (96 records).
  PID 52968 closed in finally; EPERM profile cleanup deferred. Checkpoint 8,710,478 B precedes
  loop-5 JSON, so final all-media size/hash remains pending.
- Full 37496 PASS 242/242, 26 files, 484.58 s, exit 0; typecheck 32345 PASS. Runtime JS/server
  stayed frozen; Tv.module.css and upgrade-evidence.ts changed early while properties ran.
  No all-93 freeze claim applies. Verification JSON records both before/after SHAs; final ten
  renderer tests ran after fixes and current 77 capture/six restoration hashes match. Independent
  twelve-sheet/native phone/stakes QA found no concrete remaining visual defect. Final
  format/stable hashes/push/head CI and three consecutive no-gain rounds remain pending.
- VIP Next/skip is an inherited platform input without a phase stamp (public shared/protocol.ts;
  pinned core Playing.tsx and engine/vip.ts). A delayed old-screen Next can skip the new current
  phase after automatic advance; local duplicate-click guards do not prevent that across devices.
  Repair requires protocol/engine phase matching outside the authorized game/core-read-only scope.
  No complete stale-Next protection is claimed.
- Old standalone 116-test/7,000-match/screens/mutation/loop evidence is historical. No upgrade
  no-gain rounds or DONE are claimed; three consecutive no-gain rounds and final checks remain.
  The public kit lacks core gen-registry/verify commands; discovery, typecheck, format and
  contract checks validate this module. The core migration handoff remains unapplied.
