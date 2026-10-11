# _template (Quick Poll) — local rules

- This folder is the scaffold source for `pnpm new-game <id>`; keep it minimal and fully working.
- `manifest.id` is `template` (folders starting with `_` are contract-tested but never registered).
- Every file exists for a reason a new game needs: one phase per file, content + schema, fixtures per
  phase, `__tests__/contract.config.ts` for hidden-info checks, README with the required headings.
- Regenerate fixtures after changing state shape: `pnpm sim --game template --dump-fixtures --players 4`
  (until then, edit `fixtures/*.json` by hand — they are full states).
- Test: `pnpm vitest --project games` and `pnpm vitest --project 'contract*'`.
