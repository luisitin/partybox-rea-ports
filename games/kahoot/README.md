# Kahoot!

## Overview

A speed quiz upgrading the existing Lightning Round engine. Wager remains the default, including old saves without a mode. Classic plays original shape-pad questions; Teams adds discussion and averaged personal points; Room vote elects one shared answer. Joining, room codes and the opening countdown belong to the shell.

## Players

Wager/Classic: 1–16; Teams/Room vote: 2–8. Late joiners spectate. Disconnections never hold the room; reconnect restores accepted input and the current beat. Permanent leavers retain their score and fixed team but cannot answer again. Spectators see a read-only stage.
Bots have easy/normal/sharp strengths and seeded choices. Classic/group bots use a separate public answer-text knowledge map; unknown custom facts are guesses. Phones download no question library or answer keys.

## Phases

| Phase    | TV                                                                                 | Phone                                                                                    | Exit                                                                     |
| -------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| intro    | Title, selected pack; group identities                                             | First-question notice; own team or public stage                                          | Reading budget; Wager also has a 2 s floor                               |
| talk     | Groups only: question/options, team members and discussion clock                   | Own team and discussion cue; stage phones also show question/options; no answer controls | max(configured discussion, visible-text reading budget), or VIP skip     |
| question | Prompt/options, clock and accepted count                                           | One stamped shape answer or vote; Wager retains labelled choices                         | All connected answers after reading hold, original deadline, or VIP skip |
| reveal   | Chart/explanation then standings; final Classic/group chart withholds final totals | Personal contribution/team mean or shared room verdict; chart/standings on staged phones | Reading budgets, VIP Next/skip; last Classic/group → podium              |
| wager    | Wager only: final topic, placed count and standings; no private stakes             | Preset share/custom points and own receipt                                               | All bets after reading hold, max(15 s, reading budget), or VIP skip      |
| podium   | Classic/groups: occupied tiers descending 3 → 2 → 1                                | Public tiers; own group rank/total only when unveiled                                    | Tier reading budget or VIP skip; empty tiers skipped                     |
| done     | Complete standings and shell results                                               | Final group/individual board and personal place                                          | Terminal; results is non-null                                            |

Wager draws the requested regular count plus one hardest-available final. Non-wager modes draw the requested count, capped by the selected pack, without a wager finale. Equal scores share competition ranks. Reveals/podium own their roster; hidden future team totals are omitted from both envelopes and nested stage views.

### Phone-only and remote rooms

Room presence is captured at init; canSeeTv=false also supplies that player the stage. SDK PhoneOnlyProvider/usePhoneOnly preserve device context. Stage phones never point at a TV.

| Beat        | Phone-only/remote player                                                          | Spectator/departed player                   |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| intro/talk  | Public title/question/options, team membership and discussion; talk has no inputs | Same public stage without personal controls |
| question    | Prompt/options above shape pads; pending/confirmed receipt                        | Prompt/options and accepted count, no pads  |
| reveal      | Own contribution/shared verdict plus public chart/standings                       | Public chart/standings and explanation      |
| wager       | Topic/stakes controls; absent wager defaults to zero                              | Topic/rules/standings without stakes        |
| podium/done | Unveiled tiers, then complete board and own place                                 | Same public stage                           |

## Inputs

Wager answer: {type:'pick',index:0..3}. Classic/group answer: {type:'answer',questionId,questionStartedAt,index:0..3}; both stamps must match the open answer window. Discussion accepts no answers and publishes no stamp. Room votes use the same immutable packet.
Bet: {type:'wager',percent:0|25|50|75|100} or integer amount 0–1,000,000; amount wins, clamps to current score and rounds below-all-in stakes down to tens.
Only the first connected participant input at/after opening and strictly before the original deadline is accepted. Unknown/spectator/left/stale/duplicate packets are ignored. Sending can retry the same pending choice until authoritative confirmation; reconnect restores that choice.

## Scoring

Regular/Classic/group personal points: correct = 500 + rounded linear 500→0 speed bonus + min(300,100×(streak−1)). Wrong/missing gives zero and resets streak. Speed uses the actual answer window and excludes discussion/pause.
Teams are fixed and balanced from state.rng, 2–4 teams capped by roster. A question adds the rounded mean of eligible personal points to team score. Connected unanswered members count as zero; unanswered offline/left members leave the denominator; accepted departing answers remain. An entirely absent team gains zero. Each member's result score is the team total; team ranks do not depend on member count.
Room vote uses plurality of accepted votes, seeded ties independent of the answer key, mean time of all accepted votes and one shared streak. No votes means no decision/points and breaks that streak. Everyone shares the room gain. This cooperative scoring is a PartyBox adaptation of unscored native polls, with no invented win threshold.
Wager final: correct adds stake, wrong/missing subtracts it, never below zero; no regular points. This is the only score decrease. Reveal credits once; VIP end keeps already banked totals. Awards retain canonical speed/streak/wager rules; ties use lowest id. Recaps distinguish group gains/room decisions from personal choices.

## Edge cases

Every reducer is pure/total; time is event.now, randomness is state.rng. Stale timers and spectators cannot alter play. Missing mode in a saved state means legacy Wager; no new group state is inferred.
Reading time uses the SDK readingMs/wordCount floor and actual visible question, roster, instructions, verdict and podium copy. Discussion starts a fresh answer clock. An all-answered hold can shorten the phase to its reading floor while retaining the original speed deadline; an eligible reconnect restores its pending window.
Pause freezes inputs/timers/client clocks and shifts scoring clocks. VIP skip moves one current phase; missing inputs score zero. Idle/all-offline matches end with complete finite results. Dropping a phone never changes seeded membership.
Final Classic/group reveal withholds final standings and member score chips. Podium exposes only unveiled team tiers; unrevealed personal team total uses the prior banked score. Full totals return at done.
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
