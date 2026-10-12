# Kahoot!

## Overview

A speed quiz upgrading the existing Lightning Round engine. Wager remains the default, including old saves without a mode. Classic plays original shape-pad questions; Teams adds discussion and averaged personal points; Room vote elects one shared answer. Joining, room codes and the opening countdown belong to the shell.

## Players

Wager/Classic: 1–16; Teams/Room vote: 2–8. Late joiners spectate. Disconnections never hold the room; reconnect restores accepted input and the current beat. Permanent leavers retain their score and fixed team but cannot answer again. Spectators see a read-only stage.
Bots have easy/normal/sharp strengths and seeded choices. Classic/group bots use separate public answer-text facts; exact custom prompts can reuse independent standard facts, with narrow word/digit equivalence for count prompts. Unknown/edited/conflicting prompts and multiple equivalent choices remain guesses; owner keys/explanations never teach the bot. Phones download no question library or answer keys.

## Party format

An accepted answer locks until the shared question reaches its reveal. Early answerers wait and watch the live shared stage; they cannot change that answer or start an individual retry. A failed or missed question does not eliminate anyone from later questions; its scoring follows the selected mode. A permanently departed player who refreshes sees the live public stage as a spectator, including leaders/standings when revealed, and cannot answer again.

A trailing team can close a catchable gap with correct remaining answers, speed credit and the existing capped streak bonus while scoring questions remain. There is no score handicap or rubber-band bonus. When the lead exceeds the points still available, that team cannot win, but the remaining authored questions, shared discussion, guesses and reveals still give everyone something to play together. Room vote has no trailing rival: the whole room builds one shared score.

Everyone shares the discussion, answer and reveal phase clocks. A question ends for all at its authoritative deadline or once all connected eligible players have locked answers and the reading hold is satisfied; VIP skip advances the shared phase, and VIP end closes the match with already banked scores. A finite selected question count, capped by the group pack, bounds the match. Individuals never race ahead into another question.

The highest cumulative team points win. Equal totals share competition ranks and joint first-place winners; the team board names the teams and members, and occupied podium tiers reveal third → second → first, skipping empty tiers before complete final results. Room vote is one cooperative group whose final shared score is shown to everyone, with no rival or invented win threshold. Wager and individual Classic retain their existing scoring/results paths, including Wager’s final stake and Classic’s staged podium.

## Phases

| Phase    | TV                                                                                                                   | Phone                                                                                                       | Exit                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| intro    | Title, selected pack; group identities                                                                               | First-question notice; own team or public stage                                                             | Reading budget; Wager also has a 2 s floor                                   |
| talk     | Groups only: question/options, circular discussion clock and accepted count; no roster                               | Own roster beside TV; staged team phones toggle question/teammates; no answer controls                      | max(configured discussion, largest visible-pane reading budget), or VIP skip |
| question | Prompt/options, clock and accepted count                                                                             | One stamped shape answer or vote; Wager retains labelled choices                                            | All connected answers after reading hold, original deadline, or VIP skip     |
| reveal   | Classic chart/explanation then standings; groups: native chart → full explanation → standings; final totals withheld | Beside-TV receipt; compact personal/shared feedback below chart, explanation and standings on staged phones | Reading budgets, VIP Next/skip; last Classic/group → podium                  |
| wager    | Wager only: final topic, placed count and standings; no private stakes                                               | Preset share/custom points and own receipt                                                                  | All bets after reading hold, max(15 s, reading budget), or VIP skip          |
| podium   | Classic/groups: occupied tiers descending 3 → 2 → 1                                                                  | Public tiers; own group rank/total only when unveiled                                                       | Tier reading budget or VIP skip; empty tiers skipped                         |
| done     | Complete standings and shell results                                                                                 | Final group/individual board and personal place                                                             | Terminal; results is non-null                                                |

Wager draws the requested regular count plus one hardest-available final. Non-wager modes draw the requested count, capped by the selected pack, without a wager finale. Equal scores share competition ranks. Reveals/podium own their roster; hidden future team totals are omitted from both envelopes and nested stage views.

### Phone-only and remote rooms

Room presence is captured at init; canSeeTv=false also supplies that player the stage. SDK PhoneOnlyProvider/usePhoneOnly preserve device context. Stage phones never point at a TV. During team discussion, Teammates opens only the participating player’s own fixed roster and Back to question restores prompt/options. This local disclosure does not send a game input; timers, discussion rules and pause status remain visible. The native disclosure supplies both pointer and Enter keyboard operation, with one question or roster pane visible at a time; it sends no game input.

| Beat        | Phone-only/remote player                                                                             | Spectator/departed player                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| intro       | Public title and group identities                                                                    | Same public stage without personal controls                                                   |
| talk        | Public question/options; Teams has a native own-teammates disclosure that replaces the question pane | Public question/options with watching instructions; no teammate disclosure or answer controls |
| question    | Prompt/options above shape pads; pending/confirmed receipt                                           | Prompt/options and accepted count, no pads                                                    |
| reveal      | Native chart → full authored explanation → standings, with compact own contribution/shared verdict   | Same public chart → full explanation → standings, with no personal receipt                    |
| wager       | Topic/stakes controls; absent wager defaults to zero                                                 | Topic/rules/standings without stakes                                                          |
| podium/done | Unveiled tiers, then complete board and own place                                                    | Same public stage                                                                             |

## Inputs

