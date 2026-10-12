// Small authored English packs, loaded only on the server. Legacy library data is unchanged.
import general from '../content/classic-general.json' with { type: 'json' };
import movies from '../content/classic-movies.json' with { type: 'json' };
import science from '../content/classic-science.json' with { type: 'json' };
import knowledge from '../content/classic-knowledge.json' with { type: 'json' };
import { classicKnowledgeSchema, classicPackSchema } from '../content/classic-schema';
import type { ClassicPack, ClassicPackId } from '../content/classic-schema';
import type { Question } from '../content/schema';

export const CLASSIC_PACKS: Readonly<Record<ClassicPackId, ClassicPack>> = {
  general: classicPackSchema.parse(general),
  movies: classicPackSchema.parse(movies),
  science: classicPackSchema.parse(science),
};
export const CLASSIC_KNOWLEDGE = classicKnowledgeSchema.parse(knowledge);
export type ClassicQuestion = Omit<Question, 'category'> & {
  category: string;
  explanation: string;
};
export const CLASSIC_QUESTIONS: readonly ClassicQuestion[] = Object.values(CLASSIC_PACKS).flatMap(
  (p) =>
    p.questions.map((q) => ({
      id: q.id,
      category: `classic-${p.id}`,
      subcategory: '',
      difficulty: (['easy', 'medium', 'hard'] as const)[q.difficulty - 1]!,
      question: q.prompt,
      choices: [...q.options],
      answerIndex: q.correct,
      explanation: q.explanation,
      source: `Original P01 authored ${p.name} pack`,
    })),
);
const BY_ID = Object.fromEntries(CLASSIC_QUESTIONS.map((q) => [q.id, q]));
export function classicQuestionById(id: string): ClassicQuestion | undefined {
  return Object.hasOwn(BY_ID, id) ? BY_ID[id] : undefined;
}
export function classicPackLabel(pack: ClassicPackId): string {
  return CLASSIC_PACKS[pack].name;
}
