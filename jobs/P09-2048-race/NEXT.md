# P09 resume

Runner r1-local; branch job/P09-2048-race; canonical games/2048; draft PR12.

Current implementation restores classic280px phone board, Score/Best score HUD,
value fills, square public maps,100ms travel,200ms delayed spawn/merge,600ms
score rise, initial appearances, arrows/WASD/HJKL and original swipe threshold.
Target AND final-blocked players retain the private board through1200ms delay,
800ms fade and1000ms fully-visible overlay, then all final standings. Public
terminalPayoffUntil survives pause/resume/reload; full ranking reading time follows.

Fresh generalized-clock21k simulation is finishing;20new behavior mutants and
current full baseline follow sequentially. Earlier114-test and21k results are
historical. Source guards reject drift. Do not mark DONE using them.

Original classic478b6ec was played in a fresh profile; start/midgame screenshots
and visible states are games/2048/fidelity/. Hosted URL now redirects to the2026
redesign. No upstream code/assets ship. Arial is the declared original fallback;
Clear Sans glyph differences are explicit in GAPS.md.

Remaining: finish own interactive motion probe (CSS timing float tolerance and
600ms score receipt; JS debugger freezes cleanup while compositor captures),
refresh29 static HTML/PNG captures and original/ours comparison after HUD repairs,
manually review them, update GAPS/VERIFY/README/LOOP, regenerate combined media
checksums and current-source evidence, pass typecheck/format/current CI. Then do
three consecutive post-green no-gain reviews, mark PR ready and claim DONE.

Every own browser closes in finally with exact-profile zero-PID verification.
Do not run captures concurrently. During mutation planting, do not import or
change game server files or regenerate fixtures; wait for source restoration.
Refresh the main claim after each job push, pulling --rebase immediately before
EVERY CLAIMS commit in the existing r1-local claims worktree.

Resume unfinished r1-local claims before taking any new job.
