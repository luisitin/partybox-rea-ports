// No runtime I/O: this authored vocabulary is a bundled, validated constant.
import { shuffle } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import raw from '../content/words.json' with { type: 'json' };
import { wordsSchema } from '../content/schema';
import type { Word } from '../content/schema';

export const WORDS = wordsSchema.parse(raw);
export function choicesFor(rng: RngState, difficulty: string, used: string[]): [Word[], RngState] {
  const pool = WORDS.filter((word) => difficulty === 'mixed' || word.difficulty === difficulty);
  const unseen = pool.filter((word) => !used.includes(word.id));
  const [deck, next] = shuffle(rng, unseen.length >= 3 ? unseen : pool);
  return [deck.slice(0, 3), next];
}
