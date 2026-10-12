# P04 assumptions

- This public REA clone follows the owner's explicit queue, CLAIMS, branch,
  push and PR instructions. Generic PartyBox board/worktree/main-push rules
  target the private product repository and are overridden for this task.
- The port reconstructs mechanics with original content; it is called Draw
  and Guess and uses no original brand art, source code or sounds.
- Original-game interactive play is not claimed by the research agent.
  Read-only public markup/client inspection and independent instructions were
  available; Gartic's interactive endpoint returned 403 to desktop HTTP.
  The follow-up CUA inventory returned no browsers; opening a visible in-app
  skribbl tab failed `Browser is not available: iab`. Whether a one-player
  private room can start remains unverified. No public lobby or chat was used.
- Exact contemporary original hint timing, drawing default and point formula
  are unknown. The documented 8-second choice, 60-second draw, two automatic
  hints and custom speed/drawer scores are deliberate PartyBox adaptations.
- One lap means each available seat draws once. Optional two laps retain the
  same per-turn limits. Fixed laps replace Gartic's score-goal endpoint to
  make match length predictable at two to eight seats.
- No free chat is required. Keeping raw guesses off the shared stage avoids
  accidental answer leakage while success names preserve room feedback.
- English family-friendly original words ship in three difficulties with
  exactly 100 entries each. Familiar objects and creatures dominate easy;
  compounds/actions suit medium; less immediate scenes/concepts suit hard.
- Bots may use known vocabulary and public hints; they may not read the
  private answer when guessing. Bot artists may know their chosen private
  word and emit original drawing templates. Strength changes strategy.
- Refresh restores the current role, strokes and personal verdict. A dropped
  artist must not stall the room; disconnected guessers do not gate exit.
- Research recommendation for reveal duration is SDK `readingMs`, with
  concise copy aiming at 8-10 seconds. Final implementation and checks record
  its exact value in the game README and VERIFY.md.

The research proposal mentioned an eraser. The shipped small toolset uses complete-gesture Undo and two-tap Clear to correct drawings; no pixel eraser is needed by the job. This is a deliberate phone usability choice.

- The existing `.claims-main` worktree belongs to this runner inside its clone.
  It is used only for small CLAIMS commits, always preceded by pull --rebase.
- Exact regional spellings are accepted for four original words; synonyms and
  plurals are separate guesses, consistent with the displayed letter mask.
- Browser-local performance.now controls packet spacing only. Game clocks,
  hints, scoring and phase exits still use injected event.now exclusively.
- Continuous ordinary finger input is sampled within the packet budget.
  Extreme synthetic tap/edit floods can accumulate ordered delivery latency;
  they do not produce a transport burst or merge optimistic revisions.
