# P14 handoff

Run: r10-local. Branch: job/P14-crossy-streets. Claim pushed on main.

Research, deterministic server, original SVG UI, phase fixtures and scoped verification harness are implemented. Source is temporarily frozen while the final 20-mutation run executes. The initial run caught 20/20; its final restored-baseline worker stalled, so the recorded repeat uses direct Node, Vitest threads and `login:false` on Windows.

Remaining: final typecheck/format/game tests; seeded simulations and properties; finish the recorded mutation repeat; render and inspect every surface with capture.mjs (one disposable browser, always closed); record commands and evidence; draft PR and wait for scoped CI; KEEP GOING improvements until three rounds have no player-visible gain.

No local server or browser is running. Dependencies installed once through pnpm.cmd. Use `login:false` for exec commands and `pnpm.cmd` on this Windows runner. Run only this game's tests, with `--pool=threads --maxWorkers=1` locally.
