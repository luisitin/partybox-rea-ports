// Real initial identities must retain result entries, including JavaScript property names.
import { expect, it } from 'vitest';
import { game } from '../server/index';

it('keeps every legitimate initial identity in views, connection events and results', () => {
  const ids = ['__proto__', 'constructor', 'toString', 'ordinary'];
  let state = game.init({
    players: ids.map((id) => ({ id, name: id, avatarId: 'fox', connected: true })),
    seed: 16,
    settings: {},
    now: 1000,
  });
  state = {
    ...state,
    towers: state.towers.map((tower, i) => ({ ...tower, best: i + 1 })),
    scores: Object.fromEntries(ids.map((id, i) => [id, i + 1])),
  };
  for (const id of ids) {
    expect(game.controllerView(state, id).me.role).toBe('player');
    expect(game.controllerView(state, id).tower?.id).toBe(id);
    state = game.reduce(state, {
      type: 'player',
      now: 2000,
      playerId: id,
      connected: false,
      gone: 'left',
    });
    expect(state.players[id]?.connected).toBe(false);
  }
  state = game.reduce(state, { type: 'vip', now: 3000, action: 'end' });
  const results = game.results(state)!;
  expect(Object.keys(results.scores).sort()).toEqual([...ids].sort());
  expect(results.ranking.map((row) => row.playerId).sort()).toEqual([...ids].sort());
  expect(results.scores['__proto__']).toBe(1);
  expect(JSON.parse(JSON.stringify(results))).toEqual(results);
});
