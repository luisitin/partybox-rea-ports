// Readable score/podium holds protect a room of strangers, including long names and ties.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readingMs, wordCount } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { game } from '../server/index';
import { enterScore } from '../server/phases/score';
import { enterPodium } from '../server/phases/podium';
import { enterQuestion } from '../server/phases/question';
import { enterReveal } from '../server/phases/reveal';
import type { State } from '../server/types';

const duration = (state: State): number => state.phase.deadline! - state.phase.startedAt;
const earlyTimer = (state: State) => ({
  type: 'timer' as const,
  phaseId: state.phase.id,
  startedAt: state.phase.startedAt,
  now: state.phase.deadline! - 1,
});

function phoneRevealWords(state: State): number {
  const view = game.controllerView({ ...state, phoneOnly: true }, 'p1');
  const html = renderToStaticMarkup(
    createElement(PhoneOnlyProvider, {
      value: true,
      children: createElement(Controller, {
        view: { ...view, vip: null },
        me: state.players.p1!,
        send: () => undefined,
      }),
    }),
  );
  // Decorative shapes and the compact verdict's hidden mark are not visible reading text.
  const text = html
    .replace(/<([a-z][a-z0-9-]*)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return wordCount(text);
}

function board(count: number, longNames = false): State {
  const players = testPlayers(count).map((p, i) => ({
    ...p,
    name: longNames ? `Player Number ${i + 1}` : `Player${i + 1}`,
  }));
  const state = testKit(game, { players, settings: { rounds: 5 } }).start();
  return {
    ...state,
    scores: Object.fromEntries(players.map((p, i) => [p.id, 1000 - i * 10])),
    streaks: Object.fromEntries(players.map((p) => [p.id, 1])),
    verdicts: Object.fromEntries(
      players.map((p) => [
        p.id,
        { outcome: 'correct' as const, base: 1000, bonus: 0, points: 1000, streak: 1 },
      ]),
    ),
  };
}

describe('scoreboard reading time', () => {
  it('holds the worst public surface after settling: two phones versus eight TV rows', () => {
    const two = enterScore(board(2), 1000);
    const eight = enterScore(board(8), 1000);
    // Two-seat phone: heading + 9-word personal summary + two 3-word rows = 16.
    expect(duration(two)).toBe(readingMs(16, { ui: true }) + 1425);
    // Eight-seat TV: 5 heading words + 2 column bands + eight 4-word rows = 39.
    expect(duration(eight)).toBe(readingMs(39, { ui: true }) + 1425);
    expect(duration(eight)).toBeGreaterThan(duration(two));
  });

  it('adds actual name words, ignores early timers and then opens the next question', () => {
    const short = enterScore(board(8), 1000);
    const long = enterScore(board(8, true), 1000);
    // Each three-word name adds two words to each of the eight public rows.
    expect(duration(long)).toBe(readingMs(55, { ui: true }) + 1425);
    expect(duration(long)).toBeGreaterThan(duration(short));
    expect(game.reduce(long, earlyTimer(long))).toBe(long);
    expect(testKit(game).timer(long).phase.id).toBe('question');
  });
});

describe('podium reading time', () => {
  it('budgets only revealed people, holds each tier, and ends after first place', () => {
    const kit = testKit(game);
    let state = enterPodium(board(8), 1000);
    expect(state.podiumStep).toBe(0);
    // Header, announced tier and three plinth labels: 7; one name and points: 3.
    expect(duration(state)).toBe(readingMs(10, { ui: true }) + 600);
    expect(game.tvView(state).standings.map((p) => p.rank)).toEqual([3]);
    expect(game.reduce(state, earlyTimer(state))).toBe(state);
    const secondAt = state.phase.deadline!;
    state = kit.timer(state);
    expect(state.phase.deadline! - secondAt).toBe(readingMs(13, { ui: true }) + 600);
    expect(game.tvView(state).standings.map((p) => p.rank)).toEqual([2, 3]);
    const firstAt = state.phase.deadline!;
    state = kit.timer(state);
    expect(state.phase.deadline! - firstAt).toBe(readingMs(16, { ui: true }) + 600);
    expect(game.tvView(state).standings.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(kit.timer(state).phase.id).toBe('done');
  });

  it('skips an empty third tier for two players and gives all eight tied names reading time', () => {
    const two = enterPodium(board(2), 1000);
    expect(two.podiumStep).toBe(1);
    expect(duration(two)).toBe(readingMs(10, { ui: true }) + 600);
    const base = board(8, true);
    const tied = enterPodium(
      { ...base, scores: Object.fromEntries(Object.keys(base.players).map((id) => [id, 9999])) },
      1000,
    );
    expect(tied.podiumStep).toBe(2);
    // Seven fixed words and eight (three-word name + score + points) entries = 47.
    expect(duration(tied)).toBe(readingMs(47, { ui: true }) + 600);
    expect(game.tvView(tied).standings).toHaveLength(8);
    expect(game.reduce(tied, earlyTimer(tied))).toBe(tied);
    expect(testKit(game).timer(tied).phase.id).toBe('done');
  });
});

describe('question and reveal reading time', () => {
  it('extends a ten-second question for complete long content and pending-phone instructions', () => {
    const base = board(8);
    const prompt =
      'Which of these carefully described answers best explains the result of this experiment?';
    const options: State['deck'][number]['options'] = [
      'The direction of both moving objects changes',
      'The pressure inside the sealed vessel changes',
      'The structure of the tested material changes',
      'The motion of the surrounding water changes',
    ];
    const state = enterQuestion(
      {
        ...base,
        settings: { ...base.settings, seconds: 10 },
        deck: [{ ...base.deck[0]!, prompt, options }, ...base.deck.slice(1)],
      },
      1000,
      1,
    );
    const contentWords = wordCount([prompt, ...options].join(' '));
    expect(duration(state)).toBe(readingMs(contentWords + 15, { ui: true }));
    expect(duration(state)).toBeGreaterThan(10_000);
    expect(game.reduce(state, earlyTimer(state))).toBe(state);
  });

  it('holds a bonus verdict and full answer chart, then budgets missed-seat feedback on timeout', () => {
    const base = board(2);
    const q: State['deck'][number] = {
      ...base.deck[0]!,
      prompt: 'Which city is the capital of Japan?',
      options: ['Sapporo', 'Osaka', 'Kyoto', 'Tokyo'],
      correct: 3,
      explanation: "Tokyo is Japan's capital.",
    };
    const answered = {
      ...base,
      deck: [q, ...base.deck.slice(1)],
      answers: {
        p1: { choice: 3, elapsed: 1000 },
        p2: { choice: 3, elapsed: 1000 },
      },
    };
    const bonus = enterReveal(answered, 1000);
    // The phone repeats the correct option below its chart, as well as in its option row.
    const phoneWords = phoneRevealWords(bonus);
    expect(phoneWords).toBe(37);
    expect(duration(bonus)).toBe(readingMs(phoneWords, { ui: true }) + 600);
    expect(bonus.verdicts.p1!.bonus).toBe(100);
    expect(game.reduce(bonus, earlyTimer(bonus))).toBe(bonus);
    expect(testKit(game).timer(bonus).phase.id).toBe('score');

    const correctLabels = ['Tokyo', 'Tokyo city', 'Metropolitan Tokyo city', 'The city of Tokyo'];
    const corrections = [433, 866, 1299, 1732];
    for (const [index, correctLabel] of correctLabels.entries()) {
      const variant = {
        ...q,
        options: q.options.map((option, choice) =>
          choice === q.correct ? correctLabel : option,
        ) as State['deck'][number]['options'],
      };
      const revealed = enterReveal({ ...answered, deck: [variant, ...base.deck.slice(1)] }, 1000);
      // Both the chart row and the footer display this label. Each must receive reading time.
      const visibleWords = phoneRevealWords(revealed);
      expect(visibleWords).toBe(phoneWords + 2 * (wordCount(correctLabel) - 1));
      const omittedFooterWords = visibleWords - wordCount(correctLabel);
      expect(duration(revealed)).toBe(readingMs(visibleWords, { ui: true }) + 600);
      expect(
        readingMs(visibleWords, { ui: true }) - readingMs(omittedFooterWords, { ui: true }),
      ).toBe(corrections[index]);
    }

    const timeout = enterReveal({ ...answered, answers: {} }, 1000);
    // TV: round4 + prompt7 + options4 + counts4 + correct flag2 + fact4 + missed4 + answer1 = 30.
    expect(duration(timeout)).toBe(readingMs(30, { ui: true }) + 600);
    expect(duration(timeout)).toBeGreaterThanOrEqual(
      readingMs(phoneRevealWords(timeout), { ui: true }) + 600,
    );
    expect(Object.values(timeout.verdicts).every((v) => v.outcome === 'timeout')).toBe(true);
    expect(game.reduce(timeout, earlyTimer(timeout))).toBe(timeout);
  });
});
