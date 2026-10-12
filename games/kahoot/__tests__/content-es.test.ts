// ADR-054: the Spanish deck. Every item is a well-formed Spanish question with four distinct choices;
// every English id is either translated or listed as dropped; a Spanish game deals only Spanish
// questions (topic → category → everything fallbacks counted on the Spanish deck) and an English
// game is unchanged. Answers are checked by index, so the scorer needs no Spanish matcher.
import { describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/game-sdk';
import { CATEGORIES, SUBCATEGORIES, packs } from '../content/schema';
import questionsEsJson from '../content/questions.es.json' with { type: 'json' };
import { DROPPED_ES, QUESTIONS, QUESTIONS_ES, questionById, questionsIn } from '../server/content';
import { drawQuestions, poolFor } from '../server/draw';
import { game } from '../server/index';
import { recap } from '../server/recap';
import { PLAYERS, T0, current, phone, pick, start, timer, tv } from './helpers';

const ES_IDS = new Set(QUESTIONS_ES.map((q) => q.id));
const EN_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

describe('content/questions.es.json (ADR-054)', () => {
  it('validates against the pack schema', () => {
    expect(packs['questions.es'].safeParse(questionsEsJson).success).toBe(true);
  });

  it('every item: ¿…?, four distinct choices, answerIndex 0–3, unique ids', () => {
    expect(ES_IDS.size).toBe(QUESTIONS_ES.length);
    for (const q of QUESTIONS_ES) {
      expect(q.question.startsWith('¿') && q.question.endsWith('?'), q.id).toBe(true);
      expect(new Set(q.choices.map((c) => c.trim().toLowerCase())).size, q.id).toBe(4);
      expect(q.answerIndex, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex, q.id).toBeLessThanOrEqual(3);
    }
  });

  it('every English id is translated or dropped; ES-only items replace a dropped English one', () => {
    const dropped = new Set(DROPPED_ES);
    for (const q of QUESTIONS) expect(ES_IDS.has(q.id) !== dropped.has(q.id), q.id).toBe(true);
    for (const id of DROPPED_ES) expect(EN_BY_ID.has(id), id).toBe(true);
    for (const q of QUESTIONS_ES) {
      const en = EN_BY_ID.get(q.id.replace(/-es$/, ''));
      if (q.id.endsWith('-es')) expect(dropped.has(q.id.slice(0, -3)), q.id).toBe(true);
      // Same topic and difficulty as the English item it translates or replaces.
      expect([en?.category, en?.subcategory, en?.difficulty], q.id).toEqual([
        q.category,
        q.subcategory,
        q.difficulty,
      ]);
    }
  });

  it('every topic can still host a topic-only game at the maximum question count', () => {
    for (const c of CATEGORIES)
      for (const s of SUBCATEGORIES[c])
        expect(questionsIn(c, [s], 'es').length, `${c}/${s}`).toBeGreaterThanOrEqual(21);
  });
});

describe('a Spanish game (ADR-054)', () => {
  it('deals only Spanish questions; an English game is unchanged', () => {
    const es = start({ questions: 20 }, 4);
    const esGame = game.init({
      players: PLAYERS,
      settings: { questions: 20, answerSeconds: 10, category: 'all' },
      seed: 4,
      now: T0,
      contentLang: 'es',
    });
    expect(esGame.contentLang).toBe('es');
    expect(es.contentLang).toBeUndefined();
    for (const id of esGame.questionIds) expect(questionById(id, 'es')?.question).toMatch(/^¿/);
    for (const id of es.questionIds) expect(questionById(id)).toBeDefined();
    // The English draw is exactly what it was before the Spanish deck existed.
    const [enDraw] = drawQuestions(seedRng(4), 'all', 20);
    expect(es.questionIds).toEqual(enDraw.ids);
  });

  it('the views and the scorer read the Spanish item (answers by index)', () => {
    let s = game.init({
      players: PLAYERS,
      settings: { questions: 5, answerSeconds: 10, category: 'language' },
      seed: 9,
      now: T0,
      contentLang: 'es',
    });
    s = timer(s);
    expect(s.phase.id).toBe('question');
    const q = current(s);
    expect(tv(s).question?.text).toBe(q.question);
    expect(phone(s, 'a').question?.choices).toEqual(q.choices);
    s = pick(s, 'a', true);
    s = pick(s, 'b', false);
    expect(s.picks['a']?.index).toBe(q.answerIndex);
    s = pick(s, 'c', true);
    expect(s.phase.id).toBe('reveal');
    expect(s.scores['a']).toBeGreaterThan(0);
    expect(s.scores['b']).toBe(0);
  });

  it('never runs out: topic → category → whole Spanish deck', () => {
    const hockey = questionsIn('sports', ['hockey'], 'es').length;
    // Enough topic items: the topic.
    expect(poolFor('sports', ['hockey'], hockey - 1, 'es').from).toBe('sports');
    expect(poolFor('sports', ['hockey'], hockey - 1, 'es').subs).toEqual(['hockey']);
    // Too few in the topic: the whole category, still Spanish.
    const cat = poolFor('sports', ['hockey'], hockey, 'es');
    expect([cat.from, cat.subs]).toEqual(['sports', []]);
    expect(cat.pool.every((q) => ES_IDS.has(q.id))).toBe(true);
    // Too few in the category: everything Spanish.
    const all = poolFor('sports', [], questionsIn('sports', [], 'es').length, 'es');
    expect(all.from).toBe('all');
    expect(all.pool).toBe(QUESTIONS_ES);
    // A draw from the topic hit hardest by the drops (language) deals a full Spanish game.
    for (const sub of SUBCATEGORIES.language) {
      const [d] = drawQuestions(seedRng(2), 'language', 20, [sub], 'es');
      expect(d.ids).toHaveLength(21);
      expect(new Set(d.ids).size).toBe(21);
      for (const id of d.ids) expect(questionById(id, 'es')?.subcategory).toBe(sub);
    }
  });

  it('the recap is written in Spanish', () => {
    const s = game.init({
      players: PLAYERS,
      settings: { questions: 5, answerSeconds: 10, category: 'nature' },
      seed: 1,
      now: T0,
      contentLang: 'es',
    });
    const md = recap(s, { players: PLAYERS, history: [], results: null } as never)?.markdown ?? '';
    // The shared recap frame (T-0064): the title is the game's name and date; its words are Spanish.
    expect(md).toContain('# Kahoot! · ');
    expect(md).toContain('_La partida terminó antes de tiempo._');
    expect(md).toContain('Jugadores: Ana');
    expect(md).toContain('Ajustes: 5 preguntas · 10 s cada una · Naturaleza');
    expect(md).not.toContain('Players:');
  });
});
