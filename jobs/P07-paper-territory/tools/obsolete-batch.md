# Superseded simulation batch

The first property/simulation batch used 200 ms bot decisions and an earlier
server revision. Its property traces completed (regression seeds 1, 2, and 3,
plus 1,000 generated seeds) and its two-player simulation completed 1,000 games.
The four- and eight-player simulations did not finish. The task-owned process
tree was interrupted after more than ten minutes on 2026-10-11 to use the final
600 ms bot cadence and final source. This incomplete run is not counted as final
verification. `property-sim.log` preserves the original output.

Final evidence is recorded separately in the mutation and final verification
logs and JSON files. `PB_SIM_GAMES` changes the sample count only for performance
benchmarks; the required final command leaves it unset and runs 1,000 games at
each of 2, 4, and 8 players.
