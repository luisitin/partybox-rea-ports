// The public English dictionary is fixed; only the three drawn solutions are secret.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import words from '../content/words.json' with { type: 'json' };
import { ROUNDS } from './types';

export const ANSWERS: readonly string[] = words.answers;
export const ACCEPTED: readonly string[] = words.accepted;
export const LANG = words.lang as 'en';

export function drawAnswers(rng: RngState): [string[], RngState] {
  const pool = [...ANSWERS];
  const answers: string[] = [];
  let next = rng;
  for (let i = 0; i < ROUNDS; i++) {
    const [index, advanced] = nextInt(next, 0, pool.length - 1);
    answers.push(pool.splice(index, 1)[0] as string);
    next = advanced;
  }
  return [answers, next];
}
