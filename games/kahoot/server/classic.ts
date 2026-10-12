// Small authored English packs, loaded only on the server. Legacy library data is unchanged.
import general from '../content/classic-general.json' with { type: 'json' };
import movies from '../content/classic-movies.json' with { type: 'json' };
import science from '../content/classic-science.json' with { type: 'json' };
import sports from '../content/classic-sports.json' with { type: 'json' };
import music from '../content/classic-music.json' with { type: 'json' };
import custom from '../content/classic-custom.json' with { type: 'json' };
import knowledge from '../content/classic-knowledge.json' with { type: 'json' };
import teamKnowledge from '../content/team-knowledge.json' with { type: 'json' };
import { classicKnowledgeSchema, classicPackSchema } from '../content/classic-schema';
import type { ClassicPack, ClassicPackId } from '../content/classic-schema';
import type { Question } from '../content/schema';

export const CLASSIC_PACKS: Readonly<Record<ClassicPackId, ClassicPack>> = {
  general: classicPackSchema.parse(general),
  movies: classicPackSchema.parse(movies),
  science: classicPackSchema.parse(science),
  sports: classicPackSchema.parse(sports),
  music: classicPackSchema.parse(music),
  custom: classicPackSchema.parse(custom),
};
// Public answer-text facts are authored independently; unknown custom facts remain guesses.
export const CLASSIC_KNOWLEDGE = {
  ...classicKnowledgeSchema.parse(knowledge),
  ...classicKnowledgeSchema.parse(teamKnowledge),
};

const COUNT_WORDS: readonly string[] = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

/** Only count prompts equate plain English 0..12 with base-ten integer strings. */
function countFactValue(prompt: string, fact: string): string | undefined {
  if (!/^(?:How many|What number)\b/i.test(prompt)) return undefined;
  const word = COUNT_WORDS.indexOf(fact.toLowerCase());
  if (word >= 0) return String(word);
  // BigInt avoids equating distinct large integers after Number loses precision.
  return /^-?\d+$/.test(fact) ? BigInt(fact).toString() : undefined;
}

function equivalentPublicFacts(prompt: string, first: string, second: string): boolean {
  if (first === second) return true;
  const value = countFactValue(prompt, first);
  return value !== undefined && value === countFactValue(prompt, second);
}

// Build a prompt index from independently authored standard-pack facts only.
// Keep the first equivalent fact; a genuine conflict permanently removes the prompt.
export function publicClassicPromptFacts(
  packs: readonly { id: string; questions: readonly { id: string; prompt: string }[] }[],
  facts: Readonly<Record<string, string>>,
): ReadonlyMap<string, string> {
  const answers = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const pack of packs) {
    if (pack.id === 'custom') continue;
    for (const { id, prompt } of pack.questions) {
      const fact = Object.hasOwn(facts, id) ? facts[id] : undefined;
      if (fact === undefined || ambiguous.has(prompt)) continue;
      const prior = answers.get(prompt);
      if (prior === undefined) answers.set(prompt, fact);
      else if (!equivalentPublicFacts(prompt, prior, fact)) {
        answers.delete(prompt);
        ambiguous.add(prompt);
      }
    }
  }
  return answers;
}

const CLASSIC_PROMPT_FACTS = publicClassicPromptFacts(
  Object.values(CLASSIC_PACKS),
  CLASSIC_KNOWLEDGE,
);

/** Stable standard IDs keep priority; unknown custom IDs may reuse an exact public prompt. */
export function classicBotFact(id: string, prompt: string): string | undefined {
  if (Object.hasOwn(CLASSIC_KNOWLEDGE, id)) return CLASSIC_KNOWLEDGE[id];
  return id.startsWith('custom-') ? CLASSIC_PROMPT_FACTS.get(prompt) : undefined;
}

/** Owner facts need a unique equivalent visible choice; ambiguous choices stay guesses. */
export function classicBotChoiceIndex(
  id: string,
  prompt: string,
  choices: readonly string[],
): number {
  // Preserve the canonical known-ID path, including its exact answer-text matching.
  if (Object.hasOwn(CLASSIC_KNOWLEDGE, id)) return choices.indexOf(CLASSIC_KNOWLEDGE[id]!);
  const fact = classicBotFact(id, prompt);
  if (fact === undefined) return -1;
  const matches = choices
    .map((choice, index) => (equivalentPublicFacts(prompt, fact, choice) ? index : -1))
    .filter((index) => index >= 0);
  return matches.length === 1 ? matches[0]! : -1;
}

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
