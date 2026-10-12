// The chart aggregates accepted answers only, never leaks live picks, and keeps Lightning's letters.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { game } from '../server/index';
import { revealMs } from '../server/phases/reveal';
import { readMs, wordCount } from '../server/types';
import type { State } from '../server/types';
import revealFixture from '../fixtures/reveal.json';
import { Tv } from '../client/Tv';
import { AnswerChart } from '../client/AnswerChart';
import { input, phone, pick, start, timer, toWager, tv } from './helpers';

afterEach(() => vi.useRealTimers());

describe('answer distribution', () => {
  it('the refreshed reveal fixture shows the split and holds for the current reading budget', () => {
    const state = revealFixture as State;
    expect(tv(state).answerDistribution).toEqual({ counts: [0, 0, 4, 12], missed: 0 });
    expect(state.phase.deadline! - state.phase.startedAt).toBe(revealMs(state));
  });
  it('counts four choices and missing seats, including a pick accepted before a disconnect', () => {
    let state = timer(start());
    state = input(state, 'a', { type: 'pick', index: 3 }, state.phase.startedAt + 500);
    state = input(state, 'b', { type: 'pick', index: 3 }, state.phase.startedAt + 800);
    state = game.reduce(state, {
      type: 'player',
      playerId: 'a',
      connected: false,
      now: state.phase.startedAt + 1_000,
    });
    expect(tv(state)).not.toHaveProperty('answerDistribution');
    expect(phone(state, 'c')).not.toHaveProperty('answerDistribution');
    state = timer(state);
    expect(tv(state).answerDistribution).toEqual({ counts: [0, 0, 0, 2], missed: 1 });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(state.phase.startedAt);
    const html = renderToStaticMarkup(<Tv view={{ ...tv(state), vip: 'a' }} />);
    const visibleText = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(state.phase.deadline! - state.phase.startedAt).toBeGreaterThanOrEqual(
      readMs(wordCount(visibleText)),
    );
    expect(tv(state).nextAt).toBeGreaterThan(state.phase.startedAt + 2300);
  });

  it('all-idle charts have four zero bars and every missing seat; later phases omit the chart', () => {
    const state = timer(timer(start()));
    expect(tv(state).answerDistribution).toEqual({ counts: [0, 0, 0, 0], missed: 3 });
    expect(tv(timer(state))).not.toHaveProperty('answerDistribution');
    expect(tv(toWager(start()))).not.toHaveProperty('answerDistribution');
    const final = timer(toWager(start()));
    expect(tv(timer(final))).not.toHaveProperty('answerDistribution');
  });

  it('shows an accessible count for each letter, the correct mark and no-answer count', () => {
    let state = timer(start());
    state = pick(state, 'a', true);
    state = timer(state);
    const view = tv(state);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(state.phase.startedAt);
    const html = renderToStaticMarkup(<Tv view={{ ...view, vip: 'a' }} />);
    expect(html).toContain('aria-label="Answer distribution"');
    expect(html).toContain('2 did not answer');
    expect(html).toContain('No answer');
    expect(html).toContain('1 answers');
    expect(html).toContain(`${['A', 'B', 'C', 'D'][view.correctIndex!]}✓`);
    expect(renderToStaticMarkup(<Tv view={{ ...tv(timer(start())), vip: 'a' }} />)).not.toContain(
      'Answer distribution',
    );
  });

  it('keeps each visible label and its own count together, including No answer', () => {
    const view = tv(timer(timer(start())));
    const html = renderToStaticMarkup(
      <AnswerChart
        question={view.question!}
        correctIndex={1}
        distribution={{ counts: [3, 5, 1, 0], missed: 7 }}
      />,
    );
    const cells = [...html.matchAll(/<li\b[^>]*>(.*?)<\/li>/g)].map((match) => match[1]!);
    expect(cells).toHaveLength(5);
    ['A', 'B✓', 'C', 'D', 'No answer'].forEach((label, index) => {
      expect(cells[index]).toContain(`>${label}</span><b>${[3, 5, 1, 0, 7][index]}</b></span>`);
    });
    expect(cells[4]).toContain('--pb-answer-share:1');
  });

  it('zero answers never produces an invalid bar scale', () => {
    const state = timer(timer(start()));
    const view = tv(state);
    const html = renderToStaticMarkup(
      <AnswerChart
        question={view.question!}
        correctIndex={view.correctIndex!}
        distribution={{ counts: [0, 0, 0, 0], missed: 0 }}
      />,
    );
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html.match(/--pb-answer-share:0/g)).toHaveLength(5);
  });
});
