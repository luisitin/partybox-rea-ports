import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { directionRequest } from './controls';
import { DirectionPad } from './DirectionPad';

it('blocks a real U-turn before a queued turn moves, then enables it after the tick', () => {
  const kit = testKit(game, { players: testPlayers(2), t0: 1_000_000 });
  let state = kit.timer(kit.start());
  state = kit.input(state, 'p1', { type: 'direction', dir: 0 }, state.began + 1);
  state = kit.timer(state);
  state = kit.input(state, 'p1', { type: 'direction', dir: 1 }, state.began + 220);
  const view = { ...game.controllerView(state, 'p1'), vip: null };
  expect([view.movingDir, view.dir]).toEqual([0, 1]);
  expect(directionRequest(view, 2)).toBeNull();
  expect(directionRequest(view, 1)).toEqual({ type: 'direction', dir: 1 });
  expect(directionRequest(view, 3)).toEqual({ type: 'direction', dir: 3 });
  const html = renderToStaticMarkup(<DirectionPad view={view} send={() => undefined} />);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Go down"/);
  expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="Go left"/);
  expect(kit.input(state, 'p1', { type: 'direction', dir: 2 }, state.began + 230).world).toEqual(
    state.world,
  );
  state = kit.timer(state);
  const moved = game.controllerView(state, 'p1');
  expect([moved.movingDir, moved.dir]).toEqual([1, 1]);
  expect(directionRequest(moved, 2)).toEqual({ type: 'direction', dir: 2 });
  expect(game.tvView(state).runners[0]?.movingDir).toBe(1);
});

it('preserves a rapid turn cancellation before the new queued view arrives', () => {
  const kit = testKit(game, { players: testPlayers(2), t0: 1_000_000 });
  const start = kit.timer(kit.start());
  const stale = game.controllerView(start, 'p1');
  const up = directionRequest(stale, 0);
  expect(up).not.toBeNull();
  const queued = kit.input(start, 'p1', up!, start.began + 1);
  const cancel = directionRequest(stale, 1);
  expect(cancel).not.toBeNull();
  const cancelled = kit.input(queued, 'p1', cancel!, start.began + 2);
  expect(cancelled.world.runners[0]?.queued).toBe(1);
  expect(kit.timer(cancelled).world.runners[0]?.cell).toBe(start.world.runners[0]!.cell + 1);
});
