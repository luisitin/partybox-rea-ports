# Research — 2026-10-11

## Sources and agreement

1. [Voodoo, developer](https://voodoo.io/games/helix-jump): revolving platforms, automatic bouncing/falling, fatal danger sectors, fast falls breaking even trap platforms.
2. [CrazyGames, official browser distribution](https://www.crazygames.com/game/helix-jump): rotate openings beneath the ball, avoid forbidden sectors, three consecutive gaps charge one invincible landing that destroys the platform.
3. [Independent tutorial](https://helixjump.world/tutorial/): confirms the three-gap charge and one-shot smash, and recommends planning the next opening during the current bounce.

Only mechanics are used; no source code, visuals, sounds, product names or assets are copied.

## Original loop and feel

The ball stays at a fixed angular position and bounces by itself. The player rotates the whole tower: openings move toward the landing point. A safe solid landing rebounds; danger ends the attempt. Three uninterrupted gaps make the next solid landing a smash, including danger, then the charge is consumed. The rewarding moment is a fast cascade after patiently aligning several openings. The next few rings must be visible to make it planning rather than guessing.

The original is single-player and has cosmetic unlocks, missions and optional power-ups. Those are omitted from the living-room competition. Exact original gravity, bounce impulse, rotation speed and sound timings could not be measured; all numerical constants below are original tuning, not asserted source facts.

## Access attempts

Web search and open retrieved the developer and distributor descriptions. CUA `createBrowserTab("iab", ...)` returned “Browser is not available”; `cua.getState()` returned no browsers or apps. Live original gameplay was therefore unavailable through the connector. This is a research limitation, not a claim to have played the original. Further public-page/bundle inspection is recorded in SOURCES.md when completed.

## PartyBox design

One 60-second race, 2–8 independent balls on identical seeded towers. Three lives by default avoid a first-touch elimination; a 1.2-second crash beat precedes a fresh attempt from floor zero. Best completed depth is retained, so taking a risk never erases progress. Highest depth wins, with shared ranks for ties. The round can end early only when every player has exhausted their lives.

TV: eight labelled towers, a large round clock, depth and life count on each lane. Phone: labelled hold-left/right buttons and personal depth/lives; the next rings are always visible on the phone because timing requires local feedback. Phone-only: personal tower plus compact all-player standings, never a TV instruction. Spectators see the stage with no controls.

The shell supplies the initial instructions and countdown; init begins play immediately. Safe rings have solid fill, danger sectors have cross-hatching and a cross, gaps are empty, and the landing point has an arrow. Motion is useful physics feedback; decorative transitions follow reduced-motion tokens. The shell’s reveal chime accompanies results; no copied audio is used.
