// Stage coverage uses actual init/reduce views; root owns browser fit and interaction checks.
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider, ServerClockProvider, Timer } from '@partybox/game-sdk/ui';
import type { PlayerInfo } from '@partybox/game-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { finalTotalsDelay } from '../client/timing';
import tvStyles from '../client/Tv.module.css';
import { Tv } from '../client/Tv';
import { tv as tvModule } from '../client/tv-entry';
import { game } from '../server/index';
import type { State } from '../server/types';
import { input, phone, timer, tv, vip } from './helpers';

type Mode = 'classic' | 'wager';
const T0 = 2_000_000_000_000;
const seats = (count: number, remote = false): PlayerInfo[] =>
  Array.from({ length: count }, (_, index) => ({
    id: 'seat-' + (index + 1),
    name: 'Guest ' + String(index + 1).padStart(2, '0') + ' Zephyr',
    avatarId: 'fox',
    connected: true,
    canSeeTv: !(remote && index === 0),
  }));

afterEach(() => vi.useRealTimers());

function start(mode: Mode, count = 8, phoneOnly = false, remote = false): State {
  return game.init({
    players: seats(count, remote),
    settings: {
      quizMode: mode,
      classicPack: 'general',
      questions: 5,
      answerSeconds: 10,
      category: 'all',
    },
    seed: 42,
    now: T0,
    contentLang: 'es',
    presence: { mode: 'together', phoneOnly },
  });
}

const escape = (text: string): string => renderToStaticMarkup(<>{text}</>);
const buttons = (html: string): string[] => html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function paintPhone(
  state: State,
  id = 'seat-1',
  stage = false,
  now = state.phase.paused?.at ?? state.phase.startedAt + 1_000,
  offsetMs = 0,
  shellClock = false,
): string {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now - offsetMs);
  const me = state.players[id] ?? { id, name: 'Spectator Willow', avatarId: 'owl' };
  const view = phone(state, id);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={offsetMs}>
      {shellClock ? (
        <Timer
          deadline={view.deadline}
          phaseKey={view.phaseId}
          phaseAt={view.phaseAt}
          paused={view.paused}
          clockHeldAt={view.clockHeldAt}
        />
      ) : null}
      <PhoneOnlyProvider value={stage}>
        <Controller view={{ ...view, vip: null }} me={me} send={() => undefined} />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}

function paintTv(state: State, now: number, offsetMs = 0, shellClock = false): string {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now - offsetMs);
  const view = tv(state);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={offsetMs}>
      {shellClock ? (
        <Timer
          deadline={view.deadline}
          phaseKey={view.phaseId}
          phaseAt={view.phaseAt}
          paused={view.paused}
          clockHeldAt={view.clockHeldAt}
        />
      ) : null}
      <Tv view={{ ...view, vip: null }} />
    </ServerClockProvider>,
  );
}

function timerText(html: string): string[] {
  return [...html.matchAll(/<([a-z][\w:-]*)\b[^>]*\brole="timer"[^>]*>([\s\S]*?)<\/\1>/g)].map(
    (match) =>
      match[2]!
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
  );
}

function visitPhases(initial: State): State[] {
  const states: State[] = [];
  let state = initial;
  for (let steps = 0; steps < 80; steps++) {
    states.push(state);
    if (state.phase.id === 'done') return states;
    const next = timer(state);
    if (next === state) throw new Error('A current phase deadline did not advance the real match');
    state = next;
  }
  throw new Error('Stage traversal did not terminate');
}

