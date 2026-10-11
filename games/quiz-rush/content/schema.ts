import { z } from '@partybox/game-sdk';

const idSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionSchema = z.string().trim().min(1).max(42);

export const questionSchema = z
  .object({
    id: idSchema,
    prompt: z.string().trim().min(1).max(110),
    options: z.tuple([optionSchema, optionSchema, optionSchema, optionSchema]),
    correct: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(1).max(120),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict()
  .refine(
    (question) => new Set(question.options.map((option) => option.toLowerCase())).size === 4,
    { message: 'Each question needs four distinct options', path: ['options'] },
  );

export type Question = z.infer<typeof questionSchema>;

export const packSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(48),
    lang: z.literal('en'),
    questions: z.array(questionSchema).min(1).max(200),
  })
  .strict()
  .refine(
    (pack) => new Set(pack.questions.map((question) => question.id)).size === pack.questions.length,
    {
      message: 'Question IDs must be unique within a pack',
      path: ['questions'],
    },
  );

export type Pack = z.infer<typeof packSchema>;

// Bot facts use answer text, never an option index: the server shuffles answer positions.
export const knowledgeSchema = z.record(idSchema, optionSchema);

export const packs = {
  general: packSchema,
  movies: packSchema,
  science: packSchema,
  knowledge: knowledgeSchema,
} as const;
