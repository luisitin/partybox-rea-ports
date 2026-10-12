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

function publicBoardLabels(html: string): string[] {
  return [...html.matchAll(/role="grid" aria-label="([^"]+)"/g)].map((match) => match[1]!);
}

function publicCards(html: string): string[] {
  return html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];
}

describe('2048 phone surfaces', () => {
  it('renders one private control surface and four labelled native direction buttons', () => {
    const html = phone(state());
    expect(html.match(/role="grid"/g)).toHaveLength(1);
    expect(html.match(/<button/g)).toHaveLength(4);
    for (const dir of ['left', 'up', 'down', 'right']) {
      expect(html).toContain(`aria-label="Move ${dir}"`);
    }
    expect(html.match(/aria-disabled="false"/g)).toHaveLength(4);
    expect(html).not.toContain('disabled=""');
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
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(4);
    expect(html).not.toContain('disabled=""');
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

  it('keeps Bot and Away identity on the active phone-only standings', () => {
    const s = state();
    s.players['racer-7']!.bot = true;
    s.players['racer-6']!.connected = false;
    const html = phone(s, 'racer-0', true);
    expect(html).toContain('Racer 8 (Bot) leads');
    const standings = html.split('aria-label="Race standings"')[1]!.split('</ol>')[0]!;
    expect(standings).toContain('Bot');
    expect(standings).toContain('Away');
    expect(html.match(/<button/g)).toHaveLength(4);
  });

  it.each([false, true])(
    'spectators see all eight boards without controls (phoneOnly=%s)',
    (mode) => {
      const html = phone(state(), 'a-spectator', mode);
      expect(html.match(/role="grid"/g)).toHaveLength(8);
      expect(html).not.toContain('<button');
      for (const player of PLAYERS) expect(html).toContain(player.name);
      expect(html).toContain('First to 2048 wins. At the buzzer, highest score wins.');
    },
  );

  it.each([false, true])(
    'keeps spectator boards in their seats when the score lead changes (phoneOnly=%s)',
    (mode) => {
      const before = state();
      before.racers['racer-0']!.score = 1000;
      before.racers['racer-1']!.score = 900;
      const after: State = {
        ...before,
        racers: {
          ...before.racers,
          'racer-1': { ...before.racers['racer-1']!, score: 1100 },
        },
      };
      expect(game.controllerView(before, 'a-spectator').racers[0]!.rank).toBe(1);
      expect(game.controllerView(after, 'a-spectator').racers[1]!.rank).toBe(1);
      const seatOrder = PLAYERS.map((player) => `${player.name}’s board`);
      for (const snapshot of [before, after]) {
        const html = phone(snapshot, 'a-spectator', mode);
        expect(publicBoardLabels(html)).toEqual(seatOrder);
        expect(html).not.toContain('<button');
      }
    },
  );

  it.each([false, true])(
    'identifies bots and away racers on the public phone stage (phoneOnly=%s)',
    (mode) => {
      const s = state();
      s.players['racer-0']!.bot = true;
      s.players['racer-1']!.connected = false;
      s.players['racer-2']!.bot = true;
      s.racers['racer-2']!.status = 'blocked';
      const cards = publicCards(phone(s, 'a-spectator', mode));
      expect(cards).toHaveLength(8);
      expect(cards[0]).toContain('Bot');
      expect(cards[1]).toContain('Away');
      expect(cards[2]).toContain('Bot');
      expect(cards[2]).toContain('No moves');
      expect(cards[3]).not.toMatch(/Bot|Away/);
    },
  );

  it.each(['reveal', 'done'])('keeps bot identity in the final phone ranking in %s', (phase) => {
    const s = state();
    s.players['racer-0']!.bot = true;
    s.phase = { id: phase, startedAt: 180000, deadline: phase === 'done' ? null : 188000 };
    s.reason = 'clock';
    for (const mode of [false, true]) {
      for (const viewer of ['racer-3', 'a-spectator']) {
        const html = phone(s, viewer, mode);
        const botRow = html
          .match(/<li\b[^>]*>[\s\S]*?<\/li>/g)
          ?.find((row) => row.includes('Racer 1</strong>'));
        expect(botRow).toBeDefined();
        expect(botRow).toContain('Best tile 2 · Bot');
      }
    }
  });

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

describe('2048 TV', () => {
  it('identifies bots, blocked bots and away racers beside their TV boards', () => {
    const s = state();
    s.players['racer-0']!.bot = true;
    s.players['racer-1']!.connected = false;
    s.players['racer-2']!.bot = true;
    s.racers['racer-2']!.status = 'blocked';
    const cards = publicCards(renderToStaticMarkup(<Tv view={{ ...game.tvView(s), vip: null }} />));
    expect(cards).toHaveLength(8);
    expect(cards[0]).toContain('Bot');
    expect(cards[1]).toContain('Away');
    expect(cards[2]).toContain('Bot');
    expect(cards[2]).toContain('No moves');
    expect(cards[3]).toContain('Racing');
    expect(cards[3]).not.toMatch(/Bot|Away/);
  });

  it.each(['play', 'reveal', 'done'])('shows every player and best tile in %s', (phase) => {
    const s = state();
    s.phase = { id: phase, startedAt: 0, deadline: phase === 'done' ? null : 180000 };
    const html = renderToStaticMarkup(<Tv view={{ ...game.tvView(s), vip: null }} />);
    expect(html.match(/role="grid"/g) ?? []).toHaveLength(phase === 'play' ? 8 : 0);
    expect(html.match(/data-tv-map="true"/g) ?? []).toHaveLength(phase === 'play' ? 8 : 0);
    for (const player of PLAYERS) expect(html).toContain(player.name);
    expect(html.match(/Best<\/span>/g)).toHaveLength(8);
    expect(html).not.toContain('<button');
  });
});
