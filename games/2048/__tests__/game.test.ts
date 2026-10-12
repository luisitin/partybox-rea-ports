import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';

const T0 = 1_000_000;
const kit = testKit(game, { t0: T0, players: testPlayers(2), seed: 19 });
const row = (...values: number[]): number[] => [
  ...values,
  ...Array<number>(16 - values.length).fill(0),
];
const blocked = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];

function withBoard(state: State, id: string, board: number[], score = 0): State {
  return {
    ...state,
    racers: { ...state.racers, [id]: { ...state.racers[id]!, board, score } },
  };
}

const move = (
  state: State,
  id: string,
  dir: 'up' | 'down' | 'left' | 'right',
  now = T0 + 500,
): State => kit.input(state, id, { type: 'move', dir, move: state.racers[id]?.moves ?? 0 }, now);

describe('2048 race rules', () => {
  it('opens immediately on identical independent boards with the three-minute clock', () => {
    const state = kit.start();
    expect(state.phase).toEqual({ id: 'play', startedAt: T0, deadline: T0 + 180_000 });
    expect(state.racers.p1?.board).toEqual(state.racers.p2?.board);
    expect(state.racers.p1?.board).not.toBe(state.racers.p2?.board);
    expect(state.racers.p1?.board.filter(Boolean)).toHaveLength(2);
    expect(state.racers.p1).toMatchObject({ score: 0, moves: 0, status: 'racing' });
    expect(game.results(state)).toBeNull();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('adds exactly the merged tile values and one spawn for an accepted move', () => {
    const source = withBoard(kit.start(), 'p1', row(2, 2, 4, 4), 40);
    const state: State = {
      ...source,
      spawns: source.spawns.map((draw, i) =>
        i === 2 ? { slot: 0, value: 2 } : i === 3 ? { slot: 65535, value: 4 } : draw,
      ),
    };
    const next = move(state, 'p1', 'left');
    expect(next.racers.p1?.score).toBe(52);
    expect(next.racers.p1?.moves).toBe(1);
    expect(next.racers.p1?.board.slice(0, 2)).toEqual([4, 8]);
    expect(next.racers.p1?.board).toEqual(row(4, 8, 2));
    expect(next.racers.p1?.board.filter(Boolean)).toHaveLength(3);
    expect(next.racers.p1?.lastAt).toBe(T0 + 500);
    expect(next.racers.p2).toEqual(state.racers.p2);
    expect(state.racers.p1?.board).toEqual(row(2, 2, 4, 4));
  });

  it('does not spawn, score, count, or spend a draw on a direction that changes nothing', () => {
    const state = withBoard(kit.start(), 'p1', row(2, 4, 8, 16));
    const noop = move(state, 'p1', 'left');
    expect(noop).toBe(state);
    expect(move(noop, 'p1', 'down').racers.p1?.board).toEqual(
      move(state, 'p1', 'down').racers.p1?.board,
    );
    expect(noop.rng).toEqual(state.rng);
    expect(noop.spawns).toEqual(state.spawns);
  });

  it('rejects duplicates, future counters, unknown ids and moves faster than 150ms', () => {
    const state = withBoard(kit.start(), 'p1', row(2, 2, 4, 8));
    expect(kit.input(state, 'p1', { type: 'move', dir: 'left', move: 7 }, T0 + 500)).toBe(state);
    for (const id of ['ghost', 'spectator-x', '__proto__', 'constructor'])
      expect(kit.input(state, id, { type: 'move', dir: 'left', move: 0 }, T0 + 500)).toBe(state);
    const first = move(state, 'p1', 'left');
    expect(kit.input(first, 'p1', { type: 'move', dir: 'right', move: 0 }, T0 + 1000)).toBe(first);
    expect(move(first, 'p1', 'right', T0 + 649)).toBe(first);
    expect(move(first, 'p1', 'right', T0 + 650).racers.p1?.moves).toBe(2);
    const capped: State = {
      ...state,
      racers: { ...state.racers, p1: { ...state.racers.p1!, moves: 1200 } },
    };
    expect(move(capped, 'p1', 'left')).toBe(capped);
  });

  it("draws by each player's accepted move count, independent of interleaved input order", () => {
    const state = withBoard(withBoard(kit.start(), 'p1', row(2, 2, 4, 8)), 'p2', row(2, 2, 4, 8));
    const aFirst = move(move(state, 'p1', 'left'), 'p2', 'left', T0 + 900);
    const bFirst = move(move(state, 'p2', 'left'), 'p1', 'left', T0 + 900);
    expect(aFirst.racers.p1?.board).toEqual(aFirst.racers.p2?.board);
    expect(aFirst.racers.p1?.board).toEqual(bFirst.racers.p1?.board);
    expect(aFirst.racers.p2?.board).toEqual(bFirst.racers.p2?.board);
    expect(aFirst.rng).toEqual(bFirst.rng);
    expect(aFirst.spawns).toEqual(bFirst.spawns);
  });

  it('replays byte-identically for the same seed and event sequence', () => {
    const events = [
      {
        type: 'input' as const,
        playerId: 'p1',
        now: T0 + 1000,
        input: { type: 'move' as const, dir: 'left' as const, move: 0 },
      },
      { type: 'player' as const, playerId: 'p2', now: T0 + 2000, connected: false },
      { type: 'vip' as const, action: 'pause' as const, now: T0 + 2500 },
      { type: 'vip' as const, action: 'resume' as const, now: T0 + 5500 },
      { type: 'player' as const, playerId: 'p2', now: T0 + 6000, connected: true },
    ];
    let left = kit.start();
    let right = kit.start();
    for (const event of events) {
      left = game.reduce(left, event);
      right = game.reduce(right, event);
      expect(JSON.stringify(left)).toBe(JSON.stringify(right));
    }
  });

  it('the first 2048 ends every board and wins even against a higher merge score', () => {
    let state = withBoard(kit.start(), 'p1', row(1024, 1024));
    state = withBoard(state, 'p2', row(1024, 512, 256, 128), 32_000);
    const next = move(state, 'p1', 'left');
    expect(next.phase.id).toBe('reveal');
    expect(next.reason).toBe('target');
    expect(next.racers.p1?.status).toBe('finished');
    expect(next.racers.p1?.score).toBe(2048);
    expect(next.phase.deadline).toBeGreaterThanOrEqual(T0 + 500 + 8000);
    const done = kit.timer(next);
    expect(done.phase.id).toBe('done');
    expect(game.results(done)?.winnerIds).toEqual(['p1']);
    expect(game.results(done)?.ranking[0]?.playerId).toBe('p1');
    expect(move(next, 'p2', 'right')).toBe(next);
  });

  it('ends at the clock, rejects late moves, and lets identical highest scores share first', () => {
    let state = withBoard(kit.start(), 'p1', row(2, 2), 48);
    state = withBoard(state, 'p2', row(4, 2), 48);
    const late = move(state, 'p1', 'left', state.phase.deadline!);
    expect(late.phase.id).toBe('reveal');
    expect(late.racers.p1?.score).toBe(48);
    const reveal = kit.timer(state);
    expect(reveal.reason).toBe('clock');
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.phase.deadline! - reveal.phase.startedAt).toBeGreaterThanOrEqual(8000);
    const done = kit.timer(reveal);
    expect(game.results(done)?.winnerIds.sort()).toEqual(['p1', 'p2']);
    expect(game.results(done)?.ranking.map((x) => x.rank)).toEqual([1, 1]);
    expect(kit.timer(done)).toBe(done);
  });

  it('ignores early and stale phase timers', () => {
    const state = kit.start();
    expect(kit.timer(state, state.phase.deadline! - 1)).toBe(state);
    for (const event of [
      { type: 'timer' as const, now: state.phase.deadline!, phaseId: 'reveal', startedAt: T0 },
      { type: 'timer' as const, now: state.phase.deadline!, phaseId: 'play', startedAt: T0 - 1 },
    ])
      expect(game.reduce(state, event)).toBe(state);
  });

  it('holds inputs and timers during pause and preserves the remaining race time on resume', () => {
    const state = withBoard(kit.start(), 'p1', row(2, 2));
    const paused = kit.vip(state, 'pause', T0 + 1000);
    expect(move(paused, 'p1', 'left', T0 + 2500)).toBe(paused);
    expect(kit.timer(paused)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', T0 + 6000);
    expect(resumed.phase.deadline).toBe(state.phase.deadline! + 5000);
    expect(resumed.phase.paused).toBeUndefined();
    expect(move(resumed, 'p1', 'left', T0 + 6500).racers.p1?.moves).toBe(1);
  });

  it('preserves the unspent move cooldown across a pause at the exact boundary', () => {
    const state = move(withBoard(kit.start(), 'p1', row(2, 2, 4)), 'p1', 'left', T0 + 900);
    const paused = kit.vip(state, 'pause', T0 + 1000);
    const resumed = kit.vip(paused, 'resume', T0 + 6000);
    expect(resumed.racers.p1?.lastAt).toBe(T0 + 5900);
    expect(move(resumed, 'p1', 'right', T0 + 6049)).toBe(resumed);
    expect(move(resumed, 'p1', 'right', T0 + 6050).racers.p1?.moves).toBe(2);
  });

  it('preserves a board through refresh and finishes without waiting for disconnected players', () => {
    const state = move(withBoard(kit.start(), 'p1', row(2, 2)), 'p1', 'left');
    const dropped = kit.player(state, 'p1', false);
    expect(dropped.racers.p1).toEqual(state.racers.p1);
    expect(kit.player(dropped, 'p1', true).racers.p1).toEqual(state.racers.p1);
    const disconnected = kit.player(dropped, 'p2', false);
    const done = kit.timer(kit.timer(disconnected));
    expect(done.phase.id).toBe('done');
    expect(Object.keys(game.results(done)!.scores).sort()).toEqual(['p1', 'p2']);
  });

  it('keeps a blocked player on stage while a rival races', () => {
    let state = withBoard(kit.start(), 'p1', [...blocked]);
    state = {
      ...state,
      racers: { ...state.racers, p1: { ...state.racers.p1!, status: 'blocked' } },
    };
    expect(move(state, 'p1', 'left')).toBe(state);
    expect(state.phase.id).toBe('play');
    expect(move(withBoard(state, 'p2', row(2, 2)), 'p2', 'left').phase.id).toBe('play');
  });

  it('ends early once the final live board blocks after a spawn', () => {
    let state = withBoard(kit.start(), 'p1', [...blocked]);
    state = {
      ...state,
      racers: { ...state.racers, p1: { ...state.racers.p1!, status: 'blocked' } },
    };
    state = withBoard(state, 'p2', [2, 2, 8, 16, 8, 16, 4, 8, 4, 8, 2, 4, 8, 16, 4, 8]);
    const reveal = move(state, 'p2', 'left');
    expect(reveal.racers.p2?.status).toBe('blocked');
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.reason).toBe('blocked');
  });

  it('closes when every connected racer blocks even if a disconnected board can still move', () => {
    let state = withBoard(kit.start(), 'p1', [2, 2, 8, 16, 8, 16, 4, 8, 4, 8, 2, 4, 8, 16, 4, 8]);
    state = kit.player(state, 'p2', false, undefined, T0 + 300);
    expect(state.phase.id).toBe('play');
    expect(state.racers.p2?.status).toBe('racing');
    const reveal = move(state, 'p1', 'left', T0 + 500);
    expect(reveal.racers.p1?.status).toBe('blocked');
    expect(reveal.racers.p2?.status).toBe('racing');
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.reason).toBe('blocked');
    expect(reveal.phase.startedAt).toBe(T0 + 500);
    expect(Object.keys(game.results(kit.timer(reveal))!.scores).sort()).toEqual(['p1', 'p2']);
  });

  it('a drop finishes the race when only blocked connected boards remain', () => {
    const source = withBoard(kit.start(), 'p1', [...blocked], 96);
    const state: State = {
      ...source,
      racers: { ...source.racers, p1: { ...source.racers.p1!, status: 'blocked' } },
    };
    const reveal = kit.player(state, 'p2', false, undefined, T0 + 700);
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.reason).toBe('blocked');
    expect(reveal.phase.startedAt).toBe(T0 + 700);
    expect(reveal.racers.p2).toEqual(state.racers.p2);
    expect(reveal.racers.p1?.score).toBe(96);
  });

  it('a drop during pause closes on resume without spending paused time or awaiting the old timer', () => {
    const source = withBoard(kit.start(), 'p1', [...blocked]);
    const state: State = {
      ...source,
      racers: { ...source.racers, p1: { ...source.racers.p1!, status: 'blocked' } },
    };
    const paused = kit.vip(state, 'pause', T0 + 1000);
    const dropped = kit.player(paused, 'p2', false, undefined, T0 + 2000);
    expect(dropped.phase.id).toBe('play');
    expect(dropped.phase.paused).toEqual({ at: T0 + 1000 });
    const reveal = kit.vip(dropped, 'resume', T0 + 6000);
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.reason).toBe('blocked');
    expect(reveal.phase.paused).toBeUndefined();
    expect(reveal.phase.startedAt).toBe(T0 + 6000);
    expect(reveal.phase.deadline).toBeGreaterThanOrEqual(T0 + 14_000);
    expect(
      game.reduce(reveal, { type: 'timer', now: T0 + 180_000, phaseId: 'play', startedAt: T0 }),
    ).toBe(reveal);
  });

  it('rejoining while a rival is active preserves the accepted board and permits the next move', () => {
    const state = move(withBoard(kit.start(), 'p1', row(2, 2, 4)), 'p1', 'left', T0 + 500);
    const dropped = kit.player(state, 'p1', false, undefined, T0 + 1000);
    expect(dropped.phase.id).toBe('play');
    const returned = kit.player(dropped, 'p1', true, undefined, T0 + 1500);
    expect(returned.phase.id).toBe('play');
    expect(returned.racers.p1).toEqual(state.racers.p1);
    expect(move(returned, 'p1', 'right', T0 + 2000).racers.p1?.moves).toBe(2);
  });

  it('a blocked racer rejoining an empty resumed room finishes without waiting for offline rivals', () => {
    const state = move(
      withBoard(kit.start(), 'p1', [2, 2, 8, 16, 8, 16, 4, 8, 4, 8, 2, 4, 8, 16, 4, 8]),
      'p1',
      'left',
      T0 + 500,
    );
    expect(state.racers.p1?.status).toBe('blocked');
    const paused = kit.vip(state, 'pause', T0 + 1000);
    const dropped = kit.player(
      kit.player(paused, 'p1', false, undefined, T0 + 2000),
      'p2',
      false,
      undefined,
      T0 + 2500,
    );
    const resumed = kit.vip(dropped, 'resume', T0 + 6000);
    expect(resumed.phase.id).toBe('play');
    expect(kit.player(resumed, 'spectator-x', true, undefined, T0 + 6200)).toBe(resumed);
    const reveal = kit.player(resumed, 'p1', true, undefined, T0 + 6500);
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.reason).toBe('blocked');
    expect(reveal.phase.startedAt).toBe(T0 + 6500);
    expect(reveal.racers).toEqual(resumed.racers);
    expect(reveal.players.p2?.connected).toBe(false);
    expect(Object.keys(game.results(kit.timer(reveal))!.scores).sort()).toEqual(['p1', 'p2']);
  });

  it('a blocked reconnect while paused stays held and closes only when the VIP resumes', () => {
    const state = move(
      withBoard(kit.start(), 'p1', [2, 2, 8, 16, 8, 16, 4, 8, 4, 8, 2, 4, 8, 16, 4, 8]),
      'p1',
      'left',
      T0 + 500,
    );
    const paused = kit.vip(state, 'pause', T0 + 1000);
    const dropped = kit.player(
      kit.player(paused, 'p1', false, undefined, T0 + 2000),
      'p2',
      false,
      undefined,
      T0 + 2500,
    );
    const returned = kit.player(dropped, 'p1', true, undefined, T0 + 3000);
    expect(returned.phase).toEqual(paused.phase);
    expect(returned.racers).toEqual(state.racers);
    expect(kit.timer(returned)).toBe(returned);
    const reveal = kit.vip(returned, 'resume', T0 + 6000);
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.phase.paused).toBeUndefined();
    expect(reveal.phase.startedAt).toBe(T0 + 6000);
    expect(reveal.reason).toBe('blocked');
    expect(reveal.racers.p1?.board).toEqual(state.racers.p1?.board);
    expect(reveal.racers.p1?.score).toBe(state.racers.p1?.score);
  });

  it('marks the 1200th accepted move blocked while other racers continue', () => {
    const state = withBoard(kit.start(), 'p1', row(2, 2));
    const almost: State = {
      ...state,
      racers: { ...state.racers, p1: { ...state.racers.p1!, moves: 1199 } },
    };
    const next = move(almost, 'p1', 'left');
    expect(next.racers.p1?.moves).toBe(1200);
    expect(next.racers.p1?.status).toBe('blocked');
    expect(next.phase.id).toBe('play');
  });

  it('VIP skip shows the result beat, skip again ends, and VIP end always terminates', () => {
    const state = kit.start();
    const reveal = kit.vip(state, 'skip');
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.reason).toBe('host');
    expect(kit.vip(reveal, 'skip').phase.id).toBe('done');
    expect(kit.vip(state, 'end').phase.id).toBe('done');
    expect(kit.vip(reveal, 'end').phase.id).toBe('done');
  });
});

