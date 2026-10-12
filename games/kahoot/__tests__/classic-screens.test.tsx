// Real classic matches supply the public wrappers; SSR does not claim browser layout or input coverage.
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import type { PlayerInfo } from '@partybox/game-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { tv as tvModule } from '../client/tv-entry';
import { classicQuestionById } from '../server/classic';
import { game } from '../server/index';
import type { State } from '../server/types';
import { input, phone, timer, tv } from './helpers';

// Later than the SDK's initial shared SSR clock; Date-only freezing stays deterministic.
const T0 = 2_000_000_000_000;
const shapes = ['Triangle', 'Diamond', 'Circle', 'Square'];
const seats = (count: number): PlayerInfo[] =>
  Array.from({ length: count }, (_, index) => ({
    id: 'seat-' + (index + 1),
    name: 'Guest ' + String(index + 1).padStart(2, '0') + ' Aster',
    avatarId: 'fox',
    connected: true,
    canSeeTv: true,
  }));

afterEach(() => vi.useRealTimers());

function start(count = 8, phoneOnly = false): State {
  return game.init({
    players: seats(count),
    settings: { quizMode: 'classic', classicPack: 'general', questions: 5, answerSeconds: 10 },
    seed: 42,
    now: T0,
    contentLang: 'es',
    presence: { mode: 'together', phoneOnly },
  });
}

const escape = (text: string): string => renderToStaticMarkup(<>{text}</>);
const buttons = (html: string): string[] => html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];

function paint(
  state: State,
  surface: 'tv' | 'phone' | 'stage',
  id = 'seat-1',
  now = state.phase.startedAt + 1_000,
  hostLanguage?: 'en' | 'es',
  next = false,
): string {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  const rendered = surface === 'stage' ? { ...state, phoneOnly: true } : state;
  const view = phone(rendered, id);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={0}>
      {surface === 'tv' ? (
        <Tv view={{ ...tv(rendered), vip: null }} skip={next ? () => undefined : undefined} />
      ) : (
        <PhoneOnlyProvider value={surface === 'stage'}>
          <Controller
            view={{ ...view, ...(hostLanguage ? { contentLang: hostLanguage } : {}), vip: null }}
            me={state.players[id] ?? { id, name: 'Spectator Willow', avatarId: 'owl' }}
            send={() => undefined}
            skip={next ? () => undefined : undefined}
          />
        </PhoneOnlyProvider>
      )}
    </ServerClockProvider>,
  );
}

function answer(state: State, id: string, index: number, now: number): State {
  const stamp = phone(state, id).answerStamp;
  if (!stamp) throw new Error('An open classic question must publish its input stamp');
  return input(state, id, { type: 'answer', ...stamp, index }, now);
}

function rankedMatch(count: number): { podium: State; lastReveal: State } {
  let state = start(count);
  let lastReveal: State | undefined;
  for (let steps = 0; steps < 80 && state.phase.id !== 'podium'; steps++) {
    if (state.phase.id === 'done') throw new Error('Classic match skipped its occupied podium');
    if (state.phase.id === 'question') {
      const stamp = phone(state, 'seat-1').answerStamp;
      const question = stamp && classicQuestionById(stamp.questionId);
      if (!question) throw new Error('The real classic question must resolve in its authored pack');
      const opened = state.phase.startedAt;
      for (const [index, player] of seats(count).entries()) {
        const correct = index < 4;
        const choice = correct ? question.answerIndex : (question.answerIndex + 1) % 4;
        const delay = [300, 800, 1_300, 1_300][index] ?? 1_600;
        state = answer(state, player.id, choice, opened + delay);
      }
      if (state.phase.id === 'question') state = timer(state);
      expect(state.phase.id).toBe('reveal');
      if (tv(state).round?.last) lastReveal = state;
    } else {
      state = timer(state);
    }
  }
  if (!lastReveal || state.phase.id !== 'podium')
    throw new Error('Classic traversal did not finish');
  return { podium: state, lastReveal };
}

