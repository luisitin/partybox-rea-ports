# Assumptions and research limits

- The queue instruction is the owner's authorization for this standalone public repo. Its explicit claim-on-main and PR process supersede the desktop team's normal private PartyBox board workflow.
- `pnpm.cmd` is used on Windows because PowerShell execution policy blocks the pnpm.ps1 shim. `corepack enable` succeeded; dependencies were installed once.
- `rg` is unavailable on PATH. File inventory uses Git and reads use Node UTF-8.
- Browser UI inventory is empty (`cua.listBrowsers()`); creating an in-app browser failed with “Browser is not available: iab”. Direct original play is unavailable here. Research proceeds from two independent hands-on reports, original-developer slides, and read-only public remake client inspection; no direct timing measurement is claimed.
- Exact original lane probabilities, movement timing, and eagle timeout are not public facts established by this job. Width 15, bounded hazard groups, 60-second race, eight-second progress pressure, respawns and shared non-colliding racers are PartyBox adaptations.
- The repo exports SDK contract-test building blocks but does not automatically register new game contract tests. This job wires a scoped suite using those helpers so the game's test command covers it.
- Registry generator and full shell are absent in this workshop clone. Standalone TV/phone entry modules and rendered fixture artifacts are the supported deliverables.
