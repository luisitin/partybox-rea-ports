import type { GameStateBase } from '@partybox/game-sdk';
import type { State } from '../server/types';

const hidden = (s: State): string[] =>
  s.phase.id === 'choose' || s.phase.id === 'draw' ? [...s.choices, s.word].filter(Boolean) : [];

export const contractConfig = {
  settingsVariants: [
    { laps: 1, drawSeconds: 30, difficulty: 'easy' },
    { laps: 2, drawSeconds: 60, difficulty: 'hard' },
  ],
  hiddenFromTv: (s: GameStateBase): string[] => hidden(s as State),
  hiddenFromController: (s: GameStateBase, id: string): string[] =>
    (s as State).drawer === id ? [] : hidden(s as State),
  lastScores: 'reveal-last',
};