describe('classic question and personal feedback', () => {
  it('keeps the TV-visible phone to four named shapes and an independent input stamp', () => {
    const state = timer(start());
    const screen = tv(state);
    const controller = phone(state, 'seat-1');
    const question = screen.question;
    if (!question) throw new Error('Question phase needs its public TV question');
    expect(controller.quizMode).toBe('classic');
    expect(controller.question).toBeNull();
    expect(controller.answerStamp).toEqual({
      questionId: question.id,
      questionStartedAt: state.phase.startedAt,
    });
    const html = paint(state, 'phone');
    const pads = buttons(html);
    expect(pads).toHaveLength(4);
    for (const shape of shapes)
      expect(pads.some((pad) => pad.includes('aria-label="' + shape + '"'))).toBe(true);
    for (const pad of pads) expect(pad.replace(/<[^>]*>/g, '').trim()).toBe('');
    expect(html).not.toContain(escape(question.text));
    expect(controller.stage).toBeNull();
    const stage = paint(state, 'tv');
    expect(stage).toContain(escape(question.text));
    for (const choice of question.choices) expect(stage).toContain(escape(choice));
    expect(controller).not.toHaveProperty('correctIndex');
    expect(controller).not.toHaveProperty('explanation');
    expect(controller).not.toHaveProperty('answerDistribution');
  });

  it('renders the authored English question when host content metadata says Spanish', () => {
    const state = timer(start(8, true));
    const view = phone(state, 'seat-1');
    expect(view.questionLang).toBe('en');
    const question = tv(state).question;
    if (!question) throw new Error('Classic stage question missing');
    const html = paint(state, 'stage', 'seat-1', state.phase.startedAt + 1_000, 'es');
    expect(html).toContain(escape(question.text));
    for (const choice of question.choices) expect(html).toContain(escape(choice));
    expect(buttons(html)).toHaveLength(4);
  });

  it('distinguishes a correct answer, a wrong accepted answer and a missed answer', () => {
    let state = timer(start());
    const stamp = phone(state, 'seat-1').answerStamp;
    const question = stamp && classicQuestionById(stamp.questionId);
    if (!question) throw new Error('Authored question missing');
    const opened = state.phase.startedAt;
    state = answer(state, 'seat-1', question.answerIndex, opened + 400);
    state = answer(state, 'seat-2', (question.answerIndex + 1) % 4, opened + 700);
    state = timer(state);
    expect(phone(state, 'seat-1').outcome).toMatchObject({ answered: true, correct: true });
    expect(phone(state, 'seat-2').outcome).toMatchObject({
      answered: true,
      correct: false,
      delta: 0,
    });
    expect(phone(state, 'seat-3').outcome).toMatchObject({
      answered: false,
      correct: false,
      delta: 0,
    });
    const now = state.phase.startedAt + 1_000;
    expect(paint(state, 'phone', 'seat-1', now)).toMatch(/\bCorrect!/);
    expect(paint(state, 'phone', 'seat-2', now)).toContain('Wrong');
    expect(paint(state, 'phone', 'seat-3', now)).toContain('Too slow');
    for (const id of ['seat-1', 'seat-2', 'seat-3'])
      expect(buttons(paint(state, 'phone', id, now))).toHaveLength(0);
  });

  it('changes the public reveal chart into standings at its server-authored beat', () => {
    const state = timer(timer(start()));
    const view = tv(state);
    if (view.leaderboardAt === undefined || !view.explanation)
      throw new Error('Ordinary classic reveal needs both authored beats');
    for (const surface of ['tv', 'stage'] as const) {
      const before = paint(state, surface, 'audience', view.leaderboardAt - 1);
      expect(before).toContain('aria-label="Answer distribution"');
      expect(before).toContain(escape(view.explanation));
      expect(before).not.toContain('aria-label="Standings"');
      const after = paint(state, surface, 'audience', view.leaderboardAt);
      expect(after).toContain('Scoreboard');
      expect(after).toContain('aria-label="Standings"');
      expect(after).not.toContain('aria-label="Answer distribution"');
      for (const player of seats(8)) expect(after).toContain(escape(player.name));
    }
  });
});

