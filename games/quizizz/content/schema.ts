import { z } from '@partybox/game-sdk';

const idSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionSchema = z.string().trim().min(1).max(40);

export const questionSchema = z
  .object({
    id: idSchema,
    prompt: z.string().trim().min(1).max(100),
    options: z.tuple([optionSchema, optionSchema, optionSchema, optionSchema]),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(1).max(150),
  })
  .strict()
  .refine(
    (question) => new Set(question.options.map((option) => option.toLowerCase())).size === 4,
    {
      message: 'A question needs four distinct options.',
      path: ['options'],
    },
  );

export const questionPackSchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1).max(40),
    lang: z.literal('en'),
    questions: z.array(questionSchema).length(20),
  })
  .strict()
  .refine(
    (pack) => new Set(pack.questions.map((question) => question.id)).size === pack.questions.length,
    {
      message: 'Question IDs must be unique within a pack.',
      path: ['questions'],
    },
  );

export type Question = z.infer<typeof questionSchema>;
export type QuestionPack = z.infer<typeof questionPackSchema>;

export const generalPackSchema = questionPackSchema.refine((pack) => pack.id === 'general');
export const moviesPackSchema = questionPackSchema.refine((pack) => pack.id === 'movies');
export const sciencePackSchema = questionPackSchema.refine((pack) => pack.id === 'science');

export const packs = {
  general: generalPackSchema,
  movies: moviesPackSchema,
  science: sciencePackSchema,
} as const;
