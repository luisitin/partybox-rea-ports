# KEEP GOING

Started after PR #2 passed CI run 38176682177 and left draft.

1. Five weaknesses: departed-seat reconnect controls; phone-only locked-answer waiting cue; animated-film-heavy movie pool; bot reaction realism; replay overlap within the required twenty-question packs. Fixed the worst: answers and retries now require a connected active roster seat, with explicit watching/disconnect text. Measured gain: enabled pads for left/reconnected-left/disconnected seats fell from 4 to 0; active seats retain 4; all 51 SSR assertions pass. No server, scoring or visual fixture changes.

2. Five weaknesses: unclear stage-phone wait after locking an answer; movie concentration; bot/human reaction gap; repeat-pack overlap; blank unused podium slots in small rooms. Fixed the worst: locked phone-only/remote screens show connected answer progress using existing public roster statuses. Measured gain: a lone answer now shows 1/8 answered, and a drop plus permanent leave correctly changes it to 1/6; no additional controls or spoilers; all 53 SSR assertions pass. TV-room phones retain their simple lock cue.
