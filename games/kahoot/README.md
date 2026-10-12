# Kahoot!

## Overview

P01's original quiz engine now supports individual play, fixed teams and one cooperative room
answer elected by phone votes. The TV is a read-only stage; phones supply every response.
The workshop name/id follows the owner's table. Core integration upgrades the existing
Lightning Round card with opt-in teams/vote and preserves its injected classic default.

## Players

2–8; teams use 2–4 balanced seeded groups, limited to the roster. Groups remain fixed after a drop.
Room vote uses one group. Spectators watch without controls. Three bot strengths use authored
answer-text facts, public options and seeded confidence; they never inspect the shuffled key.

## Phases

| Phase    | TV                                                              | Phone with TV                                           | Exit                                                                 |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| talk     | Question/options, teams and discussion clock                    | Own group/members, question/options; no answer buttons  | Reading-aware discussion deadline or VIP skip                        |
| question | Question/options, answer/vote count, clock                      | Four shape pads; group identity; immutable confirmation | All eligible seats answered, no eligible seats, deadline or VIP skip |
| reveal   | Correct shape, answer chart and explanation; elected room shape | Personal/team receipt, or collective verdict            | At least4.5s and SDK reading floor, or VIP skip                      |
| score    | Individual/team standings and gains                             | Points, rank and next-question cue                      | At least3.5s and reading floor, or VIP skip                          |
| podium   | Third/second/first occupied rank tiers, including ties          | Revealed stage tiers; unrevealed rank withheld          | At least2.5s per tier and reading floor, or VIP skip                 |
| done     | Complete standings                                              | Final individual/team result                            | Terminal                                                             |

Solo starts at question. New modes start each round at talk; discussion is excluded from speed
elapsed time. All phases advance automatically. Final reveal goes to podium; empty tiers skip.
VIP end preserves credited points and never scores an unfinished question.

### Phone only

`usePhoneOnly`, the server presence flag, remote seats and spectators enable stage information.
Talk always shows the question/options. In question, stage phones show text on each shape pad;
spectators get a read-only list. Reveal shows the chart/explanation plus the player's receipt.
Score/podium/done show compact group or individual standings. Nothing directs these rooms to a TV.

## Inputs

`{type:'answer',round:1..20,choice:0..3}`. The first valid answer/vote is immutable; retries can
resend that choice. Stranger, spectator, departed, disconnected, stale, duplicate, early,
paused and out-of-phase inputs are ignored. A tap at/after the deadline is too late.

## Scoring

Solo/personal correct answers earn `round(1000*(1-clamp(elapsed/answerMs,0,1)/2))` (500–1000).
Consecutive correct answers add `min(500,100*(streak-1))`; wrong/missing resets the streak.
This inherited bonus is a PartyBox adaptation; current Kahoot has no streak points.

Teams earn the rounded mean of members' personal question points. Unanswered connected members
contribute zero; unanswered offline/departed members are excluded, while accepted departures
still contribute. Larger teams gain no raw-sum advantage. All members share the accumulated
team score/rank; personal verdict/streak remain visible. Team membership never reshuffles.

Room vote chooses the plurality among accepted votes; seeded randomness breaks tied pluralities.
No votes gives zero. A correct collective choice uses the mean submitted response time and the
shared streak bonus; everybody shares the outcome. This is an original scored adaptation,
separate from native unscored polls. All credits happen once at reveal. Equal totals share rank;
results include every starter and all tied winning team members.

## Edge cases

- Refresh restores accepted choices, current groups, points and phase. Personal cues do not replay.
- Disconnects never make the room wait; answered departures keep earned contributions.
- Pause holds input/timers; resume shifts discussion and answer clocks. Stale timers do nothing.
- Before reveal, no key, explanation, other person's choice, vote chart or decision is public.
- Unrevealed final placements remain withheld; done ignores all inputs and timers.
- Phone play fits390×844; original shape marks distinguish choices without colour alone.
  Motion uses SDK tokens and respects reduced motion. No runtime network/file calls or new deps.

## Settings

| Key         | Default | Options                                         |
| ----------- | ------- | ----------------------------------------------- |
| mode        | solo    | solo, teams, tv-vote                            |
| pack        | general | general, movies, science, sports, music, custom |
| rounds      | 10      | 5–20, capped by pack length                     |
| seconds     | 20      | Minimum answer window10–30                      |
| teamCount   | 2       | 2–4, capped by roster; teams only               |
| talkSeconds | 5       | Minimum discussion5–20; new modes only          |

Timed screens reserve SDK reading/settling time. The15-minute estimate includes discussion.

## Content

Five original20-question packs; sports/music add40paired-source facts and separate bot knowledge.
The custom sample contains five P01 general questions. A strict UTF-8 text format and CLI validate
before writing content/custom.json. Rebuild/restart and select Custom; no code edits are needed.
Unknown custom facts use seeded guesses. See [PACK_FORMAT.md](../../jobs/P02-quiz-rush-teams/PACK_FORMAT.md).

## Sources

[P02 research](../../jobs/P02-quiz-rush-teams/RESEARCH.md), [paired mechanics](../../jobs/P02-quiz-rush-teams/SOURCES.md),
[new fact pairs](../../jobs/P02-quiz-rush-teams/CONTENT_SOURCES.md), and P01's retained source ledger.
Original interactive team play was unavailable; published guides/screenshots corroborate the flow.
Artwork is original public-workshop SVG/CSS; no third-party assets/questions/audio are copied.
[UPGRADE.md](../../jobs/P02-quiz-rush-teams/UPGRADE.md) records the unperformed core installation handoff.
