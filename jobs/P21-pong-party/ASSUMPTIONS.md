# Assumptions

- The owner's public-port instructions supersede the general PartyBox team workflow for this clone, including claim-only commits on main and PRs through `gh`.
- `pong-party` is the stable plugin id from P21; **Octo Rally** is the original displayed name.
- The job prescribes an octagon but does not name one mandatory source product; research combines independent multiplayer paddle games and an octagonal design proposal.
- Five initial lives and a 60-second match cap keep elimination and timeout finite. Exact spawn timings and scoring are port-specific tuning.
- Occupied edges are spread across the octagon at fewer than eight players. Unoccupied and eliminated edges reflect.
- The workshop has no runnable PartyBox shell. Screen verification supplies shell-sized static documents and separately checks the pure game lifecycle.
- PowerShell script execution policy blocks `pnpm.ps1`; use `pnpm.cmd` without changing machine policy. Dependencies installed once using the existing lockfile.
- The connected computer browser and in-app browser are unavailable. A single scoped headless Chromium fallback may be used, with closure in `finally`, if the cached browser tooling is accessible.
- Cached Playwright Core 1.58.2 and Chromium 1243 are available outside the repo. A live-client practice click ran but navigation waiting timed out under desktop load; a complete original game was not measured. Source/client inspection and independent primary rules support the adaptation.
- Native `pnpm.cmd` reinterprets a pipe-bearing test-name regex through cmd.exe. All checks use plain scoped paths or the literal `mut:` filter, never pipe-bearing filters.
- Commands mentioned in inherited game rules such as `pnpm gen-registry` and `pnpm verify` are absent from this workshop. The binding public checks are typecheck, format, scoped game and SDK contract tests.
