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
  establish pinned-host fit. Current captures reserve the 133.2 px header, 152.8 px player strip,
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
  Post-round-1 checks passed 226/226 in 25 files, 196.07 s; CI 38229318876 passed at `4cf1a53`.
  These remain baseline evidence while round 2 verification is being completed.
- The current 91 Nunito/pinned-chrome captures pass fit metrics and hand review; evidence totals
  8,957,011 B and browser PID 96636 is closed. A rank separator added after hand review still
  requires focused recapture. Full game test run 21307 is active; its result is not yet green.
- Old standalone 116-test/7,000-match/screens/mutation/loop evidence is historical. Fresh upgraded
  verification, CI and the remaining KEEP GOING gates are required before DONE. Initial and
  post-round-1 CI are green; no fresh round-2 CI pass or completed loop is claimed. The public
  kit lacks core gen-registry/verify commands; its discovery, typecheck, format and contract
  checks validate this module. The core migration handoff remains unapplied.
