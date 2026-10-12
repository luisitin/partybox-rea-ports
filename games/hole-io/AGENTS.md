# Hole Swallow

- Read README.md before changing mechanics; keep the growth and respawn rules accurate.
- Server is pure; physics uses a fixed 100 ms grid and event.now only.
- One file per phase, fixtures for play/reveal/done. Regenerate with the job's fixtures script.
- Public city and scores; omit RNG, spatial index and steering from stage views.
- Test only this game: pnpm vitest run games/hole-swallow --maxWorkers=1.
- Verification tools and resume notes live in jobs/P08-hole-swallow/.