describe.each(['classic', 'wager'] as const)('%s shared question stages', (mode) => {
  it('supplies full question text and choices to phone-only and remote players', () => {
    for (const [phoneOnly, remote] of [
      [true, false],
      [false, true],
    ] as const) {
      const state = timer(start(mode, 8, phoneOnly, remote));
      const question = tv(state).question;
      if (!question) throw new Error('Public question missing');
      const view = phone(state, 'seat-1');
      expect(view.participating).toBe(true);
      expect(view.showStage).toBe(true);
      expect(view.stage?.question).toEqual(question);
      const html = paintPhone(state, 'seat-1', phoneOnly);
      expect(html).toContain(escape(question.text));
      for (const choice of question.choices) expect(html).toContain(escape(choice));
      expect(buttons(html)).toHaveLength(4);
      expect(html).not.toMatch(/look at the TV|watch the TV|see the TV/i);
    }
  });

  it('keeps an echoed remote answer on its phone stage after a reload', () => {
    let state = timer(start(mode, 8, false, true));
    const opened = state.phase.startedAt;
    const stamp = phone(state, 'seat-1').answerStamp;
    state = input(
      state,
      'seat-1',
      mode === 'classic' && stamp
        ? { type: 'answer', ...stamp, index: 0 }
        : { type: 'pick', index: 0 },
      opened + 400,
    );
    const html = paintPhone(state, 'seat-1', false, opened + 600);
    expect(html).not.toMatch(/look at the TV|watch the TV|see the TV/i);
    expect(buttons(html)).toHaveLength(4);
    expect(buttons(html).every((button) => button.includes('disabled'))).toBe(true);
  });

  it('lets spectators and permanently departed seats read the question without controls', () => {
    let state = timer(start(mode));
    const opened = state.phase.startedAt;
    state = game.reduce(state, {
      type: 'player',
      playerId: 'seat-1',
      connected: false,
      gone: 'left',
      now: opened + 200,
    });
    expect(state.phase.id).toBe('question');
    const question = tv(state).question;
    if (!question) throw new Error('Public question missing after departure');
    for (const id of ['audience', 'seat-1']) {
      const view = phone(state, id);
      expect(view.participating).toBe(false);
      expect(view.showStage).toBe(true);
      expect(view.stage?.question).toEqual(question);
      const html = paintPhone(state, id);
      expect(html).toContain(escape(question.text));
      for (const choice of question.choices) expect(html).toContain(escape(choice));
      expect(buttons(html)).toHaveLength(0);
      expect(html).not.toMatch(/look at the TV|watch the TV|see the TV/i);
    }
  });

  it.each([8, 16])('renders every real phase and all final seats at %i players', (count) => {
    const frames = visitPhases(start(mode, count, true));
    const phases = new Set(frames.map((state) => state.phase.id));
    for (const phase of ['intro', 'question', 'reveal', 'done'])
      expect(phases.has(phase as State['phase']['id'])).toBe(true);
    expect(phases.has('wager')).toBe(mode === 'wager');
    expect(phases.has('podium')).toBe(mode === 'classic');
    for (const state of frames) {
      const now =
        state.phase.deadline === null ? state.phase.startedAt + 1_000 : state.phase.deadline - 1;
      for (const html of [
        paintTv(state, now),
        paintPhone(state, 'seat-1', true, now),
        paintPhone(state, 'audience', true, now),
      ]) {
        expect(html).toMatch(/<(?:h[123]|p)\b/);
        expect(html).not.toMatch(/NaN|undefined|Infinity/);
      }
      expect(buttons(paintPhone(state, 'audience', true, now))).toHaveLength(0);
    }
    const done = frames[frames.length - 1]!;
    for (const html of [
      paintTv(done, done.phase.startedAt),
      paintPhone(done, 'seat-1', true),
      paintPhone(done, 'audience', true),
    ]) {
      for (const player of seats(count)) expect(textOf(html)).toContain(player.name);
    }
  });

  it.each([0, 2_500, -2_500])(
    'holds question clocks through pause and resume with offset %i',
    (offsetMs) => {
      const state = timer(start(mode, 8, false, true));
      const pausedAt = state.phase.startedAt + 2_500;
      // The inherited wager UI delegates these two countdowns to host chrome.
      // The public kit has no host; its SDK Timer receives the unmodified real view clocks.
      const render = (current: State, now: number): string[][] => [
        timerText(paintTv(current, now, offsetMs, mode === 'wager')),
        timerText(paintPhone(current, 'seat-1', false, now, offsetMs, mode === 'wager')),
        timerText(paintPhone(current, 'audience', true, now, offsetMs)),
      ];
      const before = render(state, pausedAt);
      for (const text of before) {
        expect(text.length).toBeGreaterThan(0);
        expect(text.join(' ')).toMatch(/\d/);
      }
      const paused = vip(state, 'pause', pausedAt);
      expect(paused.phase.paused?.at).toBe(pausedAt);
      const held = render(paused, pausedAt);
      expect(render(paused, pausedAt + 60_000)).toEqual(held);
      const pausedPads = buttons(paintPhone(paused, 'seat-1', false, pausedAt + 60_000, offsetMs));
      expect(pausedPads).toHaveLength(4);
      expect(pausedPads.every((button) => button.includes('disabled'))).toBe(true);
      const resumed = vip(paused, 'resume', pausedAt + 60_000);
      expect(resumed.phase.deadline).toBe(state.phase.deadline! + 60_000);
      expect(render(resumed, pausedAt + 60_000)).toEqual(before);
    },
  );
});

