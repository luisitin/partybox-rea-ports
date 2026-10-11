# P21 research — multiplayer paddle survival

Research date: 2026-10-11. Mechanics are studied independently; all port code and art are original.

## Source observations

1. [PPong developer listing](https://niko-game.itch.io/ppong): 2–8 players guard individual walls, losing lives leads to elimination, last paddle standing wins. Practice fills seats with bots. This version shrinks the arena and adds post-elimination hazards and power-ups.
2. [Atari Warlords original manual, preserved at AtariAge](https://www.atariage.com/2600/manuals_old/warlords.html): move a shield with one rotary axis to deflect a ball; misses erode protection; a battle finishes with one survivor. The manual distinguishes slow/fast ball settings and ricochet/catch controls.
3. [Octopong designer notes](https://www.i-volve.net/gd/mind-fragments/octopong): explicitly proposes an octagonal playfield with one eighth per player, and calls out paddle width relative to the protected edge. This is a design proposal rather than proof of a released eight-player implementation.
4. [PonGo author repository](https://github.com/lguibr/pongo): four guarded edges, reflection on empty walls, temporary additional balls, rebound angle based on paddle contact, and reconnect with preserved slot. This supports a second independent implementation of shared edge defence and multiball.
5. [PONG author repository](https://github.com/Gr33nOps/pong): touch dragging controls a single axis, sharper edge returns, and rallies accelerate. This independently supports the one-axis control and rising-rally-pressure interpretation.

## Evidence pairs

| Fact informing this port                                        | Independent sources                                   |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| Shared arena with a paddle defending each player's region       | PPong + Warlords manual + PonGo                       |
| Misses threaten survival; last survivor is a natural conclusion | PPong + Warlords manual                               |
| One axis is enough to move a guard paddle                       | Warlords manual + PONG author README                  |
| Pressure can rise through ball speed and additional balls       | PPong/PONG for speed; PonGo for temporary extra balls |

The exact octagonal layout comes from the binding job and Octopong's designer proposal. Five lives, a 60-second cap, the spawn schedule, and the scoring weights are original tuning decisions, not claims about the originals.

## Feel and living-room translation

- The satisfying beat is a visibly saved ball followed by a change of direction. A miss should be obvious through a life count and impact cue, rather than colour alone.
- One TV shows the whole arena; phones primarily show a large slider, the player's numbered edge, lives, and saves. A phone-only room carries the same public arena above the controls.
- Keep the arena fixed when someone is eliminated: eight people can learn their own edge without remapping controls mid-match. Empty/eliminated edges reflect instead of charging another player.
- Start immediately after the shell's rules/countdown, show a short score beat, then yield the final results to the shell.
- All timing is event-driven and authoritative. Contact angle matters; the phone never decides whether it saved a ball.
- Original games use different audio. The port uses only PartyBox SDK cues and haptics; no music or sounds were downloaded.

## Access log

The developer pages and public GitHub sources were reachable. The connected computer browser inventory was empty, and the in-app browser was unavailable. One cached Playwright/Chromium instance opened the embedded live client and observed the landing flow. The practice click executed, then timed out waiting for a scheduled navigation; no complete original match is claimed. The browser closed in `finally`. The access evidence is in `research-live.json`, and the reproducible inspection is `research.mjs` (tool-only, never imported by the game).

The live page's public 1,567,406-byte bundle was read in memory, with no file saved: it exposes a practice action, offline mode, one-axis keyboard/mouse control, paddle/life state, and an AudioContext. The author's `pongo-client` tree was also inspected: input/controller, keyboard/joystick, arena orientation/segment, replay/results, and synthesized cue modules separate gameplay from presentation. No implementation was copied. Exact original timing and sound measurements were not recoverable from this limited run; port tuning is therefore stated explicitly rather than attributed to the original.
