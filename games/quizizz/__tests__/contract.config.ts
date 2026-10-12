import type { State } from '../server/types';

export const contractConfig = {
  settingsVariants: [
    { questions: 6, seconds: 60, powers: false },
    { pack: 'movies', questions: 20, seconds: 180 },
    { pack: 'science' },
  ],
  hiddenFromTv: (_state: State): string[] => [
    'correctIndex',
    'questionId',
    'explanation',
    'feedback',
    'deck',
  ],
  hiddenFromController: (_state: State, _id: string): string[] => [
    'correctIndex',
    'deck',
    'runners',
  ],
};
