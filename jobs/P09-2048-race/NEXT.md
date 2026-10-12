# P09 resume

Runner r1-local; branch job/P09-2048-race; canonical games/2048; draft PR12.

Current implementation restores classic280px phone board, Score/Best score HUD,
value fills, square public maps,100ms travel,200ms delayed spawn/merge,600ms
score rise, initial appearances, arrows/WASD/HJKL and original swipe threshold.
Target AND final-blocked players retain the private board through1200ms delay,
800ms fade and1000ms fully-visible overlay, then all final standings. Public
terminalPayoffUntil survives pause/resume/reload; full ranking reading time follows.

Final behavior evidence passes119/119tests,21,000/21,000bot games (max220,911ms)
and20/20semantic mutation kills. All server/manifest/client/test hashes match
the restored correct merge equality. A planted mutant accidentally entered
milestone1a5afda; root diff audit caught it and the final push restores equality.
That milestone CI stopped at format before tests; corrected final CI is required.

Original classic478b6ec was played in a fresh profile; start/midgame screenshots
and visible states are games/2048/fidelity/. Hosted URL now redirects to the2026
redesign. No upstream code/assets ship. Arial is the declared original fallback;
Clear Sans glyph differences are explicit in GAPS.md.

Final visual evidence:29 fresh static frames pass viewport/clipping/overlap,
essentialTVtype and touch checks, individually reviewed alongside the historical
negative baseline. Root viewed all10fidelityPNG; pairedstart/midgame semantic
boards/scores match,280px squares. Actual button-driven motion passes100/200/600ms
timings and winning-board→complete-ranking handoff across5frames, stable hashes.
Fixturecheck reproduces the genuine current seeded match exactly. Typecheckpasses.
All79media/fidelity checksums and combined~8.25MB budget are independently checked.

Repaired ac19f53 is green: P09run38269913419,kit38269913417. Independent client,
independent server and root reviews completed three consecutive post-green
no-gain rounds3–5, recorded inLOOP.md. All79checksums were also checked against
committed git blobs:8,251,290bytes; source/test/motion guards match.

Implementation, verification and three quality-review rounds are complete.
Final review commits change documentation only; tests and media are unchanged.
The authoritative ready/DONE records arePR12 andmainCLAIMS.md: require the
latest PRhead'sP09/kit green before ready/DONE. No further game changes are
required by the recorded reviews. The PRbody is the under60line jobREADME.

Next queue action is the lowest eligible job after all own active claims are
finished. P05 was stale at15:25UTC (claim06:59Z,branch1f6ac64 lastcommit06:57:37Z),
but recheck freshmain/branch activity beforeclaiming. Owner core stays read-only.

Every own browser closes in finally with exact-profile zero-PID verification.
Do not run captures concurrently. During mutation planting, do not import or
change game server files or regenerate fixtures; wait for source restoration.
Refresh the main claim after each job push, pulling --rebase immediately before
EVERY CLAIMS commit in the existing r1-local claims worktree.

Resume unfinished r1-local claims before taking any new job.
