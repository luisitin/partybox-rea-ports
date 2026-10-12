# Offline controller input harness

Build from the repo root:

```powershell
pnpm.cmd exec node jobs/P22-ricochet-rumble/input-harness/build.mjs
```

The installed Vite CLI produces an IIFE. The builder inlines its JavaScript and CSS into
`../media/input-harness.html`; the ignored `dist/` folder is only an intermediate. No server,
runtime network, additional dependency, or browser is needed to build it.

The page mounts the actual Tank Trouble Controller with `game.init`, eight fixed fictional
players, and SDK phone-only/server-clock providers. Game timers do not advance the arena.

Wait for `window.__harnessReady === true` before dispatching browser input. Controls arrive in
`window.__sentControls` (at most 500 entries); `window.__lastControl` contains the latest command.
`window.__clearSentControls()` clears both. Each entry is the original `{type, drive, turn, fire}`
command captured by the Controller's send callback.

Browser automation APIs:

- `__setActive(false)` pauses the hand and should release held controls; `true` resumes it.
- `__setPhase('ready'|'play'|'score'|'done')` changes the rendered phase and phase key.
- `__setRound(n)` changes the round key; `__setConnected(false)` simulates disconnection.
- `__setPhoneOnly(false)` selects the hand with a TV; the initial value is `true`.
- `__getHarnessOptions()` returns these settings; `__resetHarness()` restores them and clears logs.

Stable selectors: `[role="group"][aria-label="Tank controls"]` for the control surface and
`button[aria-label="Hold to fire"]` for Fire. The five keyboard buttons retain the production
labels: Drive forward, Drive backward, Turn left, Turn right, Hold to fire. CSS module class names
come from the actual current source. Rebuild after Controller/control-hook changes.
