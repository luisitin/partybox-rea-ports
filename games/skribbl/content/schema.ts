// Each original deck has exactly one hundred unique, family-friendly prompts.
import { z } from '@partybox/game-sdk';
export const wordPackSchema = z
  .array(
    z
      .string()
      .min(2)
      .max(24)
      .regex(/^[a-z]+(?: [a-z]+)*$/),
  )
  .length(100)
  .refine((words) => new Set(words).size === words.length, 'Duplicate word');
export const packs = { easy: wordPackSchema, medium: wordPackSchema, hard: wordPackSchema };
