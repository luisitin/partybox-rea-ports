// Public letter pattern, shared by views and the honest vocabulary-filtering bot.
import type { State } from './types';

export function publicMask(state: State): string {
  if (!state.word) return '';
  const visible = new Set(state.hintIndices.slice(0, state.hintLevel));
  return [...state.word.text]
    .map((letter, i) => (letter === ' ' || visible.has(i) ? letter : '_'))
    .join('');
}
