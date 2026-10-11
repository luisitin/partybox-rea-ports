# P18 verification

Pending verification. This file records executed commands and observed results;
unexecuted checks do not count as passing.

- Setup: `corepack enable`, then `pnpm.cmd install`: succeeded; existing lockfile
  reused, no new dependencies. The PowerShell pnpm.ps1 wrapper is blocked by policy,
  so commands use pnpm.cmd without changing the machine execution policy.