describe.each([8, 16])('classic occupied podium at %i seats', (count) => {
  it('keeps the final answer chart readable before the podium control arrives', () => {
    const state = rankedMatch(count).lastReveal;
    const view = tv(state);
    if (view.nextAt === undefined || view.revealAt === undefined)
      throw new Error('Final classic reveal needs its authored next beat');
    expect(view).not.toHaveProperty('leaderboardAt');
    expect(view.nextAt).toBe(state.phase.deadline);
    for (const surface of ['tv', 'phone', 'stage'] as const) {
      const before = paint(state, surface, 'seat-1', view.nextAt - 1, undefined, true);
      expect(buttons(before)).toHaveLength(0);
      const after = paint(state, surface, 'seat-1', view.nextAt, undefined, true);
      expect(buttons(after)).toHaveLength(1);
      if (surface !== 'phone') expect(after).toContain('aria-label="Answer distribution"');
      expect(after).not.toContain('aria-label="Standings"');
    }
  });

  it('reveals third, second and first with ties, then gives every seat its final standing', () => {
    const match = rankedMatch(count);
    expect(tv(match.lastReveal).round).toMatchObject({ last: true, final: false });
    expect(tvModule.finale?.({ ...tv(match.lastReveal), vip: null })).toBe(false);
    expect(tv(match.lastReveal)).not.toHaveProperty('leaderboardAt');
    let state = match.podium;
    const revealed: number[] = [];
    for (const rank of [3, 2, 1]) {
      const view = tv(state);
      const podium = view.podium;
      if (!podium) throw new Error('Podium phase must publish its filtered rows');
      expect(state.phase.id).toBe('podium');
      expect(podium.rank).toBe(rank);
      revealed.push(rank);
      expect(podium.revealedRanks).toHaveLength(revealed.length);
      expect(podium.revealedRanks).toEqual(expect.arrayContaining(revealed));
      expect(podium.entries.every((row) => revealed.includes(row.rank))).toBe(true);
      if (rank === 3)
        expect(
          podium.entries
            .filter((row) => row.rank === 3)
            .map((row) => row.playerId)
            .sort(),
        ).toEqual(['seat-3', 'seat-4']);
      for (const publicView of [view, phone(state, 'seat-1')]) {
        expect(publicView).not.toHaveProperty('standings');
        expect(publicView).not.toHaveProperty('rows');
        for (const player of publicView.players) expect(player).not.toHaveProperty('score');
      }
      const owner = podium.entries.find((row) => row.playerId === 'seat-1');
      if (owner) expect(phone(state, 'seat-1').myRank).toBe(owner.rank);
      else expect(phone(state, 'seat-1')).not.toHaveProperty('myRank');
      expect(tvModule.stripScores?.({ ...view, vip: null })).toBe(false);
      expect(tvModule.stripActive?.({ ...view, vip: null })).toEqual([]);
      for (const surface of ['tv', 'phone', 'stage'] as const) {
        const html = paint(
          state,
          surface,
          surface === 'stage' ? 'audience' : 'seat-1',
          podium.beatAt + 500,
        );
        expect(buttons(html)).toHaveLength(0);
        expect(html).toContain(
          rank === 3 ? 'Third place' : rank === 2 ? 'Second place' : 'First place',
        );
        const allowed = new Set(podium.entries.map((row) => row.playerId));
        for (const player of seats(count)) {
          if (allowed.has(player.id) && surface !== 'phone')
            expect(html).toContain(escape(player.name));
          if (!allowed.has(player.id)) expect(html).not.toContain(escape(player.name));
        }
      }
      state = timer(state);
    }
    expect(state.phase.id).toBe('done');
    const standings = tv(state).standings;
    expect(standings).toHaveLength(count);
    expect(tvModule.stripScores?.({ ...tv(state), vip: null })).toBe(true);
    expect(
      standings
        ?.filter((row) => row.rank === 3)
        .map((row) => row.playerId)
        .sort(),
    ).toEqual(['seat-3', 'seat-4']);
    for (const surface of ['tv', 'stage'] as const) {
      const html = paint(state, surface, 'audience');
      for (const player of seats(count)) expect(html).toContain(escape(player.name));
    }
  });

  it('skips empty podium tiers for an actual all-idle tied match', () => {
    let state = start(count);
    for (let steps = 0; steps < 80 && state.phase.id !== 'podium'; steps++) state = timer(state);
    expect(state.phase.id).toBe('podium');
    expect(tv(state).podium?.rank).toBe(1);
    expect(tv(state).podium?.entries).toHaveLength(count);
    for (const row of tv(state).podium?.entries ?? [])
      expect(row).toMatchObject({ rank: 1, score: 0 });
    expect(timer(state).phase.id).toBe('done');
  });
});
