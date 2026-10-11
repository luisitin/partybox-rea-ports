# P19 — Assumptions and access limits

- The owner's REA-runner instructions govern this clone, its claim commits and public PR flow; the PartyBox-team board workflow is not used for this independent public repository.
- P19 requests one 30-second simultaneous race. No configurable round count, music pack, scrolling speed or difficulty setting is added; room bot strength remains supported.
- Tile Tempo is the original product name. The historical game names appear only in research attribution.
- The original is a native mobile title. It was not installed, and a live play-through could not be performed because computer-use reported zero enabled browser/app surfaces. Research used independent historical and primary descriptions plus direct inspection of a public browser reconstruction; no live-play evidence is claimed.
- Direct GameFAQs access was restricted. Indexed first-hand guide text was available. ToolGenie's HTML and public client bundle returned HTTP 200 through PowerShell; a web-tool open failed even though direct HTTP succeeded.
- Modern browser clones disagree about mode labels, motion and missed-tile penalties. Use the requested timed count/failure loop and treat self-paced movement as an explicit adaptation; do not import a clone's exact speed or collision window.
- One dark note per row, four-column touch targets, a 3-second ready phase and 6-second score phase are port choices. The initial track has 1,024 rows and grows by seeded 1,024-row chunks near its tail, so the game imposes no arbitrary tile-count cap.
- A race ranks only tile count. Equal counts share rank even when failure times or average speeds differ. Earned tiles survive a wrong tap.
- Upcoming notes are controller-private; TV, spectators and other players see only public counts, speed and run status. Phone-only views include that stage without exposing another player's upcoming notes.
- Correctness is judged on authoritative event time. Delayed packets at or after the deadline cannot score, and row-index replay protection prevents stale taps from acting on the next note.
- Research consumes no browser process; only the root runner may launch the one authorized capture browser, with cleanup in a finally block. No whole-suite browser run is authorized.

- Local Windows Vitest fork workers were slow to terminate under desktop load. Final targeted verification uses one thread and a120s test allowance; CI remains bounded by30minutes.
- The public clone has no gen-registry script or host shell; entries follow the lazy-loading contract and are checked by the SDK loader.
