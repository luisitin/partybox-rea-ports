import type { GameShared } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';

export const shared: GameShared = {
  id: 'quiz-rush',
  strings: STRINGS,
  sounds: { reveal: 'reveal', score: 'score', podium: 'silence', done: 'win' },
  beds: { question: 'pulse', reveal: 'latenight', score: 'warm', podium: 'latenight' },
};
