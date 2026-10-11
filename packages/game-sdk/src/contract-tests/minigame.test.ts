// ADR-087: every game that declares `manifest.minigame` runs as a minigame in each mode it lists,
// headless: card → howto → countdown → play → finish → result → done, cpu seats acted by the wrapper.
import { beforeAll, describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/shared';
import type { MinigameMode, PlayerInfo } from '@partybox/shared';
import {
  minigameController,
  minigameGames,
  minigameReduce,
  minigameStart,
  minigameTv,
} from '../index';
import type { MinigameInput, MinigameState } from '../index';
import { rngOver } from '../minigame/safe';
import { loadAllGames } from './load';
import type { LoadedGame } from './load';
import { T0, makePlayers } from './play';

const MAX_EVENTS = 4000;

function teamsFor(mode: MinigameMode, ids: string[]): string[][] {
  if (mode === 'duel') return [[ids[0] as string], [ids[1] as string]];
  if (mode === '2v2') return [ids.slice(0, 2), ids.slice(2, 4)];
  if (mode === '1v3') return [ids.slice(0, 1), ids.slice(1, 4)];
  return [];
}

const seatsFor = (mode: MinigameMode, min: number, max: number): number =>
  Math.min(max, Math.max(min, mode === 'duel' ? 2 : mode === 'ffa' ? 4 : 4));

interface Run {
  mg: MinigameState;
  events: number;
  playMs: number;
}

/** Drives the wrapper by its own wake times until it is done; `humans` tap Ready on the howto. */
function drive(load: LoadedGame, mode: MinigameMode, humans: boolean, help: boolean): Run {
  const m = load.game.manifest;
  const n = seatsFor(mode, m.minPlayers, m.maxPlayers);
  const players: PlayerInfo[] = makePlayers(n).map((p) => ({ ...p, bot: !humans }));
  const teams = teamsFor(
    mode,
    players.map((p) => p.id),
  );
  let mg = minigameStart(load.game, { players, mode, teams, seed: 11, now: T0, help });
  let events = 0;
  let now = T0;
  while (mg.stage !== 'done' && events++ < MAX_EVENTS) {
    const at = mg.phase.deadline;
    expect(at, `${m.id} ${mode}: stage ${mg.stage} left no wake`).not.toBeNull();
    now = Math.max(now, at as number);
    if (humans && mg.stage === 'howto')
      for (const p of players)
        mg = minigameReduce(load.game, mg, inputOf(now, p.id, { mg: 'ready' }));
    mg = minigameReduce(load.game, mg, {
      type: 'timer',
      now,
      phaseId: mg.phase.id,
      startedAt: mg.phase.startedAt,
    });
    for (const p of players) {
      minigameController(load.game, mg, p.id);
      expect(JSON.stringify(mg).length).toBeLessThan(256 * 1024);
    }
    minigameTv(load.game, mg);
  }
  return { mg, events, playMs: mg.playStartedAt === null ? 0 : now - mg.playStartedAt };
}

const inputOf = (now: number, playerId: string, input: MinigameInput) =>
  ({ type: 'input', now, playerId, input }) as const;

let loaded: LoadedGame[] = [];
// Loading every game's code takes longer than the default hook limit on a busy machine.
beforeAll(async () => {
  loaded = (await loadAllGames()).filter((g) => g.game.manifest.minigame);
}, 120_000);

describe('minigame wrapper', () => {
  it('at least one game ships a minigame spec', () => {
    expect(loaded.length).toBeGreaterThan(0);
  });

  it('runs every listed mode to a ranked result, deterministically, within its cap', () => {
    for (const load of loaded) {
      const spec = load.game.manifest.minigame;
      if (!spec) continue;
      for (const mode of spec.modes) {
        const a = drive(load, mode, false, true);
        const label = `${load.id} ${mode}`;
        expect(a.mg.stage, label).toBe('done');
        expect(a.mg.broken, label).toBe(false);
        const r = a.mg.result;
        expect(r, label).not.toBeNull();
        if (!r) continue;
        const ids = a.mg.players.map((p) => p.id).sort();
        expect(r.ranking.map((x) => x.playerId).sort(), label).toEqual(ids);
        for (const row of r.ranking) expect(Number.isFinite(row.rank), label).toBe(true);
        for (const id of r.winnerIds) expect(ids, label).toContain(id);
        if (mode === 'ffa') expect(r.winningTeam, label).toBeNull();
        else expect([0, 1, null], label).toContain(r.winningTeam);
        expect(a.playMs, label).toBeLessThanOrEqual(spec.seconds * 1300 + 1);
        const b = drive(load, mode, false, true);
        expect(JSON.stringify(b.mg), `${label} is deterministic`).toBe(JSON.stringify(a.mg));
      }
    }
  });

  it('the pool covers every mode a board draws by space colour (T-0578)', () => {
    const defs = loaded.map((l) => l.game);
    expect(defs.length).toBeGreaterThanOrEqual(8);
    const seats = { ffa: 4, duel: 2, '2v2': 4, '1v3': 4 } as const;
    for (const mode of ['ffa', 'duel', '2v2', '1v3'] as const)
      expect(minigameGames(defs, mode, seats[mode]).length, mode).toBeGreaterThanOrEqual(4);
  });

  it('boss games stay out of the ordinary pool and come only when asked (T-0597)', () => {
    const defs = loaded.map((l) => l.game);
    const bosses = defs.filter((d) => d.manifest.minigame?.category === 'boss');
    expect(bosses.length).toBeGreaterThanOrEqual(5);
    for (const mode of ['ffa', 'duel', '2v2', '1v3'] as const) {
      const ordinary = minigameGames(defs, mode, 4);
      for (const b of bosses) expect(ordinary, mode).not.toContain(b);
      const ids = (list: typeof defs): string[] => list.map((d) => d.manifest.id).sort();
      expect(ids(minigameGames(defs, mode, 4, 'boss')), mode).toEqual(ids(bosses));
    }
  });

  it('duel games stay out of every ordinary pool and come only when asked for a duel (T-0600)', () => {
    const defs = loaded.map((l) => l.game);
    const duels = defs.filter((d) => d.manifest.minigame?.category === 'duel');
    expect(duels.length).toBeGreaterThanOrEqual(5);
    const ids = (list: typeof defs): string[] => list.map((d) => d.manifest.id).sort();
    for (const d of duels) expect(d.manifest.minigame?.modes, d.manifest.id).toEqual(['duel']);
    for (const mode of ['ffa', 'duel', '2v2', '1v3'] as const)
      for (const d of duels) expect(minigameGames(defs, mode, 2), mode).not.toContain(d);
    expect(ids(minigameGames(defs, 'duel', 2, 'duel'))).toEqual(ids(duels));
    expect(minigameGames(defs, 'ffa', 4, 'duel')).toEqual([]);
  });

  it('categorised games (coin, showdown, survivathon, rhythm, mouse, bowser-live, kaboom-squad) stay out of every ordinary pool and come by category (T-0603)', () => {
    const defs = loaded.map((l) => l.game);
    for (const category of [
      'coin',
      'showdown',
      'survivathon',
      'rhythm',
      'mouse',
      'bowser-live',
      'kaboom-squad',
    ] as const) {
      const group = defs.filter((d) => d.manifest.minigame?.category === category);
      for (const mode of ['ffa', 'duel', '2v2', '1v3'] as const)
        for (const d of group) expect(minigameGames(defs, mode, 4), d.manifest.id).not.toContain(d);
      for (const d of group) {
        const m = d.manifest;
        expect(minigameGames(defs, m.minigame!.modes[0]!, m.minPlayers, category)).toContain(d);
      }
    }
  });

  it('waits on humans for Ready, then goes without help straight to the count', () => {
    for (const load of loaded) {
      const spec = load.game.manifest.minigame;
      if (!spec) continue;
      const mode = spec.modes[0] as MinigameMode;
      expect(drive(load, mode, true, true).mg.stage, load.id).toBe('done');
      expect(drive(load, mode, false, false).mg.stage, load.id).toBe('done');
    }
  });

  it('the instruction screen demo plays itself, deterministically, until a human taps (T-0618 F7)', () => {
    const timerAt = (load: LoadedGame, mg: MinigameState): MinigameState =>
      minigameReduce(load.game, mg, {
        type: 'timer',
        now: mg.phase.deadline as number,
        phaseId: mg.phase.id,
        startedAt: mg.phase.startedAt,
      });
    // Four seats, the first a person; to the how-to stage, then `beats` more wakes of the demo.
    const howto = (load: LoadedGame, beats: number): MinigameState => {
      const players: PlayerInfo[] = makePlayers(4).map((p, i) => ({ ...p, bot: i > 0 }));
      let mg = minigameStart(load.game, {
        players,
        mode: 'ffa',
        teams: [],
        seed: 11,
        now: T0,
        help: true,
      });
      mg = timerAt(load, mg);
      expect(mg.stage, load.id).toBe('howto');
      for (let i = 0; i < beats && mg.stage === 'howto'; i++) mg = timerAt(load, mg);
      return mg;
    };
    const demoGames = loaded.filter((l) => l.game.manifest.minigame?.practice);
    expect(demoGames.length).toBeGreaterThan(0);
    let moved = 0;
    for (const load of demoGames) {
      const start = howto(load, 0);
      expect(start.demo, load.id).not.toBeNull();
      expect(start.botAt, load.id).not.toBeNull();
      expect(start.demoTouched, load.id).toBe(false);
      const later = howto(load, 4);
      if (later.stage === 'howto' && JSON.stringify(later.demo) !== JSON.stringify(start.demo))
        moved++;
      // The same seed and the same wakes give the same demo.
      expect(JSON.stringify(howto(load, 4)), load.id).toBe(JSON.stringify(later));
      // A person taps the practice pad: the demo stops playing for the person's seat, the cpu seats go on.
      const sample = load.game.bot.sampleInput(start.demo, 'p1', rngOver(seedRng(5)));
      if (sample === null || sample === undefined) continue;
      let touched = minigameReduce(
        load.game,
        start,
        inputOf(T0 + 3500, 'p1', { mg: 'input', input: sample }),
      );
      expect(touched.demoTouched, load.id).toBe(true);
      const beatAt = touched.botAt as number;
      // A game's own ticks can wake the demo before the next cpu beat: wake until the beat has come round.
      for (
        let i = 0;
        i < 60 && touched.stage === 'howto' && (touched.botAt as number) <= beatAt;
        i++
      )
        touched = timerAt(load, touched);
      expect(touched.demoTouched, load.id).toBe(true);
      expect(touched.botAt as number, load.id).toBeGreaterThan(beatAt);
    }
    // At least one game's demo has visibly moved under the bots (a quiet first beat is allowed).
    expect(moved).toBeGreaterThan(0);
  });

  it('is total: junk events change nothing and never throw', () => {
    const load = loaded[0];
    if (!load) return;
    const players = makePlayers(4).map((p) => ({ ...p, bot: true }));
    const mg = minigameStart(load.game, { players, mode: 'ffa', seed: 3, now: T0, help: true });
    const junk = [
      null,
      {},
      { type: 'input', now: Number.NaN, playerId: 'p1', input: { mg: 'ready' } },
      { type: 'input', now: T0, playerId: 'ghost', input: { mg: 'ready' } },
      { type: 'input', now: T0, playerId: 'p1', input: 7 },
      { type: 'vip', now: T0, action: 'dance' },
      { type: 'player', now: T0, playerId: 7, connected: 'yes' },
    ];
    for (const e of junk) {
      const next = minigameReduce(load.game, mg, e as never);
      expect(JSON.stringify(next.stage)).toBe(JSON.stringify(mg.stage));
    }
  });

  it('a game without a minigame spec ends as an all-tied draw, never a crash', () => {
    const load = loaded[0];
    if (!load) return;
    const bare = { ...load.game, manifest: { ...load.game.manifest, minigame: undefined } };
    const players = makePlayers(4);
    const mg = minigameStart(bare, { players, mode: 'ffa', seed: 1, now: T0, help: false });
    expect(mg.broken).toBe(true);
    expect(mg.result?.winnerIds).toEqual([]);
    expect(mg.result?.ranking).toHaveLength(4);
  });

  it('a VIP pause holds the play clock: the time left reads the same after the resume (T-0948)', () => {
    for (const load of loaded) {
      const m = load.game.manifest;
      for (const mode of m.minigame?.modes ?? []) {
        const label = `${load.id} ${mode}`;
        const n = seatsFor(mode, m.minPlayers, m.maxPlayers);
        const players: PlayerInfo[] = makePlayers(n).map((p) => ({ ...p, bot: true }));
        const teams = teamsFor(
          mode,
          players.map((p) => p.id),
        );
        let mg = minigameStart(load.game, { players, mode, teams, seed: 11, now: T0, help: true });
        let now = T0;
        // The play stage starts at the wake that ends the count; the cpu seats play on their own clock.
        for (let i = 0; i < MAX_EVENTS && mg.stage !== 'play' && mg.stage !== 'done'; i++) {
          expect(mg.phase.deadline, `${label}: stage ${mg.stage} left no wake`).not.toBeNull();
          now = Math.max(now, mg.phase.deadline as number);
          mg = minigameReduce(load.game, mg, {
            type: 'timer',
            now,
            phaseId: mg.phase.id,
            startedAt: mg.phase.startedAt,
          });
        }
        expect(mg.stage, label).toBe('play');
        const tvLeft = (): number => (minigameTv(load.game, mg).stageEnds as number) - now;
        const phoneLeft = (): number =>
          (minigameController(load.game, mg, players[0]?.id ?? '').stageEnds as number) - now;
        const tv0 = tvLeft();
        const phone0 = phoneLeft();
        mg = minigameReduce(load.game, mg, { type: 'vip', now, action: 'pause' });
        now += 5000;
        mg = minigameReduce(load.game, mg, { type: 'vip', now, action: 'resume' });
        expect(tvLeft(), `${label}: the TV clock jumped on resume`).toBe(tv0);
        expect(phoneLeft(), `${label}: the phone clock jumped on resume`).toBe(phone0);
        for (let i = 0; i < MAX_EVENTS && mg.stage !== 'done'; i++) {
          expect(mg.phase.deadline, `${label}: stage ${mg.stage} left no wake`).not.toBeNull();
          now = Math.max(now, mg.phase.deadline as number);
          mg = minigameReduce(load.game, mg, {
            type: 'timer',
            now,
            phaseId: mg.phase.id,
            startedAt: mg.phase.startedAt,
          });
        }
        expect(mg.stage, label).toBe('done');
        expect(mg.broken, label).toBe(false);
      }
    }
  });
});