describe('public views and bots', () => {
  it.each(['play', 'reveal', 'done'] as const)(
    'changing future spawn luck and RNG leaves every public view identical in %s',
    (phase) => {
      const initial = kit.start();
      const reveal = kit.vip(initial, 'skip');
      const state = phase === 'play' ? initial : phase === 'reveal' ? reveal : kit.timer(reveal);
      const privateChange: State = {
        ...state,
        rng: { seed: (state.rng.seed ^ 0x5a5a5a5a) >>> 0, step: state.rng.step + 17 },
        spawns: state.spawns.map((draw, index) =>
          index < 2 ? draw : { slot: 65535 - draw.slot, value: draw.value === 2 ? 4 : 2 },
        ),
      };
      expect(privateChange.rng).not.toEqual(state.rng);
      expect(privateChange.spawns).not.toEqual(state.spawns);
      expect(game.tvView(privateChange)).toEqual(game.tvView(state));
      for (const id of ['p1', 'p2', 'spectator-x'])
        expect(game.controllerView(privateChange, id)).toEqual(game.controllerView(state, id));
    },
  );

  it('publishes completed boards while keeping all future spawns and RNG private', () => {
    const state = kit.start();
    for (const view of [
      game.tvView(state),
      ...['p1', 'p2', 'spectator-x', '__proto__'].map((id) => game.controllerView(state, id)),
    ]) {
      expect(JSON.stringify(view)).not.toContain('"spawns"');
      expect(JSON.stringify(view)).not.toContain('"rng"');
    }
    expect(game.tvView(state).racers).toHaveLength(2);
    expect(game.controllerView(state, 'p1').mine?.board).toEqual(state.racers.p1?.board);
    expect(game.controllerView(state, 'p2').mine?.board).toEqual(state.racers.p2?.board);
    expect(game.controllerView(state, 'spectator-x').mine).toBeNull();
    expect(game.controllerView(state, '__proto__').me.role).toBe('spectator');
  });

  it('phone-only and remote phones see standings and their own board from the first input', () => {
    const state = kit.start({ presence: { mode: 'remote-voice', phoneOnly: true } });
    expect(state.phoneOnly).toBe(true);
    for (const id of ['p1', 'p2', 'spectator-x']) {
      const view = game.controllerView(state, id);
      expect(view.racers).toHaveLength(2);
      expect(view.me.role).toBe(id === 'spectator-x' ? 'spectator' : 'player');
    }
  });

  it.each(['easy', 'normal', 'sharp'] as const)(
    'the %s bot selects a legal move and never reads future luck',
    (skill) => {
      const state = withBoard(kit.start(), 'p1', row(2, 2, 4));
      const rng = createRng(31);
      const input = game.bot.sampleInput(state, 'p1', rng, skill);
      expect(game.inputSchema.safeParse(input).success).toBe(true);
      expect(input?.move).toBe(0);
      expect(move(state, 'p1', input!.dir).racers.p1?.moves).toBe(1);
      const changedLuck = {
        ...state,
        spawns: state.spawns.map((x) => ({
          ...x,
          slot: 65535 - x.slot,
          value: (x.value === 2 ? 4 : 2) as 2 | 4,
        })),
      };
      expect(game.bot.sampleInput(changedLuck, 'p1', createRng(31), skill)).toEqual(
        game.bot.sampleInput(state, 'p1', createRng(31), skill),
      );
      expect(game.bot.sampleInput(state, 'unknown', createRng(31), skill)).toBeNull();
      expect(
        game.bot.sampleInput(withBoard(state, 'p1', [...blocked]), 'p1', createRng(31), skill),
      ).toBeNull();
      expect(game.bot.sampleInput(kit.vip(state, 'skip'), 'p1', createRng(31), skill)).toBeNull();
      expect(game.bot.sampleInput(kit.vip(state, 'pause'), 'p1', createRng(31), skill)).toBeNull();
    },
  );
});
