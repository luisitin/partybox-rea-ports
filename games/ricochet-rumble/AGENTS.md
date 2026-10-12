# ricochet-rumble — local rules

- README.md is the spec; keep it true when mechanics change.
- Pure server, time only from events, randomness only from state.rng. One file per phase.
- Input controls latch until release or expiry. Player drops cancel controls; permanent leaves do not respawn.
- Shells can hurt their owner; simultaneous impacts and a locked survivor cannot depend on roster order.
- All combat information is public. Only omit the world for a playing phone with a visible TV.
- Phone-only, remote and spectator phones show the public stage; spectators have no controls.
- Colors, sizes and motion use --pb-* tokens; tank numbers and weapon letters supplement color.
- Use only SDK imports (React allowed in client), no new dependencies or runtime network requests.
- Run only this game's tests with one worker. Do not start a browser; root owns sequential static capture.
- Evidence belongs in jobs/P22-ricochet-rumble; regenerate fixtures after state changes.
