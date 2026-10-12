// Secret numeric keys are omitted, not replaced by a guessable sentinel. Own selected answer is public to its phone.
import type { GameStateBase } from '@partybox/game-sdk';
import type { State } from '../server/types';

const secrets = (s: GameStateBase): string[] =>
  s.phase.id === 'question' || s.phase.id === 'talk'
    ? ['correctChoice', 'explanation', 'elapsed', 'verdicts']
    : [];
export const contractConfig = {
  hiddenFromTv: secrets,
  hiddenFromController: (s: GameStateBase, _viewer: string): string[] => secrets(s),
  settingsVariants: [
    { pack: 'movies', rounds: 5, seconds: 10 },
    { pack: 'science', rounds: 20, seconds: 30 },
    { mode: 'teams', teamCount: 4, talkSeconds: 20, pack: 'sports', rounds: 20 },
    { mode: 'tv-vote', talkSeconds: 5, pack: 'music', rounds: 5 },
  ],
  lastScores: 'podium',
};

// A compile-time assertion that config deals with this game's real state.
export type ContractState = State;
