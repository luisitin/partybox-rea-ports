# Hole.io

- Read README.md before changing mechanics; keep discrete growth, permanent elimination and banked scoring accurate.
- Server is pure; physics uses a fixed 100 ms grid and event.now only.
- One file per phase, fixtures for play/reveal/done. Regenerate with the job's fixtures script.
- Public city and scores; omit RNG, spatial index and steering from stage views.
- Test only this game: pnpm vitest run games/hole-io --maxWorkers=1.
- Verification tools and resume notes live in jobs/P08-hole-swallow/.
