import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from './Controller';
import { Tv } from './Tv';
import { game } from '../server/index';
import type { State } from '../server/types';

const PLAYERS = Array.from({ length: 8 }, (_, i) => ({
  id: `racer-${i}`,
  name: `Racer ${i + 1}`,
  avatarId: 'fox',
  connected: true,
}));

function state(): State {
  const initial = game.init({ players: PLAYERS, settings: {}, seed: 91, now: 0 });
  return {
    ...initial,
    racers: Object.fromEntries(
      Object.entries(initial.racers).map(([id, racer], i) => [
        id,
        { ...racer, score: i * 100, board: [2 ** (i + 1), ...Array<number>(15).fill(0)] },
      ]),
    ),
  };
}

function phone(s: State, id = 'racer-0', phoneOnly = false): string {
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={{ ...game.controllerView(s, id), vip: null }}
        me={{ id, name: 'Racer 1', avatarId: 'fox' }}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}

describe('Merge Sprint phone surfaces', () => {
  it('renders one private control surface and four labelled native direction buttons', () => {
    const html = phone(state());
    expect(html.match(/role="grid"/g)).toHaveLength(1);
    expect(html.match(/<button/g)).toHaveLength(4);
    for (const dir of ['left', 'up', 'down', 'right']) {
      expect(html).toContain(`aria-label="Move ${dir}"`);
    }
    expect(html).toContain('aria-label="Your board"');
    expect(html).toContain('Swipe the board or tap a direction.');
    expect(html).toContain('Best tile');
    expect(html).toContain('Place');
  });

  it('holds the labelled clock and disables all four controls while paused', () => {
    const s = state();
    s.phase = { ...s.phase, paused: { at: 138000 } };
    const html = phone(s);
    expect(html).toContain('Paused');
    expect(html).toContain('0:42');
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });

  it('shows blocked racers the live stage and retains score without accepting moves', () => {
    const s = state();
    s.racers['racer-0']!.status = 'blocked';
    const html = phone(s);
    expect(html).toContain('No moves left');
    expect(html).toContain('Your 0 points stay in the race.');
    expect(html).not.toContain('<button');
    expect(html.match(/role="grid"/g)).toHaveLength(8);
  });

  it('gives phone-only racers a live race leader and no TV directions', () => {
    const html = phone(state(), 'racer-0', true);
    expect(html).toContain('Racer 8 leads');
    expect(html).toContain('aria-label="Race standings"');
    for (const player of PLAYERS) expect(html).toContain(player.name);
    expect(html).not.toMatch(/on the TV|Look at the TV|One moment/);
    expect(html.match(/<button/g)).toHaveLength(4);
  });

  it.each([false, true])(
    'spectators see all eight boards without controls (phoneOnly=%s)',
    (mode) => {
      const html = phone(state(), 'a-spectator', mode);
      expect(html.match(/role="grid"/g)).toHaveLength(8);
      expect(html).not.toContain('<button');
      for (const player of PLAYERS) expect(html).toContain(player.name);
    },
  );

  it.each(['reveal', 'done'])('shows the complete final ranking in %s on every phone', (phase) => {
    const s = state();
    s.phase = { id: phase, startedAt: 180000, deadline: phase === 'done' ? null : 188000 };
    s.reason = 'clock';
    for (const mode of [false, true]) {
      for (const viewer of ['racer-0', 'a-spectator']) {
        const html = phone(s, viewer, mode);
        expect(html).toContain('Racer 8 wins!');
        expect(html).toContain('Final standings');
        expect(html).not.toContain('<button');
        for (const player of PLAYERS) expect(html).toContain(player.name);
        expect(html.indexOf('Racer 8</strong>')).toBeLessThan(html.indexOf('Racer 1</strong>'));
      }
    }
  });

  it('keeps a target finisher ahead of a racer with more points', () => {
    const s = state();
    s.phase = { id: 'reveal', startedAt: 1, deadline: 8001 };
    s.reason = 'target';
    s.racers['racer-0'] = {
      ...s.racers['racer-0']!,
      status: 'finished',
      board: [2048, ...Array<number>(15).fill(0)],
    };
    const html = phone(s);
    expect(html).toContain('Racer 1 wins!');
    expect(html.indexOf('Racer 1</strong>')).toBeLessThan(html.indexOf('Racer 8</strong>'));
  });
});

describe('Merge Sprint TV', () => {
  it.each(['play', 'reveal', 'done'])('shows every player board and best tile in %s', (phase) => {
    const s = state();
    s.phase = { id: phase, startedAt: 0, deadline: phase === 'done' ? null : 180000 };
    const html = renderToStaticMarkup(<Tv view={{ ...game.tvView(s), vip: null }} />);
    expect(html.match(/role="grid"/g)).toHaveLength(8);
    expect(html.match(/data-tv-map="true"/g)).toHaveLength(8);
    for (const player of PLAYERS) expect(html).toContain(player.name);
    expect(html.match(/Best tile/g)).toHaveLength(8);
    expect(html).not.toContain('<button');
  });
});
