// Original drawable vocabulary, validated before it enters a seeded deck.
import { z } from '@partybox/game-sdk';

export const wordSchema = z.object({
  id: z.string().min(1),
  text: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z]+(?: [a-z]+)*$/),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
});
export type Word = z.infer<typeof wordSchema>;
export const wordsSchema = z
  .array(wordSchema)
  .length(300)
  .superRefine((words, ctx) => {
    if (new Set(words.map((word) => word.text)).size !== words.length)
      ctx.addIssue({ code: 'custom', message: 'Words must be unique' });
    if (new Set(words.map((word) => word.id)).size !== words.length)
      ctx.addIssue({ code: 'custom', message: 'Ids must be unique' });
    for (const difficulty of ['easy', 'medium', 'hard'])
      if (words.filter((word) => word.difficulty === difficulty).length !== 100)
        ctx.addIssue({ code: 'custom', message: `Need 100 ${difficulty} words` });
  });
export const packs = { words: wordsSchema };
