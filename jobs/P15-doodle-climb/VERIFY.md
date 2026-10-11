# Verification

In progress; final simulation and mutation reports are pending. Only this game's tests run, with one worker. One isolated headless Edge instance captured the screens and was closed; no whole-suite browser run.

- Installation: `corepack.cmd enable`, then `pnpm.cmd install` once on Windows.
- Initial type check: `pnpm.cmd typecheck` passed. Final check follows the latest changes.
- Focused checks: `pnpm.cmd vitest run games/doodle-climb --maxWorkers=1`; units, physics, media and 1,003-seed properties passed. The imported real SDK suite found an eight-seat 5,000-event cap at 100 ms broadcasts. Broadcasts are now 200 ms, physics remains 20 ms, and the unchanged random/fast contract cases pass. Remaining local timeouts are being checked with a longer CPU allowance.
- Phase fixtures: `pnpm.cmd tsx jobs/P15-doodle-climb/tools/fixtures.ts`, including the real last-score timer continuation to `done`.
- Screens: the media test uses actual React components, SDK providers, CSS modules and design tokens. `node jobs/P15-doodle-climb/browser.mjs --research` captured all four phases × TV/phone/phone-only/spectator. Every TV capture is 1920 × 1080; every phone capture is 390 × 844. All sixteen were inspected by hand. `screen-metrics.json` reports zero viewport overflow and zero out-of-bounds headings, paragraphs, rows or controls. Buttons exceed the 44 px minimum. Media is below 10 MB.
- Research play: the same browser loaded the public recreation and sent two 250 ms arrow holds with releases. Native original play and numeric fidelity are not claimed. The recreation screenshot remains outside the repository.
- Trial simulation: 20 seeds at every count 2–8 (140 matches), mixed strengths at 100–400 ms reactions, all ended within 200 s against the 480 s bound; median round 60 s. The final 7,000-match run uses the SDK's documented 300–1,200 ms host cadence.
