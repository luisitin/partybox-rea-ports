// Future solutions and opponents' letter histories remain private even after a round is revealed.
import type { GameStateBase } from '@partybox/game-sdk';
import type { State } from '../server/types';

function hidden(state: State, viewer?: string): string[] {
  const publicWord = state.phase.id === 'guess' ? null : state.answers[state.round - 1];
  const mine = viewer && Object.hasOwn(state.entries, viewer) ? state.entries[viewer]!.guesses : [];
  // The shared contract scans keys too: these English words are unavoidable public metadata.
  const allowed = new Set([
    publicWord,
    'guess',
    'round',
    'ranks',
    'stage',
    'error',
    ...mine.map((guess) => guess.word),
  ]);
  return [
    ...new Set([
      ...state.answers,
      ...Object.entries(state.entries)
        .filter(([id]) => id !== viewer)
        .flatMap(([, entry]) => entry.guesses.map((guess) => guess.word)),
    ]),
  ].filter((word) => !allowed.has(word));
}

export const contractConfig = {
  settingsVariants: [{ roundSeconds: 60 }, { roundSeconds: 180 }],
  lastScores: 'reveal-last',
  hiddenFromTv: (state: GameStateBase): string[] => hidden(state as State),
  hiddenFromController: (state: GameStateBase, viewer: string): string[] =>
    hidden(state as State, viewer),
};
