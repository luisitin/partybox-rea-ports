# KEEP GOING

Starts after the pull request is green. Each round lists the five largest player
weaknesses, fixes the worst demonstrated defect and records the measured gain.
Three consecutive rounds without a player-visible gain complete the loop.

- R1: five biggest weaknesses were repeated between-round reading, departed-seat tank0, misleading Burst capacity, disabled Fire contrast and mismatched crate symbols. Removed repeated READY rosters/legend/instructions and replaced SCORE with public winner plus own rank/gain receipt; full final standings retained. Actual SDK floors: READY25760→8444 ms, SCORE28357→9742 ms (short names); total waiting244825→82486 ms, -66.3%. Two-word-name waiting275992→84651 ms, -69.3%. 98 focused lifecycle/physics/SDK/SSR tests passed (68.21 s), including actual rendered-word floors; 1000 eight-seat matches passed (161.28 s), median match300222.5→137768 ms, longest177286 ms; all40 screens fit. Browser91536 closed in finally. Player-visible gain: about2.7 minutes less waiting per five-round match.
