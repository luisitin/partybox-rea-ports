// A local hand-selected dictionary: no runtime lookup, and every answer is a legal guess.
import { z } from '@partybox/game-sdk';

const word = z.string().regex(/^[a-z]{5}$/);
const wordsSchema = z
  .object({
    lang: z.literal('en'),
    answers: z.array(word).min(120),
    accepted: z.array(word).min(120),
  })
  .superRefine((pack, ctx) => {
    for (const key of ['answers', 'accepted'] as const) {
      if (new Set(pack[key]).size !== pack[key].length)
        ctx.addIssue({ code: 'custom', path: [key], message: 'Words must be unique.' });
    }
    const accepted = new Set(pack.accepted);
    if (pack.answers.some((answer) => !accepted.has(answer)))
      ctx.addIssue({
        code: 'custom',
        path: ['answers'],
        message: 'Every answer must be accepted.',
      });
  });

export const packs = { words: wordsSchema } as const;
