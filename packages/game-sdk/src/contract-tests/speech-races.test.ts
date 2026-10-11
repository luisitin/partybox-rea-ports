// T-0221: speech timing races, as properties (fast-check). PT-003, PT-302 and PT-105/T-0156 were
// all ordering bugs: a reading made before, after or instead of a timer, a VIP skip, a pause or the
// next phase. Every game that asks for readings is driven from real mid-game states through random
// interleavings of those events, the way the host can deliver them, and must stay pure, calm and
// live. Game-agnostic, like contract.test.ts: it only knows GameDefinition and `speech(state)`.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AnyGameDefinition, GameEvent, GameStateBase, Settings } from '@partybox/shared';
import { createRng } from '@partybox/shared';
import { hashState } from './hash';
import { loadAllGames } from './load';
import { finishGame, playGame } from './play';

const games = (await loadAllGames()).filter((g) => typeof g.game.speech === 'function');
/** The longest a reading event may hold the phase past its own length (VOICE_WAIT is 12 s). */
const HOLD_CAP_MS = 30_000;
const RUNS = 60;

interface Start {
  state: GameStateBase;
  now: number;
}

const wanted = (game: AnyGameDefinition, state: GameStateBase): string[] =>
  (game.speech?.(state) ?? []).map((r) => r.key);

/** A reader that reads: the game's default, else its first voice (Blind Auction ships silent). */
function readerOf(game: AnyGameDefinition): Settings {
  const spec = game.manifest.settings.find((s) => s.key === 'reader');
  if (!spec || spec.default !== 'none' || spec.type !== 'select') return {};
  const voice = spec.options.map((o) => o.value).find((v) => v !== 'none');
  return voice === undefined ? {} : { reader: voice };
}

/** Mid-game states that ask for a reading, from a few played games. */
function startsOf(game: AnyGameDefinition): Start[] {
  const { minPlayers, maxPlayers } = game.manifest;
  const settings = readerOf(game);
  const out: Start[] = [];
  for (const [seed, players] of [
    [1, minPlayers],
    [2, Math.min(maxPlayers, minPlayers + 2)],
  ] as const) {
    playGame(game, {
      players,
      seed,
      strategy: 'random',
      settings,
      maxSimMs: game.manifest.estimatedMinutes * 3 * 60_000,
      onEvent: (event, state) => {
        if (game.results(state) === null && wanted(game, state).length > 0)
          out.push({ state, now: event.now });
      },
    });
  }
  // Spread over the game, at most 40.
  const step = Math.max(1, Math.floor(out.length / 40));
  return out.filter((_, i) => i % step === 0);
}

type Step =
  | { k: 'input'; who: number; dt: number }
  | { k: 'start'; pick: number; dt: number }
  | { k: 'clip'; pick: number; ms: number; dt: number }
  | { k: 'timer'; dt: number }
  | { k: 'staleTimer'; dt: number }
  | { k: 'vip'; action: 'pause' | 'resume' | 'skip'; dt: number };

const dt = fc.integer({ min: 0, max: 4000 });
const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({ k: fc.constant('input' as const), who: fc.nat(), dt }),
  fc.record({ k: fc.constant('start' as const), pick: fc.nat(), dt }),
  fc.record({
    k: fc.constant('clip' as const),
    pick: fc.nat(),
    ms: fc.oneof(fc.constant(-1), fc.constant(0), fc.integer({ min: 1, max: 20_000 })),
    dt,
  }),
  fc.record({ k: fc.constant('timer' as const), dt }),
  fc.record({ k: fc.constant('staleTimer' as const), dt }),
  fc.record({
    k: fc.constant('vip' as const),
    action: fc.constantFrom('pause' as const, 'resume' as const, 'skip' as const),
    dt,
  }),
);

interface Run {
  events: GameEvent<unknown>[];
  states: GameStateBase[];
}

/**
 * Plays `steps` from `start` the way the host can deliver them: time never runs backwards, a timer
 * fires at its deadline and before anything later, a reading lands for a key asked for now or earlier (a stale one),
 * and every event is checked against the one before it.
 */
function drive(game: AnyGameDefinition, start: Start, steps: Step[], seed: number): Run {
  const rng = createRng(seed);
  const ids = Object.keys(start.state.players);
  const asked = new Set<string>();
  const phases: { id: string; startedAt: number }[] = [];
  let state = start.state;
  let now = start.now;
  const events: GameEvent<unknown>[] = [];
  const states: GameStateBase[] = [];
  const apply = (event: GameEvent<unknown>, keys: string[]): void => {
    const before = state;
    state = game.reduce(before, event);
    events.push(event);
    states.push(state);
    checkStep(game, before, state, event, keys);
    if (before.phase.id !== state.phase.id || before.phase.startedAt !== state.phase.startedAt)
      phases.push({ id: before.phase.id, startedAt: before.phase.startedAt });
  };
  for (const s of steps) {
    now += s.dt;
    // The host fires a timer at its deadline, so nothing reaches a phase after its deadline
    // passed (review F1: a reading at a later now than a live deadline is not a real ordering).
    for (let due = 0; due < 20 && game.results(state) === null; due++) {
      const { deadline, paused, id, startedAt } = state.phase;
      if (deadline === null || paused || deadline >= now) break;
      apply({ type: 'timer', now: deadline, phaseId: id, startedAt }, wanted(game, state));
    }
    if (game.results(state) !== null) break;
    const keys = wanted(game, state);
    for (const key of keys) asked.add(key);
    const everAsked = [...asked];
    const { phase } = state;
    let event: GameEvent<unknown> | null = null;
    if (s.k === 'input') {
      const playerId = ids[s.who % ids.length] as string;
      const input = game.bot.sampleInput(state, playerId, rng);
      const parsed = input === null ? null : game.inputSchema.safeParse(input);
      if (parsed?.success) event = { type: 'input', now, playerId, input: parsed.data };
    } else if (s.k === 'start' && everAsked.length > 0) {
      event = { type: 'speechStart', now, key: everAsked[s.pick % everAsked.length] as string };
    } else if (s.k === 'clip' && everAsked.length > 0) {
      const key = everAsked[s.pick % everAsked.length] as string;
      event = { type: 'speech', now, key, ms: s.ms };
    } else if (s.k === 'timer' && phase.deadline !== null && !phase.paused) {
      now = Math.max(now, phase.deadline);
      event = { type: 'timer', now, phaseId: phase.id, startedAt: phase.startedAt };
    } else if (s.k === 'staleTimer' && phases.length > 0) {
      const old = phases[s.dt % phases.length] as { id: string; startedAt: number };
      event = { type: 'timer', now, phaseId: old.id, startedAt: old.startedAt };
    } else if (s.k === 'vip') {
      event = { type: 'vip', now, action: s.action };
    }
    if (!event) continue;
    apply(event, keys);
    if (game.results(state) !== null) break;
  }
  return { events, states };
}

