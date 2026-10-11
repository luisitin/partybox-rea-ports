# Seeded bot simulation

Command: `pnpm tsx jobs/P13-dino-dash/simulate.ts --seeds 20`.

Seeds 1–20, default 3 rounds, 100ms reactions, 8 minute simulated budget.
Every sampled input passed the real input schema; every match returned complete finite results.

| Players | Strength | Terminal | Median round (s) | Median match (s) | Maximum match (s) |
| ------- | -------- | -------- | ---------------- | ---------------- | ----------------- |
| 2       | easy     | 20/20    | 10.18            | 54.05            | 76.7              |
| 2       | normal   | 20/20    | 60               | 190              | 193.5             |
| 2       | sharp    | 20/20    | 60               | 193.5            | 193.5             |
| 4       | easy     | 20/20    | 14.6             | 66.9             | 104.6             |
| 4       | normal   | 20/20    | 60               | 193.5            | 193.5             |
| 4       | sharp    | 20/20    | 60               | 193.5            | 193.5             |
| 8       | easy     | 20/20    | 21.49            | 83.8             | 111.3             |
| 8       | normal   | 20/20    | 60               | 193.5            | 193.5             |
| 8       | sharp    | 20/20    | 60               | 193.5            | 193.5             |
| 3       | easy     | 20/20    | 11.9             | 59.35            | 76.7              |
| 3       | normal   | 20/20    | 60               | 193.5            | 193.5             |
| 3       | sharp    | 20/20    | 60               | 193.5            | 193.5             |
| 5       | easy     | 20/20    | 16.5             | 73.35            | 104.6             |
| 5       | normal   | 20/20    | 60               | 193.5            | 193.5             |
| 5       | sharp    | 20/20    | 60               | 193.5            | 193.5             |
| 6       | easy     | 20/20    | 19.6             | 80.9             | 107.9             |
| 6       | normal   | 20/20    | 60               | 193.5            | 193.5             |
| 6       | sharp    | 20/20    | 60               | 193.5            | 193.5             |
| 7       | easy     | 20/20    | 21.07            | 83.45            | 107.9             |
| 7       | normal   | 20/20    | 60               | 193.5            | 193.5             |
| 7       | sharp    | 20/20    | 60               | 193.5            | 193.5             |

Server source SHA-256: `ef15c911d163bfbdf3562516896a7099ad8ecb05b40d01f27c6ad291a76eb8a1`.
Results SHA-256: `4c490e6c46e859abcfc97ee9a35d52eab523ceab4288ffdb6b53c4002a0f7b5e`.
Per-cohort replay hashes are in simulation-results.json; rerunning unchanged code reproduces them.
