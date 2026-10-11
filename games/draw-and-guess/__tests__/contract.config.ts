import type { State } from '../server/types';

// Short words can occur in public envelope keys (for example "art" in startedAt).
// The game tests additionally compare exact leaf values for every secret word.
const secretTexts = (state: State): string[] =>
  [state.word?.text, ...state.choices.map((word) => word.text)].filter(
    (text): text is string => text !== undefined && text.length >= 6,
  );

export const contractConfig = {
  settingsVariants: [
    { rounds: 1, seconds: 45, difficulty: 'easy' },
    { rounds: 2, seconds: 75, difficulty: 'hard' },
    { rounds: 1, seconds: 60, difficulty: 'medium' },
  ],
  hiddenFromTv: (base: unknown): string[] => {
    const state = base as State;
    return ['choose', 'draw'].includes(state.phase.id) ? secretTexts(state) : [];
  },
  hiddenFromController: (base: unknown, playerId: string): string[] => {
    const state = base as State;
    return ['choose', 'draw'].includes(state.phase.id) && playerId !== state.drawerId
      ? secretTexts(state)
      : [];
  },
};
