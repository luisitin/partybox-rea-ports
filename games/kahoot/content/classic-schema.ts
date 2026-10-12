// Authored classic packs stay separate from the bilingual wager libraries.
import { z } from '@partybox/game-sdk';

export const CLASSIC_PACK_IDS = [
  'general',
  'movies',
  'science',
  'sports',
  'music',
  'custom',
] as const;
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
    path: ['options'],
  });
export type ClassicQuestion = z.infer<typeof classicQuestionSchema>;

export const classicPackSchema = z
  .object({
    id: z.enum(CLASSIC_PACK_IDS),
    name: z.string().trim().min(1).max(48),
    lang: z.literal('en'),
    questions: z.array(classicQuestionSchema).min(5).max(20),
  })
  .strict()
  .refine((p) => p.id === 'custom' || p.questions.length === 20, {
    message: 'Each standard classic pack needs exactly twenty questions',
    path: ['questions'],
  })
  .refine((p) => p.id !== 'custom' || p.questions.every((q) => q.id.startsWith('custom-')), {
    message: 'Custom question IDs must start with custom- to avoid standard pack collisions',
    path: ['questions'],
  })
  .refine((p) => new Set(p.questions.map((q) => q.id)).size === p.questions.length, {
    message: 'Question IDs must be unique within a pack',
    path: ['questions'],
  });

// Public learned facts are answer text, never a private option index.
export const classicKnowledgeSchema = z.record(id, option);
export type ClassicPack = z.infer<typeof classicPackSchema>;
