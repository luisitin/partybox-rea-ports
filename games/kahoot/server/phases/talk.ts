// Everybody discusses the public choices before an answer clock starts.
import { enterPhase, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { currentQuestion } from '../content';
import { modeOf } from '../teams';
import type { Input, State, Transition } from '../types';

export function enterTalk(state: State, now: number, round: number): State {
  const fresh: State = {
    ...state,
    round,
    answers: {},
    verdicts: {},
    teamGains: {},
    decision: null,
    previousScores: { ...state.scores },
  };
  const q = currentQuestion(fresh);
  // The TV shows every fixed team and member; phones show only their own group.
  // The UI reserve also covers round/clock, instructions and roster separators.
  // Room vote has no named roster on either surface.
  const rosterWords =
    modeOf(state) === 'teams'
      ? wordCount(
          state.teams
            .flatMap((team) => [
              team.name,
              ...team.members.map((id) => state.players[id]?.name ?? id),
            ])
            .join(' '),
        )
      : 0;
  const words = wordCount([q.prompt, ...q.options].join(' ')) + 22 + rosterWords;
  const ms = Math.max(state.settings.talkSeconds * 1000, readingMs(words, { ui: true }));
  return enterPhase(fresh, 'talk', now, ms);
}

export function reduceTalk(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
