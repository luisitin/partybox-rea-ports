// Static surface checks cover accessibility, held clocks, spectator safety and the phone stage.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';
import { Controller } from './Controller';
import { TileGrid } from './TileGrid';
import { Tv } from './Tv';
import { clockText, secondsLeft, visibleNotes } from './timing';

const players = testPlayers(8);
const kit = testKit(game, { t0: 1_000_000, players });
function phone(state: State, id = 'p1', phoneOnly = false, paused = true): string {
  const view = {
    ...game.controllerView(state, id),
    vip: null,
    paused,
    clockHeldAt: state.began + (state.phase.id === 'play' ? 1250 : 0),
  };
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller view={view} me={players[0]!} send={() => undefined} />
    </PhoneOnlyProvider>,
  );
}

describe('Tile Tempo surfaces', () => {
  it('only exposes four buttons in the current bottom row, with accessible note labels', () => {
    const html = renderToStaticMarkup(
      <TileGrid notes={[2, 0, 3, 1]} row={7} enabled tap={() => undefined} />,
    );
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Note tile, column 3"');
    expect(html).toContain('aria-label="Blank tile, column 1"');
    expect(html.match(/aria-hidden="true" role/g) ?? []).toHaveLength(0);
    expect(visibleNotes([2, 0, 3, 1]).at(-1)).toEqual({ column: 2, ahead: 0 });
  });

  it('keeps disclosed next notes focusable and disables controls once all known notes were tapped', () => {
    const html = renderToStaticMarkup(
      <TileGrid notes={[2, null, null, null]} row={7} enabled tap={() => undefined} />,
    );
    expect(html).not.toContain('disabled=""');
    const waiting = renderToStaticMarkup(
      <TileGrid notes={[null, null, null, null]} row={8} enabled={false} tap={() => undefined} />,
    );
    expect(waiting.match(/disabled=""/g)).toHaveLength(4);
    expect(waiting).not.toContain('Note tile');
  });

  it('shows all eight players on the phone stage and freezes the displayed timer on pause', () => {
    const html = phone(kit.timer(kit.start()), 'p1', true);
    for (const p of players) expect(html).toContain(p.name);
    expect(html).toContain('0:29');
    expect(html).toContain('Paused · your row is held');
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html.match(/disabled=""/g)).toHaveLength(4);
    expect(html).not.toContain('TV');
  });

  it('shows the remote stage without relying on the room context', () => {
    const state = kit.timer(kit.start());
    const remote = {
      ...state,
      players: { ...state.players, p1: { ...state.players['p1']!, canSeeTv: false } },
    };
    const html = phone(remote);
    for (const p of players) expect(html).toContain(p.name);
    expect(html).toContain('Standings · tiles');
  });

  it('spectators and failed runners see the race without controls', () => {
    const state = kit.timer(kit.start());
    const spectator = phone(state, 'spectator', true);
    expect(spectator).toContain('Watch the race');
    expect(spectator).not.toContain('<button');
    const failed = kit.input(
      state,
      'p1',
      { type: 'tap', column: (state.sequence[0]! + 1) % 4, row: 0 },
      state.began + 100,
    );
    const out = phone(failed, 'p1', false, false);
    expect(out).toContain('Wrong tile. Your tiles still count.');
    expect(out).not.toContain('<button');
    for (const p of players) expect(out).toContain(p.name);
  });

  it('TV exposes totals and word statuses, with a clock held at the same time', () => {
    const state = kit.timer(kit.start());
    const html = renderToStaticMarkup(
      <Tv
        view={{ ...game.tvView(state), vip: null, paused: true, clockHeldAt: state.began + 1250 }}
      />,
    );
    for (const p of players) expect(html).toContain(p.name);
    expect(html).toContain('0:29');
    expect(html).toContain('Playing');
    expect(html).toContain('tiles/s');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Note tile');
  });

  it('ranks final rows by count and gives tied leaders the same headline', () => {
    let state = kit.timer(kit.start());
    state = kit.input(
      state,
      'p8',
      { type: 'tap', column: state.sequence[0]!, row: 0 },
      state.began + 100,
    );
    state = kit.vip(state, 'skip', state.began + 200);
    const html = phone(state);
    expect(html).toContain(`${players[7]!.name} wins!`);
    expect(html.indexOf(`title="${players[7]!.name}"`)).toBeLessThan(
      html.indexOf(`title="${players[0]!.name}"`),
    );
    const tied = phone(kit.vip(kit.timer(kit.start()), 'skip'));
    expect(tied).toContain('A tie at the top!');
  });
});

describe('race clock and acknowledgement identity', () => {
  it('rounds up held time and clamps expiration', () => {
    expect(clockText(secondsLeft(30_000, 1250))).toBe('0:29');
    expect(clockText(secondsLeft(30_000, 30_001))).toBe('0:00');
    expect(secondsLeft(null, 1000)).toBe(0);
  });
});
