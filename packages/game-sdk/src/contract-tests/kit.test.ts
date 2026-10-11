import { describe, expect, it } from 'vitest';
import { loadGame, shardIds } from './load';
import { testKit, testPlayers } from './kit';

const { game } = await loadGame('_template');

describe('testPlayers', () => {
  it('seats named players with seat or name ids, the last ones bots', () => {
    const seats = testPlayers(3, { bots: 1 });
    expect(seats.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(seats.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cy']);
    expect(seats.map((p) => p.bot === true)).toEqual([false, false, true]);
    expect(testPlayers(2, { ids: 'name' }).map((p) => p.id)).toEqual(['ana', 'ben']);
    expect(testPlayers(1, { avatar: () => 'owl' })[0]?.avatarId).toBe('owl');
  });
});

describe('testKit', () => {
  const kit = testKit(game, { t0: 5_000, inputAt: 700, settings: { answerSeconds: 20 } });

  it('starts at t0 with the kit defaults, a test overriding them', () => {
    const s = kit.start();
    expect(s.phase.startedAt).toBe(5_000);
    expect(Object.keys(s.players)).toHaveLength(4);
    expect(kit.start({ settings: { answerSeconds: 40 } })).not.toEqual(s);
  });

  it('lands inputs at the default offset, fires the phase timer, walks to a phase', () => {
    const s = kit.start({ players: testPlayers(2) });
    const answered = kit.input(s, 'p1', { type: 'answer', text: 'hi' } as never);
    expect(answered).not.toBe(s);
    const next = kit.timer(s);
    expect(next.phase.id).not.toBe(s.phase.id);
    expect(kit.until(s, next.phase.id).phase.id).toBe(next.phase.id);
    expect(() => kit.until(s, 'nowhere', 5)).toThrow(/never reached nowhere/);
    expect(kit.finish(s).phase.id).toBe(next.phase.id);
  });

  it('sends VIP actions and drops through reduce, and reads the views', () => {
    const s = kit.start({ players: testPlayers(2) });
    expect(kit.vip(s, 'pause').phase.paused).toEqual({ at: 5_000 + 700 }); // t0 + vipAt (= inputAt)
    const dropped = kit.player(s, 'p2', false);
    expect(dropped.players['p2']?.connected).toBe(false);
    expect(kit.tv(s).phaseId).toBe(s.phase.id);
    expect(kit.cv(s, 'p1').me.id).toBe('p1');
  });
});

describe('shardIds (T-0565: the contract suite split over workers)', () => {
  const ids = ['_template', 'bingo', 'chess', 'monopoly', 'uno', 'yahtzee', 'zed'];

  it('keeps every game when there is no shard, or a malformed one', () => {
    for (const spec of [undefined, '', 'x', '0/3', '4/3', '1/0'])
      expect(shardIds(ids, spec)).toEqual(ids);
  });

  it('partitions the games: every one in exactly one shard', () => {
    for (const n of [1, 2, 6, 9]) {
      const all = Array.from({ length: n }, (_, k) => shardIds(ids, `${k + 1}/${n}`)).flat();
      expect([...all].sort()).toEqual([...ids].sort());
    }
  });

  it('puts the heavy games on different shards when there are enough of them', () => {
    const where = (id: string): number =>
      [1, 2, 3, 4].findIndex((k) => shardIds(ids, `${k}/4`).includes(id));
    expect(new Set(['chess', 'yahtzee', 'monopoly'].map(where)).size).toBe(3);
  });
});
