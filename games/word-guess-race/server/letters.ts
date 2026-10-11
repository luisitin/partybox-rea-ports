// Duplicate letters consume solution occurrences once, after all exact positions are reserved.
import { normalize } from '@partybox/game-sdk/match';
import { LANG } from './content';
import type { Mark } from './types';

export function canonicalWord(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^[a-zA-Z]{5}$/.test(trimmed)) return null;
  const norm = normalize(trimmed, LANG).norm;
  // A letter puzzle preserves THREE / SEVEN / FORTY: the general matcher turns those into digits.
  return /^[a-z]{5}$/.test(norm) ? norm : trimmed.toLowerCase();
}

export function feedback(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array.from({ length: 5 }, () => 'absent');
  const remaining: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    const letter = answer[i] as string;
    if (guess[i] === letter) marks[i] = 'correct';
    else remaining[letter] = (remaining[letter] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (marks[i] === 'correct') continue;
    const letter = guess[i] as string;
    if ((remaining[letter] ?? 0) > 0) {
      marks[i] = 'present';
      remaining[letter] = (remaining[letter] ?? 0) - 1;
    }
  }
  return marks;
}
