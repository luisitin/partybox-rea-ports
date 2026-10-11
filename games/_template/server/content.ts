// Typed access to content/*.json. Content is imported statically (bundled, no I/O at runtime).
import { wordsPackSchema } from '../content/schema';
import type { WordsPack } from '../content/schema';
import wordsJson from '../content/words.json' with { type: 'json' };

// Parsed once at module load; a broken pack fails fast at import time (and in the contract suite).
export const WORDS: WordsPack = wordsPackSchema.parse(wordsJson);
