import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { standingsRows } from '../client/standings';
import { clockText, laneStyle, visualTime } from '../client/timing';
import { game } from '../server/index';
import type { State } from '../server/types';
import { ROUND_MS } from '../server/world';

const players = Array.from({ length: 8 }, (_, slot) => ({
  id: `p${slot + 1}`,
  name: `Pilot ${slot + 1}`,
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
const start = (): State => game.init({ players, settings: {}, seed: 13, now: 1000 });
const playing = start();
const scoring = game.reduce(playing, { type: 'vip', now: 1000, action: 'skip' });
const done = game.reduce(scoring, { type: 'vip', now: 1000, action: 'end' });
const phases = { play: playing, score: scoring, done };

type Mode = 'tv' | 'phone-only' | 'remote';
function phone(state: State, id: string, mode: Mode): string {
  const stage: State =
    mode === 'phone-only'
      ? { ...state, phoneOnly: true }
      : mode === 'remote'
        ? {
            ...state,
            players: Object.fromEntries(
              Object.entries(state.players).map(([pid, player]) => [
                pid,
                { ...player, canSeeTv: false },
              ]),
            ),
          }
        : state;
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={mode === 'phone-only'}>
      <Controller
        view={{ ...game.controllerView(stage, id), vip: null }}
        me={stage.players[id] ?? { id, name: 'Spectator', avatarId: 'fox' }}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}
function tv(state: State): string {
  return renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
}
const elements = (html: string, tag: string): number =>
  (html.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length;

describe.each(Object.entries(phases))('%s screens', (phase, state) => {
  it('TV server rendering shows eight numbered lanes and visible vector courses', () => {
    const html = tv(state);
    expect(elements(html, 'svg')).toBe(8);
    expect(elements(html, 'section')).toBe(8);
    expect(html).toContain('viewBox="0 0 140 100"');
    for (const player of players) expect(html).toContain(player.name);
    for (let lane = 1; lane <= 8; lane++) expect(html).toContain(`Lane ${lane}:`);
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('<button');
    if (phase === 'play') expect(html).toContain('role="timer"');
    else expect(html).toMatch(/ wins!|A tie at the top!|Round 1 complete/);
  });

  it.each<Mode>(['tv', 'phone-only', 'remote'])(
    '%s player has a readable complete roster and correct stage',
    (mode) => {
      const html = phone(state, 'p1', mode);
      expect(elements(html, 'li')).toBe(8);
      for (const player of players) expect(html).toContain(player.name);
      expect(elements(html, 'svg')).toBe(mode === 'tv' ? 0 : 1);
      expect(elements(html, 'button')).toBe(phase === 'play' ? 1 : 0);
      if (phase === 'play') {
        expect(html).toContain('TAP TO FLAP');
        expect(html).toContain('Round 1 of 3');
        expect(html).toContain('Lane 1');
      } else expect(html).toMatch(/total|points/);
      if (mode !== 'tv') expect(html).not.toMatch(/Watch the stage|Look at the TV|on the TV/);
    },
  );

  it.each<Mode>(['tv', 'phone-only', 'remote'])(
    '%s spectator sees all stage lanes without inputs',
    (mode) => {
      const html = phone(state, 'spectator', mode);
      expect(elements(html, 'svg')).toBe(8);
      expect(elements(html, 'section')).toBe(8);
      for (const player of players) expect(html).toContain(player.name);
      expect(html).not.toContain('<button');
      expect(html).not.toContain('TAP TO FLAP');
      expect(html).not.toMatch(/Look at the TV|on the TV/);
    },
  );
});

describe('controller input availability and readable feedback', () => {
  it('a dead player has no flap control in either room, but can still watch the local course', () => {
    const state: State = {
      ...playing,
      world: {
        ...playing.world,
        checked: 100,
        birds: playing.world.birds.map((bird) =>
          bird.id === 'p1' ? { ...bird, died: 100 } : bird,
        ),
      },
    };
    for (const mode of ['tv', 'phone-only', 'remote'] as const) {
      const html = phone(state, 'p1', mode);
      expect(html).toContain('You crashed');
      expect(html).toContain('7 of 8 flying');
      expect(html).not.toContain('<button');
      expect(html).toContain('OUT');
      expect(elements(html, 'svg')).toBe(mode === 'tv' ? 0 : 1);
    }
  });

  it('pause leaves the flight visible and disables the existing control', () => {
    const paused = game.reduce(playing, { type: 'vip', action: 'pause', now: 1000 });
    const html = phone(paused, 'p1', 'phone-only');
    expect(html).toContain('<svg');
    expect(html).toContain('disabled=""');
  });

  it('hostile player names stay escaped on TV and both phone surfaces', () => {
    const name = '<script>alert(1)</script>&"';
    const state: State = {
      ...playing,
      players: { ...playing.players, p1: { ...playing.players.p1!, name } },
    };
    for (const html of [
      tv(state),
      phone(state, 'p1', 'tv'),
      phone(state, 'p1', 'phone-only'),
      phone(state, 'spectator', 'tv'),
    ]) {
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
    }
  });

  it('shared winners receive a shared-win sentence on their phone', () => {
    expect(phone(done, 'p1', 'tv')).toContain('You share the win!');
  });
});

describe('client geometry and lane identity', () => {
  it('bounds extrapolation to one pushed beat and to the round cap', () => {
    expect(visualTime(1000, 800, 2000, false)).toBe(900);
    expect(visualTime(1000, 800, 1700, false)).toBe(700);
    expect(visualTime(1000, 800, 100_000, false)).toBe(900);
    expect(visualTime(1000, ROUND_MS - 20, 100_000, false)).toBe(ROUND_MS);
    expect(visualTime(1000, 800, 2000, true)).toBe(800);
    expect(visualTime(1000, 0, 900, false)).toBe(0);
  });

  it('uses token colours and rounds the clock upward without going negative', () => {
    expect(laneStyle(0)).toEqual({ '--pb-lane': 'var(--pb-player-1)' });
    expect(laneStyle(7)).toEqual({ '--pb-lane': 'var(--pb-player-8)' });
    expect(clockText(45_000)).toBe('0:45');
    expect(clockText(1001)).toBe('0:02');
    expect(clockText(-1)).toBe('0:00');
  });

  it('keeps lane numbers when sorting totals and reflects death without an arena', () => {
    const view = {
      ...game.controllerView(playing, 'p1'),
      mine: { ...playing.world.birds[0]!, died: 100 },
      scores: { p1: 1, p2: 4 },
    };
    const rows = standingsRows(view, 'p1', true);
    expect(rows[0]).toMatchObject({ id: 'p2', slot: 1, total: 4 });
    expect(rows.find((row) => row.me)).toMatchObject({ id: 'p1', slot: 0, out: true });
  });
});