Wager answer: {type:'pick',index:0..3}. Classic/group answer: {type:'answer',questionId,questionStartedAt,index:0..3}; both stamps must match the open answer window. Discussion accepts no answers and publishes no stamp; its native teammate disclosure changes only local presentation. Room votes use the same immutable packet.
Bet: {type:'wager',percent:0|25|50|75|100} or integer amount 0–1,000,000; amount wins, clamps to current score and rounds below-all-in stakes down to tens.
Only the first connected participant input at/after opening and strictly before the original deadline is accepted. Unknown/spectator/left/stale/duplicate packets are ignored. Sending can retry the same pending choice until authoritative confirmation; reconnect restores that choice.

## Scoring

Regular/Classic/group personal points: correct = 500 + rounded linear 500→0 speed bonus + min(300,100×(streak−1)). Wrong/missing gives zero and resets streak. Speed uses the actual answer window and excludes discussion/pause.
Teams are fixed and balanced from state.rng, 2–4 teams capped by roster. A question adds the rounded mean of eligible personal points to team score. Connected unanswered members count as zero; unanswered offline/left members leave the denominator; accepted departing answers remain. An entirely absent team gains zero. Each member's result score is the team total; team ranks do not depend on member count.
Room vote uses plurality of accepted votes, seeded ties independent of the answer key, mean time of all accepted votes and one shared streak. No votes means no decision/points and breaks that streak. Everyone shares the room gain. This cooperative scoring is a PartyBox adaptation of unscored native polls, with no invented win threshold.
Wager final: correct adds stake, wrong/missing subtracts it, never below zero; no regular points. This is the only score decrease. Reveal credits once; VIP end keeps already banked totals. Wager/Classic/Teams awards retain canonical speed/streak/wager rules; ties use lowest id. Cooperative Room vote publishes no individual awards. Recaps distinguish group gains/room decisions from personal choices.

## Edge cases

Discussion shows Away for publicly disconnected teammates and Left for permanent departures, including a later connected reconnect. The optional teams-only leftMembers metadata contains only members of currently public group rows; hidden final/future podium teams publish none. A missing public player row is Unavailable. Spectators/departed phones receive watching instructions and no own-roster disclosure. Fixed membership preserves PartyBox presence/reconnect continuity; this does not claim native automatic rebalancing.

Every reducer is pure/total; time is event.now, randomness is state.rng. Stale timers and spectators cannot alter play. Missing mode in a saved state means legacy Wager; no new group state is inferred.
Reading time uses the SDK readingMs/wordCount floor for question, roster, instructions, verdict and podium copy; the host strip conservatively budgets full names despite its visual ellipsis. Group chart, explanation and standings cuts are frozen when scoring occurs, so presence changes cannot move them. The full authored explanation is a separate synchronized PartyBox reading beat. The final group VIP window uses the larger of the Show podium label or the longest visible player name plus its three-word hint. Discussion starts a fresh answer clock. An all-answered hold can shorten the phase to its reading floor while retaining the original speed deadline; an eligible reconnect restores its pending window.
Pause freezes inputs/timers/client clocks and shifts scoring clocks. VIP skip moves one current phase; missing inputs score zero. Idle/all-offline matches end with complete finite results. Dropping a phone never changes seeded membership.
Final Classic/group reveal withholds final standings and member score chips. Final Room vote outcome delta is zero and has no base/bonus score fields; the phone still receives the ordinary shared verdict and own vote. Podium exposes only unveiled team tiers; unrevealed personal team total uses the prior banked score. Full totals return at done.
Token colours are paired with original SVG shapes, team names and text. Motion follows SDK tokens and both reduced-motion controls. Shell countdown/reveal/wager/result cues and beds respect device settings.

## Settings

quizMode: wager(default), classic, teams, tv-vote. classicPack: general(default), movies, science, sports, music, custom. teamCount: 2–4(default2); talkSeconds:5–20 step5(default5), both group-only.
questions:5–20(default10); answerSeconds:5–30 step5(default15, a minimum). Wager category/topics retain canonical filtering/fallback and EN/ES selection. Authored-pack modes use English independently of host contentLang.
Inherited minigame metadata explicitly selects Wager with four regular questions and a five-second minimum. Groups advertise no new minigame. Estimate is 26 minutes; simulations verify every group's default match against twice that bound.

## Content

Five original English standard packs have exactly20questions each. Custom contains5–20; requesting more draws its unique available questions. Strict schema requires four distinct options, bounded prompt/explanation/difficulty and unique IDs. Custom IDs must start custom- and stay within48characters including prefix, so owner facts cannot overwrite a bundled question.
The job's UTF-8 text compiler validates and writes content/classic-custom.json before bundling; rebuild/restart and select Custom. No runtime file/network calls or content-slot API.
Wager retains 6,153 English questions, 5,561 Spanish items and704 documented dropped English IDs, with source/provenance rules unchanged. Fixtures include every phase and group variants.

## Sources

[P01 research](../../jobs/P01-quiz-rush/RESEARCH.md) and [P02 research](../../jobs/P02-quiz-rush-teams/RESEARCH.md) pair official mechanics guides with independent accounts. [P02 sources](../../jobs/P02-quiz-rush-teams/SOURCES.md) and its question-ID fact ledger document the additions. No original art/audio/questions are copied.
The owner's existing Lightning Round already ships wager-team scoring (T-1146) without discussion/room vote/donor packs. [UPGRADE.md](../../jobs/P02-quiz-rush-teams/UPGRADE.md) records that overlap and the unperformed owner-core migration. This public module extends the frozen canonical P01 baseline.
