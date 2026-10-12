// The sixty original P01 questions are separate from the bilingual wager libraries.
import { z } from '@partybox/game-sdk';

export const CLASSIC_PACK_IDS = ['general', 'movies', 'science'] as const;
export type ClassicPackId = (typeof CLASSIC_PACK_IDS)[number];
const id = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const option = z.string().trim().min(1).max(42);

export const classicQuestionSchema = z
  .object({
    id,
    prompt: z.string().trim().min(1).max(110),
    options: z.tuple([option, option, option, option]),
    correct: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(1).max(120),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict()
  .refine((q) => new Set(q.options.map((s) => s.toLowerCase())).size === 4, {
    message: 'Each question needs four distinct options',
  });

export const classicPackSchema = z
  .object({
    id: z.enum(CLASSIC_PACK_IDS),
    name: z.string().trim().min(1).max(48),
    lang: z.literal('en'),
    questions: z.array(classicQuestionSchema).length(20),
  })
  .strict()
  .refine((p) => new Set(p.questions.map((q) => q.id)).size === 20, {
    message: 'Each classic pack needs twenty distinct question ids',
  });

// Public learned facts are answer text, never a private option index.
export const classicKnowledgeSchema = z.record(id, option);
export type ClassicPack = z.infer<typeof classicPackSchema>;
