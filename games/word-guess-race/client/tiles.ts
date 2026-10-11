// Symbols duplicate the colour feedback, including for the letterless public grids.
import type { Guess, Mark, PublicGrid } from '../server/types';

export const MARK_SYMBOL: Record<Mark, string> = { correct: '✓', present: '↔', absent: '×' };
export const MARK_LABEL: Record<Mark, string> = {
  correct: 'right place',
  present: 'move it',
  absent: 'no match here',
};

/** A later repeated letter cannot erase an earlier stronger keyboard clue. */
export function keyboardMarks(guesses: Guess[]): Record<string, Mark> {
  const weight = { absent: 1, present: 2, correct: 3 };
  const marks: Record<string, Mark> = {};
  for (const guess of guesses) {
    for (let i = 0; i < guess.word.length; i++) {
      const letter = guess.word[i]!;
      const mark = guess.marks[i]!;
      if (!marks[letter] || weight[mark] > weight[marks[letter]!]) marks[letter] = mark;
    }
  }
  return marks;
}

export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function solveTime(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

export function roundWinnerIds(view: {
  grids: PublicGrid[];
  lastPoints: Record<string, number>;
}): string[] {
  const solved = view.grids.filter((grid) => grid.solved);
  const best = Math.max(0, ...solved.map((grid) => view.lastPoints[grid.id] ?? 0));
  return solved.filter((grid) => view.lastPoints[grid.id] === best).map((grid) => grid.id);
}
