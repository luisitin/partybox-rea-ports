// Content pack schema for Lightning Round. `packs` maps content/<name>.json → its zod schema; the
// contract suite validates every pack with it and server/content.ts parses it at import time.
import { z } from '@partybox/game-sdk';

/** Every category in the pack, in the order the settings `select` lists them. */
export const CATEGORIES = [
  'geography',
  'stem',
  'history',
  'arts-and-literature',
  'sports',
  'food-and-drink',
  'nature',
  'language',
  'entertainment',
  'everyday-life',
  'board-and-card-games',
  'world-heritage',
  'museum-collections',
  'ig-nobel-science',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** The topics inside each category, in the order the settings checklist lists them (ADR-034). */
export const SUBCATEGORIES: Readonly<Record<Category, readonly string[]>> = {
  geography: [
    'capitals',
    'cities-and-landmarks',
    'physical-geography',
    'flags-and-borders',
    'world-regions',
  ],
  stem: [
    'physics',
    'chemistry',
    'biology',
    'astronomy-and-space',
    'math',
    'engineering-and-technology',
    'computing',
  ],
  history: [
    'ancient-world',
    'medieval-and-renaissance',
    'modern-history',
    'us-history',
    'leaders-and-royals',
    'wars-and-revolutions',
    'inventions-and-discoveries',
  ],
  'arts-and-literature': [
    'painting-and-sculpture',
    'novels-and-authors',
    'poetry-and-plays',
    'mythology-and-folklore',
    'architecture-and-design',
    'classical-music-and-dance',
  ],
  sports: [
    'basketball',
    'football',
    'baseball',
    'soccer',
    'olympics',
    'tennis-and-golf',
    'hockey',
    'motorsport-and-more',
  ],
  'food-and-drink': [
    'world-cuisines',
    'ingredients',
    'cooking-and-kitchen',
    'drinks',
    'sweets-and-desserts',
  ],
  nature: [
    'mammals',
    'birds-reptiles-and-fish',
    'insects-and-sea-life',
    'plants-and-trees',
    'earth-and-weather',
    'human-body',
  ],
  language: [
    'vocabulary',
    'grammar-and-spelling',
    'idioms-and-phrases',
    'world-languages',
    'word-origins',
  ],
  entertainment: ['movies', 'tv-shows', 'pop-music', 'video-games', 'comics-and-animation'],
  'everyday-life': [
    'brands-and-logos',
    'holidays-and-traditions',
    'money-and-business',
    'travel-and-transport',
    'units-and-measures',
  ],
  'board-and-card-games': ['tabletop-rules'],
  'world-heritage': ['heritage-sites'],
  'museum-collections': ['collection-artists'],
  'ig-nobel-science': ['unlikely-research'],
};

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MIN_QUESTIONS = 200;
export const MIN_CATEGORIES = 6;
/** Every topic can host a topic-only game at the maximum question count (20 + the final). */
export const MIN_PER_SUBCATEGORY = 30;

/** Ids and topics whose label is not just their words capitalised. */
const LABELS: Readonly<Record<string, string>> = {
  all: 'All categories',
  stem: 'STEM',
  'us-history': 'US History',
  'tv-shows': 'TV Shows',
  'birds-reptiles-and-fish': 'Birds, Reptiles & Fish',
  'ig-nobel-science': 'Ig Nobel Science',
};

/** Human label for a category or topic id ("arts-and-literature" → "Arts & Literature"). */
export function labelOf(id: string): string {
  const fixed = LABELS[id];
  if (fixed !== undefined) return fixed;
  return id
    .split('-')
    .map((w) => (w === 'and' ? '&' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

const questionFields = z.object({
  id: z.string().regex(/^[a-z]{3}-\d{3,4}$/),
  category: z.enum(CATEGORIES),
  subcategory: z.string().min(1),
  difficulty: z.enum(DIFFICULTIES),
  question: z.string().min(1).max(160),
  // Exactly four distinct choices; distractors must not duplicate the answer (case-insensitive).
  choices: z
    .array(z.string().min(1).max(60))
    .length(4)
    .refine((c) => new Set(c.map((s) => s.trim().toLowerCase())).size === 4, {
      message: 'choices must be four distinct strings',
    }),
  answerIndex: z.number().int().min(0).max(3),
  /** Short attribution note — the pack contains only widely documented, non-time-sensitive facts. */
  source: z.string().min(1).max(200),
});
const inCategory = (q: { category: Category; subcategory: string }): boolean =>
  SUBCATEGORIES[q.category].includes(q.subcategory);
export const questionSchema = questionFields.refine(inCategory, {
  message: 'subcategory must belong to the category',
});
export type Question = z.infer<typeof questionSchema>;

export const questionsPackSchema = z
  .object({ items: z.array(questionSchema).min(MIN_QUESTIONS) })
  .refine((p) => new Set(p.items.map((q) => q.id)).size === p.items.length, {
    message: 'question ids must be unique',
  })
  .refine((p) => new Set(p.items.map((q) => q.category)).size >= MIN_CATEGORIES, {
    message: `the pack needs at least ${MIN_CATEGORIES} categories`,
  });
export type QuestionsPack = z.infer<typeof questionsPackSchema>;

/** ADR-054: the Spanish deck. Same shape; an ES-only replacement carries its English item's id plus
 *  "-es"; `dropped` lists the English ids with no Spanish version (questions about English itself).
 *  The content test proves every English id is either present or dropped. */
export const questionsEsPackSchema = z
  .object({
    lang: z.literal('es'),
    dropped: z.array(z.string().regex(/^[a-z]{3}-\d{3,4}$/)),
    items: z
      .array(
        questionFields
          .extend({ id: z.string().regex(/^[a-z]{3}-\d{3,4}(-es)?$/) })
          .refine(inCategory, { message: 'subcategory must belong to the category' }),
      )
      .min(MIN_QUESTIONS),
  })
  .refine((p) => new Set(p.items.map((q) => q.id)).size === p.items.length, {
    message: 'question ids must be unique',
  });
export type QuestionsEsPack = z.infer<typeof questionsEsPackSchema>;

/** Where each added entry came from (BL-015): checked by scripts/check-content-pack-duplicates.ts. */
const originEntry = z.object({ id: z.string() }).passthrough();
export const originsSchema = z.union([
  z.array(originEntry),
  z.object({ entries: z.array(originEntry) }).passthrough(),
]);

export const packs = {
  'content-pack-origins': originsSchema,
  questions: questionsPackSchema,
  'questions.es': questionsEsPackSchema,
} as const;
