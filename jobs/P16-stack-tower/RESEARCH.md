# P16 research: Skyline Stack

Research date: 2026-10-11. Reference: the original **Stack** published by Ketchapp, rather than Stack Jump or unrelated games with similar names. The original product name appears here only as source attribution. No reference code, art, sound, logo, or music was copied.

## Verified original mechanics

These are qualitative observations supported by two independent accounts of playing the original. Source identifiers resolve to full URLs in SOURCES.md.

| Finding                                                                                                                | Independent evidence | PartyBox implication                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| A moving block crosses the previous block; one screen tap places it. Each successful placement adds a floor.           | S1 and S2            | One large DROP control; judge timing, never finger position.                                                  |
| Misalignment removes the overhang and leaves a smaller footprint for later blocks. A complete miss ends the attempt.   | S1 and S3            | Show the surviving overlap and falling cut clearly. Preserve the shrinking-footprint risk.                    |
| Perfect alignment produces bright outline/square feedback; consecutive perfect placements can recover lost block area. | S1 and S2            | Make PERFECT and regained width visible with text, outline, and shape.                                        |
| Height is the central goal, and the displayed stack count communicates progress.                                       | S2 and S4            | Floors must dominate the scoreboard. The job's 45-second limit decides the final height.                      |
| The feel depends on repeated timing and maintaining a rhythm.                                                          | S1 and S3            | Start slowly enough to learn the crossing; avoid long pauses between placements.                              |
| Successful alignment changes the musical feedback; a perfect fit has a chime-like cue.                                 | S1 and S3            | Use only original synthesized or platform-provided feedback. Visual feedback must remain complete when muted. |

S2 is a first-person review that describes spontaneous competition among three friends over the same phone. This is evidence that comparing tower heights can prompt conversation; it does not establish the rules or pacing for an eight-player simultaneous race.

## Perfect tolerance: what is and is not known

The original's exact numerical snap tolerance was **not verified**. S1 and S2 describe alignment rewards and eventual regrowth, but do not publish a distance threshold or an exact perfect-streak count. S4 is the publisher's current store listing and does not document either parameter. Consequently, this port must not claim that a chosen percentage, pixel count, streak length, growth amount, or speed curve reproduces the original exactly.

The search also found later browser variants whose own documentation uses different thresholds and streak lengths. Those are different products and cannot establish the original's constants. They were excluded from the original-facts table. A single new guide claiming a numerical original tolerance would not satisfy the two-source rule either.

For Skyline Stack, use a clearly documented tolerance in normalized game units, bounded so that a narrow tower still has a meaningful accuracy challenge. Snap qualifying placements to the previous center instead of accumulating tiny numerical drift. Test just inside, exactly at, and just outside the threshold. The amount and timing of regrowth are PartyBox tuning choices. Regrowth must never exceed the starting footprint or silently move the supporting center.

## Public-client inspection

Read the public source of the independent browser recreation `zurkon/playstack`: its README, `App.jsx`, `components/CanvasContainer.jsx`, `components/Instructions.jsx`, `lib/game.js`, and `lib/stack.js` (S5). This was source inspection only; none of its implementation or assets was copied.

Its placement logic compares the moving and previous block along the active axis, preserves positive overlap, and alternates axes for successive floors. Its inspected code has no perfect snap or regrowth branch. It therefore confirms an understandable geometric model for a recreation, while demonstrating why clone constants cannot be treated as original specifications. Its frame-based motion and mutable rendering are unsuitable for PartyBox's pure server contract.

The published playable URL `https://zurkon.github.io/playstack/` could not be opened by the web tool. The GitHub source directory page and GitHub API requests also failed through that tool; raw source URLs were reachable. No browser was launched for this delegated research task. The native original was not directly played in this environment, so no frame timings, measured original tolerance, or exact sound frequencies are asserted.

## Skyline Stack adaptation choices

The following choices come from P16 and the PartyBox contract, not from claims about the original:

- Two to eight players build independent towers simultaneously for 45 seconds. The TV shows every tower, player name, floors, and a shared readable clock.
- Phones provide one large drop button and immediate placement feedback. Phone-only rooms include the player's timing stage and score; spectators receive a stage without action controls.
- Highest floors wins. Any tie-breakers, scoring points, restart policy, bot accuracy, and round structure belong in the game spec as explicit port choices.
- Perfect placements restore footprint according to the chosen rule. Misses must have an immediate explanation and a clear continuation or finished state; the room cannot wait on a disconnected player.
- Use server event time and seeded state for all gameplay. The same timestamp must produce the same position on TV and phone, and drop inputs must not grant a player control over authoritative time.
- Keep the edge and center cues readable independently of palette. S1 reports that some original backgrounds made alignment harder to see; this port should use stable high contrast and visible outlines.

## Feel to preserve and improve

The essential satisfying beat is: watch the crossing, tap, see an exact floor or a visible cut, then immediately receive the next timing challenge. A near miss should visibly cost width, while a perfect should visibly win some back. Height competition should remain understandable without explaining a separate points economy. Avoid rewarding blind rapid tapping, allowing duplicate drop inputs to place multiple floors, or changing movement during an unannounced regrowth animation.

The source research leaves numerical tuning open. Record the implemented tolerance, regrowth, motion curve, and any departures in ASSUMPTIONS.md and the game README, then measure them with the game's simulations and human-readable captures.
