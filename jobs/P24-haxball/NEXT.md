# Resume P24 Haxball

- Claimed by r3-local on job/P24-haxball after finishing P03 / PR #3.
- Research: official physics/controls/team docs plus independent firsthand sources inspected;
  deeper transient client findings are being recorded in RESEARCH.md / SOURCES.md.
- Monorepo duplicate check complete: no equivalent game in the 110-game inventory.
- Architecture: pure fixed-step circle physics, numbered red/blue teams, two 90s halves,
  held D-pad + one-armed-kick-per-press, input leases and phase/sequence replay protection.
- Research/design milestone complete. Server, client and verification are being implemented;
  no validation pass is claimed yet. Run the evidence test once to export phase fixtures before
  collecting the full haxball SDK shard, then run all scoped checks.
- Remaining: build, meaningful rule/contract/property/bot/mutation checks, phase fixtures and
  TV/phone/phone-only/spectator capture; green CI, PR and KEEP GOING before DONE.
- Install is already complete. Use pnpm.cmd in PowerShell and only games/haxball tests.
- Refresh main CLAIMS.md after every push, with pull --rebase before each CLAIMS commit.