function checkStep(
  game: AnyGameDefinition,
  before: GameStateBase,
  after: GameStateBase,
  event: GameEvent<unknown>,
  keys: string[],
): void {
  const where = `${game.manifest.id} ${before.phase.id} ← ${JSON.stringify(event)}`;
  expect(JSON.parse(JSON.stringify(after)), where).toEqual(after);
  if (event.type === 'timer' && event.startedAt !== before.phase.startedAt)
    expect(after, `${where}: a stale timer changed the state`).toBe(before);
  if (event.type !== 'speech' && event.type !== 'speechStart') return;
  const a = before.phase;
  const b = after.phase;
  // A reading never ends a pause, never moves the game to another phase instance on its own
  // when it is not one the phase asked for, and never lets a timed phase hang.
  expect(b.paused, `${where}: a reading changed the pause`).toEqual(a.paused);
  if (!keys.includes(event.key)) {
    expect(b.id, `${where}: a stale reading moved the phase`).toBe(a.id);
    expect(b.startedAt, `${where}: a stale reading moved the phase`).toBe(a.startedAt);
  }
  if (a.deadline !== null && b.id === a.id && b.startedAt === a.startedAt)
    expect(b.deadline, `${where}: a reading left a timed phase with no deadline`).not.toBeNull();
  if (b.deadline !== null && b.deadline !== a.deadline) {
    const length = event.type === 'speech' ? Math.max(0, event.ms) : 0;
    expect(b.deadline, `${where}: a reading held the phase too long`).toBeLessThanOrEqual(
      event.now + length + HOLD_CAP_MS,
    );
    if (!b.paused)
      expect(b.deadline, `${where}: a reading set a deadline in the past`).toBeGreaterThanOrEqual(
        event.now,
      );
  }
}

/** Drives a state to the end the way a room with a reader in the given mood would. */
function playOut(
  game: AnyGameDefinition,
  start: Start,
  reader: 'stalls' | 'off' | 'reads',
): { state: GameStateBase; simMs: number } | null {
  let state = start.state;
  let now = start.now;
  for (let i = 0; i < 2000 && game.results(state) === null; i++) {
    for (const key of wanted(game, state)) {
      const event: GameEvent<unknown> =
        reader === 'stalls'
          ? { type: 'speechStart', now, key }
          : { type: 'speech', now, key, ms: reader === 'off' ? -1 : 2500 };
      state = game.reduce(state, event);
    }
    const { phase } = state;
    if (phase.deadline !== null && !phase.paused) {
      now = Math.max(now, phase.deadline);
      const next = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: phase.id,
        startedAt: phase.startedAt,
      });
      if (next === state) return null;
      state = next;
    } else {
      now += 60_000;
      state = game.reduce(state, { type: 'vip', now, action: phase.paused ? 'resume' : 'skip' });
    }
  }
  return game.results(state) === null ? null : { state, simMs: now - start.now };
}

for (const loaded of games) {
  const { game, id } = loaded;
  const budgetMs = game.manifest.estimatedMinutes * 3 * 60_000;
  const starts = startsOf(game);

  describe.skipIf(starts.length === 0)(`speech races: games/${id}`, () => {
    it('any order of readings, timers, VIP actions and inputs stays pure, calm and live', () => {
      fc.assert(
        fc.property(
          fc.nat(),
          fc.array(step, { minLength: 1, maxLength: 30 }),
          fc.nat(),
          (pick, steps, seed) => {
            const start = starts[pick % starts.length] as Start;
            const first = drive(game, start, steps, seed);
            // Same start + same events ⇒ the same states (a reading is an event like any other).
            let state = start.state;
            first.events.forEach((event, i) => {
              state = game.reduce(state, event);
              expect(hashState(state)).toBe(hashState(first.states[i]));
            });
            // Whatever the order, the game still ends when nobody plays on.
            expect(finishGame(game, state, 2000), `${id} hangs after the race`).not.toBeNull();
          },
        ),
        { numRuns: RUNS, seed: 221 },
      );
    });

    it('a reader that starts and never finishes, or is off, never stalls the game (PT-003)', () => {
      for (const start of starts)
        for (const reader of ['stalls', 'off', 'reads'] as const) {
          const done = playOut(game, start, reader);
          expect(done, `${id} ${start.state.phase.id} with the reader ${reader}`).not.toBeNull();
          expect(done?.simMs ?? Infinity).toBeLessThanOrEqual(budgetMs);
        }
    });
  });
}
