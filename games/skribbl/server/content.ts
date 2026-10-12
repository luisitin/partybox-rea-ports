// Original vocabulary. Bot artists use the subset for which we drew original pictograms.
import easyJson from '../content/easy.json' with { type: 'json' };
import mediumJson from '../content/medium.json' with { type: 'json' };
import hardJson from '../content/hard.json' with { type: 'json' };
import { wordPackSchema } from '../content/schema';
export const DECKS: Record<string, readonly string[]> = {
  easy: wordPackSchema.parse(easyJson),
  medium: wordPackSchema.parse(mediumJson),
  hard: wordPackSchema.parse(hardJson),
};
export const WORDS = Object.values(DECKS).flat();
export function vocabulary(difficulty: string): readonly string[] {
  return DECKS[difficulty] ?? WORDS;
}
