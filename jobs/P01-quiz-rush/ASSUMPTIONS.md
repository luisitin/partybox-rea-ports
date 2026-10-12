# P01 assumptions and research limits

- The owner's current public-repository job/CLAIMS instructions govern this REA clone. The older
  PartyBox-team board and worktree workflow is not used here.
- The named inspiration is Kahoot classic live quiz mechanics; the product name in the picker,
  manifest and game UI is Quiz Rush. No original branding or assets are used.
- Live original play could not run: Computer Use had no browser inventory, its in-app browser
  was unavailable, and the original join/host sites returned JavaScript application shells to
  the web reader. Read official guides and independent host/player screenshot walkthroughs instead.
  No original transition durations, tempo ramps or live score latencies are claimed as measured.
- Current official scoring has no streak bonus. The job explicitly requires one, so Quiz Rush
  adds a visible capped bonus as an intentional adaptation. Historical bonus sources are labelled.
- The original sub-0.5-second full-score exception has only a publisher source here. Quiz Rush
  uses a continuous clamped speed formula and does not treat that exception as a verified requirement.
- The PartyBox shell handles room codes, joining, lobby names and starting. The plugin does not
  duplicate account creation or lobby infrastructure.
- Original games can have manual Next clicks; this living-room port automatically advances.
  Its reading floors and reveal/score/podium durations are tuning choices, not original measurements.
- Players in phone-only rooms, and players who cannot see the TV, receive stage information.
  Players using a visible TV receive only shape pads during answering. Spectators never answer.
- Wrong answers and timeouts both give zero and break a streak. A player's first accepted answer
  is final; an answer arriving at or after the deadline is too late.
- Tied totals share ranks. Podium tiers preserve ties rather than inventing an arbitrary winner.
- Question text is authored for this port using stable general facts. These are original trivia
  questions, not copied publisher content; independently corroborated game-research facts are
  recorded in the source matrix. Detailed pack-fact references and ambiguity decisions are in
  [CONTENT_SOURCES.md](CONTENT_SOURCES.md).
- English-only arcade content follows the job brief and the reference port. No new dependency,
  runtime external API or downloaded asset is required.

- The owner naming/overlap instruction supersedes the initial standalone Quiz Rush: use canonical Kahoot!/kahoot and upgrade existing Lightning Round. The public branch carries that engine and a core host migration handoff; it does not mutate the owner's checkout or register a second game.
- Existing Lightning Round already integrated P01 answer charts, reading floors and connected/open/deadline guards through T-1117. Those are retained baseline behavior, not new upgrade gains.
- Preserve existing wager default, absent-mode legacy behavior,1–16 seats, EN 6153/ES 5561 libraries,300-point streak cap, custom/preset bets, awards/recap and minigame. Classic is additive. The generic English-only brief is interpreted as the scope of its three newly authored classic packs; retained inherited Spanish support is an explicit preservation exception, not a claim of literal English-only compliance. Public category becomes arcade as required.
- Classic uses the existing regular 500–1000 scoring and 300-point streak cap rather than the old standalone 500-point bonus cap; this is a PartyBox adaptation. The wager finale stays unchanged. Question language is exposed separately from host-controlled contentLang.
- Core source/provenance is pinned in core-base. Its inventory hashes describe the prepared input snapshot, not the final modified game. Licensed original/core media are excluded; question-library attribution and licenses remain attached.
- Old standalone 116-test/7000-match/screens/mutation/loop evidence is historical. Fresh upgraded verification and a new three no-gain loop are required before READY/DONE. Public kit lacks inherited gen-registry/verify commands; its SDK discovery, typecheck,format and game contract checks validate the canonical module.
