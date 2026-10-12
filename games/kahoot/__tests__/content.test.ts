// Content pack guarantees from README.md "Content": size, categories, unique ids, four distinct
// choices, answerIndex in range, balanced answer positions, and the manifest's category options.
import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  MIN_CATEGORIES,
  MIN_PER_SUBCATEGORY,
  MIN_QUESTIONS,
  SUBCATEGORIES,
  labelOf,
  packs,
} from '../content/schema';
import questionsJson from '../content/questions.json' with { type: 'json' };
import { QUESTIONS, categoryLabel, questionsIn } from '../server/content';
import { game } from '../server/index';

describe('content/questions.json', () => {
  it('validates and has at least 200 items across at least 6 categories', () => {
    expect(packs.questions.safeParse(questionsJson).success).toBe(true);
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(MIN_QUESTIONS);
    const categories = new Set(QUESTIONS.map((q) => q.category));
    expect(categories.size).toBeGreaterThanOrEqual(MIN_CATEGORIES);
    expect([...categories].sort()).toEqual([...CATEGORIES].sort());
  });

  it('has unique ids and four distinct choices with the answer in range', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(q.choices, q.id).toHaveLength(4);
      expect(new Set(q.choices.map((c) => c.toLowerCase())).size, q.id).toBe(4);
      expect(q.answerIndex, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex, q.id).toBeLessThanOrEqual(3);
      expect(q.source.length, q.id).toBeGreaterThan(0);
    }
  });

  it('keeps categories roughly balanced and answer positions spread', () => {
    // BL-015 adds four 50-question starter categories. Preserve the original ten categories'
    // 300+ and per-topic balance guarantees while giving every starter a complete 20+final game.
    const starters = [
      'board-and-card-games',
      'world-heritage',
      'museum-collections',
      'ig-nobel-science',
    ];
    const established = CATEGORIES.filter((c) => !starters.includes(c));
    const counts = CATEGORIES.map((c) => questionsIn(c).length);
    expect(Math.min(...established.map((c) => questionsIn(c).length))).toBeGreaterThanOrEqual(300);
    for (const c of CATEGORIES.filter((c) => starters.includes(c)))
      expect(questionsIn(c).length, c).toBeGreaterThanOrEqual(50);
    // T-0133: the pack is balanced per topic, so a category with more topics holds more (sports:
    // eight). Per topic the categories stay within 1.3× of each other, and no category passes 15 %
    // of the pack (an "all categories" game leans no further than that).
    const perTopic = established.map((c) => questionsIn(c).length / SUBCATEGORIES[c].length);
    expect(Math.max(...perTopic)).toBeLessThanOrEqual(Math.min(...perTopic) * 1.3);
    for (const n of counts) expect(n).toBeLessThanOrEqual(QUESTIONS.length * 0.15);
    const positions = [0, 1, 2, 3].map((i) => QUESTIONS.filter((q) => q.answerIndex === i).length);
    for (const n of positions) expect(n).toBeGreaterThanOrEqual(QUESTIONS.length / 5);
    // Every topic can host a topic-only game at the maximum question count (20 + the final).
    for (const c of CATEGORIES)
      for (const s of SUBCATEGORIES[c])
        expect(questionsIn(c, [s]).length, `${c}/${s}`).toBeGreaterThanOrEqual(MIN_PER_SUBCATEGORY);
    // Difficulty is a mix everywhere, never a category of only easy questions.
    for (const c of CATEGORIES) {
      const hard = questionsIn(c).filter((q) => q.difficulty === 'hard').length;
      expect(hard / questionsIn(c).length, c).toBeGreaterThanOrEqual(0.15);
    }
  });

  it('never repeats a question text (normalised) across the pack', () => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    expect(new Set(QUESTIONS.map((q) => norm(q.question))).size).toBe(QUESTIONS.length);
  });

  it('never uses the hidden-info key names in prose', () => {
    for (const q of QUESTIONS) {
      const text = `${q.question} ${q.choices.join(' ')}`;
      for (const key of ['correctIndex', 'pickIndex', 'wagerAmount'])
        expect(text, q.id).not.toContain(key);
    }
  });
});

describe('manifest', () => {
  it('lists every category (plus "all") in the category setting', () => {
    const setting = game.manifest.settings.find((s) => s.key === 'category');
    expect(setting?.type).toBe('select');
    if (setting?.type !== 'select') return;
    expect(setting.default).toBe('all');
    expect(setting.options.map((o) => o.value)).toEqual(['all', ...CATEGORIES]);
    for (const o of setting.options) expect(o.label).toBe(categoryLabel(o.value));
  });

  it('lists every topic of every category in the topics checklist, grouped by category', () => {
    const setting = game.manifest.settings.find((s) => s.key === 'subcategories');
    expect(setting?.type).toBe('multiselect');
    if (setting?.type !== 'multiselect') return;
    expect(setting.default).toBe('');
    expect(setting.groupBy).toBe('category');
    const expected = CATEGORIES.flatMap((c) =>
      SUBCATEGORIES[c].map((s) => ({ value: s, label: labelOf(s), group: c })),
    );
    expect(setting.options).toEqual(expected);
  });

  it('declares the shared phases, including the classic podium', () => {
    expect(game.phases).toEqual(['intro', 'question', 'reveal', 'wager', 'podium', 'done']);
  });
});