describe('inherited final-wager registration', () => {
  it.each([8, 16])(
    'separates the public answer chart and standings at %i seats without answer pads',
    (count) => {
      const reveal = visitPhases(start('wager', count, true)).find(
        (state) => state.phase.id === 'reveal' && !tv(state).round?.final,
      );
      if (!reveal || tv(reveal).leaderboardAt === undefined)
        throw new Error('Ordinary stage needs its authored scoreboard beat');
      const boardAt = tv(reveal).leaderboardAt!;
      for (const id of ['seat-1', 'audience']) {
        const before = paintPhone(reveal, id, true, boardAt - 1);
        expect(before).toContain('aria-label="Answer distribution"');
        expect(before).not.toContain('aria-label="Standings"');
        expect(before).not.toContain('role="radiogroup"');
        expect(before).not.toContain('role="radio"');
        const after = paintPhone(reveal, id, true, boardAt);
        expect(after).toContain('aria-label="Standings"');
        expect(after).not.toContain('aria-label="Answer distribution"');
        expect(after).not.toContain('role="radio"');
        for (const player of seats(count)) expect(textOf(after)).toContain(player.name);
        if (id === 'seat-1') {
          expect(before).toContain('Too slow');
          expect(after).toContain('Too slow');
          expect(before).toContain('0 total');
          expect(after).toContain('0 total');
        }
      }
      const besideTv = paintPhone({ ...reveal, phoneOnly: false }, 'seat-1', false, boardAt);
      expect(besideTv).toContain('role="radiogroup"');
      expect(buttons(besideTv)).toHaveLength(4);
    },
  );

  it('holds public phone rows until the TV totals beat, including a held final reveal', () => {
    const final = visitPhases(start('wager', 8, true)).find(
      (state) => state.phase.id === 'reveal' && tv(state).round?.final,
    );
    if (!final) throw new Error('Final wager evidence missing');
    const revealAt = tv(final).revealAt!;
    const totalsAt = revealAt + finalTotalsDelay(8);
    for (const id of ['seat-1', 'audience']) {
      const before = paintPhone(final, id, true, totalsAt - 1);
      for (const player of seats(8)) expect(before).not.toContain(escape(player.name));
      const after = paintPhone(final, id, true, totalsAt);
      for (const player of seats(8)) expect(after).toContain(escape(player.name));
    }
    expect(paintTv(final, totalsAt - 1)).not.toContain(`${tvStyles.pop} ${tvStyles.total}`);
    expect(paintTv(final, totalsAt)).toContain(`${tvStyles.pop} ${tvStyles.total}`);
    const paused = vip(final, 'pause', revealAt + 1700);
    const before = paintTv(paused, revealAt + 1700);
    expect(paintTv(paused, revealAt + 60000)).toBe(before);
    for (const id of ['seat-1', 'audience']) {
      const held = paintPhone(paused, id, true, revealAt + 60000);
      for (const player of seats(8)) expect(held).not.toContain(escape(player.name));
    }
  });

  it('retains its persistent final board while ordinary and classic reveals do not register one', () => {
    const wagerFrames = visitPhases(start('wager'));
    const final = wagerFrames.find(
      (state) => state.phase.id === 'reveal' && tv(state).round?.final,
    );
    if (!final) throw new Error('The real wager match must reveal its extra final question');
    expect(tv(final).round).toMatchObject({ number: 6, total: 5, final: true });
    expect(tvModule.Finale).toBeDefined();
    expect(tvModule.finale?.({ ...tv(final), vip: null })).toBe(true);
    const ordinary = wagerFrames.find(
      (state) => state.phase.id === 'reveal' && !tv(state).round?.final,
    )!;
    expect(tvModule.finale?.({ ...tv(ordinary), vip: null })).toBe(false);
    for (const state of visitPhases(start('classic')))
      expect(tvModule.finale?.({ ...tv(state), vip: null })).toBe(false);
    const html = paintTv(final, final.phase.deadline! - 1);
    const question = tv(final).question;
    if (!question) throw new Error('Final wager question missing');
    expect(html).toContain(escape(question.text));
    expect(tv(final).rows).toHaveLength(8);
    for (const player of seats(8)) expect(html).toContain(escape(player.name));
  });
});
