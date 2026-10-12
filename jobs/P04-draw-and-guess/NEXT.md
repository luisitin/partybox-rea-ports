# P04 continuation

Branch: job/P04-draw-and-guess. Runner: r2-local.

PR #1 remains open. R15 mixed hands now include one original word per
difficulty in shuffled order. R16 private near-miss feedback accepts one
insertion, deletion or substitution after normalization. The full scoped
suite passes 207 tests; all 7,000 seeded matches terminate. Windows emitted
fork cleanup warnings after passing assertions; the command exited 0.

R17 source fixes address compact artist canvas containment, release-only
pointer endpoints and Safari visual-viewport compact rules. Validate these
with the updated playcheck harness, then refresh 33 PNGs and media hashes.
Run typecheck, format and scoped game tests after the client changes.
The browser harness now bounds close RPCs and cleans its unique Windows
profile to handle launcher PID handoff. Never launch another browser until
the current harness has completed cleanup.

Reconcile VERIFY.md/LOOP.md with final measured evidence, check PR CI and
continue KEEP GOING until three consecutive reviews find no player-visible
gain. No-gain count remains zero. Audit follow-ups: high-rate coalesced
pointer packets may bypass the 80 ms gate; disconnected roster copy and
alternate English answer spellings merit review.

Original interactive play was unavailable through CUA; see RESEARCH.md.
