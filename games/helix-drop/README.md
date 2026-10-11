# Helix Drop

## Overview

A simultaneous tower descent with original SVG art. Rotate the whole tower while your ball bounces automatically: thread empty gaps, bounce safely on solid sectors, and avoid cross-marked danger. One 60-second race starts immediately after the shell's instructions and countdown. Everyone receives the same seeded 120-floor tower and initial rotation. Three gaps without a bounce charge a single smash through the next solid landing, including danger.

## Players

2–8 players. Each has an independent copy of the same tower. Bots choose the shortest rotation toward the next opening; easy makes frequent aiming mistakes, normal makes fewer, and sharp aligns precisely without random mistakes. A spectator sees the stage without steering buttons.

## Phases

| Phase  | TV                                                   | Phone with TV                                        | Exit                                                            |
| ------ | ---------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| play   | Every labelled tower, depth, lives, large race clock | Personal tower, depth/lives, hold-left/right buttons | 60 seconds, all lives exhausted/all towers cleared, or VIP skip |
| reveal | Winner/tie, frozen towers, final depths              | Personal depth/rank and public standings             | 6.5 seconds or VIP skip                                         |
| done   | Final winner/tie and towers; shell results follow    | Final rank/depth and standings                       | Terminal                                                        |

### Phone-only rooms

| Phase  | Phone-only stage                                                                           |
| ------ | ------------------------------------------------------------------------------------------ |
| play   | Personal tower, controls and compact all-player depth standings; spectator sees all towers |
| reveal | Winner/tie, personal tower and all-player standings                                        |
| done   | Winner/tie, personal rank and all-player standings                                         |

`ctx.presence.phoneOnly`, a remote player's `canSeeTv: false`, and SDK `usePhoneOnly` all receive stage support. No screen points at an absent TV. Public windows contain three upcoming rings; a normal controller receives its own lane, while stage/spectator views include all lanes. Eight-player phone screens fit 390×844 with shell space reserved.

## Inputs

`{ type: 'rotate', dir: -1 | 0 | 1 }`: hold left, stop, hold right. Both held cancel. Pointer release/cancel/lost capture, keyboard release and window blur stop steering. Arrow keys, A/D, and Space/Enter on a focused button are supported. Held input renews every 250 ms; a lost connection's lease expires after 800 ms. Disconnected players cannot steer until reconnect.

## Scoring

Best completed floor, 0–120, is the score. A crash restarts at floor zero after 1.2 seconds and keeps the deepest completed floor. Three lives by default. Danger costs exactly one life; final life ends that player's run. Everyone else keeps playing. Equal depths share the rank; there is no hidden time tie-break. Clearing the tower locks 120 floors.

## Edge cases

- Fixed 20-ms collision samples, rearmed 200-ms server beats; batching identical events gives identical state. Rotation is 150°/s, gravity 14 floors/s², bounce −4.2 floors/s, terminal fall 8 floors/s. These are original tuned constants.
- The opening has a four-degree ball-clearance margin. Danger includes its boundary. Three safe introductory rings have no danger. Later rings narrow gradually; nearby openings form seeded groups that permit cascades.
- A safe bounce clears the chain. Three consecutive gaps arm one smash; a smash clears the chain and is not a permanent shield.
- Pause settles to the pause instant; all movement/inputs hold. Resume moves the start/end clocks and clears stale holds. Recovery is measured in unpaused race time. VIP end during a pause keeps the held depth.
- Refresh reconstructs depth, lives, recovery and tower from state. Disconnect clears steering; the clock continues without waiting for any phone. Players who leave remain in results.
- Unknown/prototype-name inputs, stale/early timers and backwards input times are ignored. Done is terminal. All state/views are JSON; no clocks, random calls or I/O in the server.
- Colour is reinforced by numbered lanes, open gaps, crosses on danger, and text for lives/recovery/charge. Decorative control transitions respect reduced motion.

## Settings

| Key   | Type   | Default | Range |
| ----- | ------ | ------- | ----- |
| lives | number | 3       | 1–5   |

The initial shell instructions describe the default. Personal screens always show the actual lives.

## Content

No packs. All platforms come from `state.rng`; English only. All SVG/CSS art is original, uses PartyBox tokens, and makes no runtime network requests. The reveal uses the shell's sound cue.

## Sources

- [Voodoo developer description](https://voodoo.io/games/helix-jump) and [CrazyGames official distribution](https://www.crazygames.com/game/helix-jump): revolving platforms, automatic bounce, danger and charged smashing. CrazyGames specifies three uninterrupted gaps.
- [Independent tutorial](https://helixjump.world/tutorial/): corroborates three-gap charge and single smash.
- Live original play was unavailable: CUA exposed no browsers. Numerical physics, multiplayer race, lives and depth-only ranking are intentional original adaptations. Research detail/provenance: `jobs/P17-helix-drop/RESEARCH.md`, `SOURCES.md` and `ASSUMPTIONS.md`.
