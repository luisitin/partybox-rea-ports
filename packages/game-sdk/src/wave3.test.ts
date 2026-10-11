// The D-010 wave-3 helpers (docs/ABSTRACTION_AUDIT.md rows 10, 11 and 14): a player dropping,
// coming back or leaving for good, the re-check a resume owes a phase that may have finished while
// paused, the reduce skeleton every game shares, and a later beat of the phase on stage.
import { describe, expect, it } from 'vitest';
import type { GameStateBase } from '@partybox/shared';
import { seedRng } from '@partybox/shared';
import { composeReduce } from './reduce';
import { isTimerFor, nextStep, onPlayerEvent, recheckOnResume } from './timer';
import type { PlayerEvent } from './timer';

type S = GameStateBase & { left: string[]; closed?: number };

const base: S = {
  phase: { id: 'write', startedAt: 0, deadline: 60_000 },
  rng: seedRng(1),
  players: {
    a: { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
    b: { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
  },
  left: [],
};
const close = (s: S, now: number): S => ({ ...s, closed: now });
const drop = (playerId: string, gone?: 'left' | 'kicked'): PlayerEvent => ({
  type: 'player',
  now: 5_000,
  playerId,
  connected: false,
  ...(gone ? { gone } : {}),
});

describe('onPlayerEvent', () => {
  it('a drop marks the player and runs the close-if-done check', () => {
    const s = onPlayerEvent(base, drop('b'), { closeIfDone: close });
    expect(s.players['b']?.connected).toBe(false);
    expect(s.left).toEqual([]);
    expect(s.closed).toBe(5_000);
  });

  it('a leave goes on `left` once; a stranger never does', () => {
    const once = onPlayerEvent(base, drop('b', 'left'));
    expect(once.left).toEqual(['b']);
    expect(onPlayerEvent(once, drop('b', 'kicked')).left).toEqual(['b']);
    expect(onPlayerEvent(base, drop('zed', 'left')).left).toEqual([]);
    const seatsOnly = onPlayerEvent(base, drop('b', 'left'), { isIn: (_s, id) => id === 'a' });
    expect(seatsOnly.left).toEqual([]);
  });

  it('a game with no `left` list takes the leave without growing one', () => {
    const { left: _left, ...bare } = base;
    const s = onPlayerEvent(bare, drop('b', 'left'), {
      closeIfDone: (x, now) => ({ ...x, closedAt: now }),
    });
    expect('left' in s).toBe(false);
    expect(s).toMatchObject({ closedAt: 5_000 });
  });

  it('no check on a reconnect, nor while paused', () => {
    const back: PlayerEvent = { type: 'player', now: 6_000, playerId: 'b', connected: true };
    expect(onPlayerEvent(base, back, { closeIfDone: close }).closed).toBeUndefined();
    const paused: S = { ...base, phase: { ...base.phase, paused: { at: 4_000 } } };
    const s = onPlayerEvent(paused, drop('b', 'left'), { closeIfDone: close });
    expect(s.closed).toBeUndefined();
    expect(s.left).toEqual(['b']);
  });
});

describe('recheckOnResume', () => {
  it('runs the check on a resume only', () => {
    expect(recheckOnResume(base, { type: 'vip', now: 9_000, action: 'resume' }, close).closed).toBe(9_000); // prettier-ignore
    expect(recheckOnResume(base, { type: 'vip', now: 9_000, action: 'skip' }, close)).toBe(base);
    const still: S = { ...base, phase: { ...base.phase, paused: { at: 1 } } };
    expect(recheckOnResume(still, { type: 'vip', now: 9_000, action: 'resume' }, close)).toBe(
      still,
    );
  });
});

describe('composeReduce (audit #11)', () => {
  type R = GameStateBase & { log: string[] };
  const at: R = { ...base, log: [] };
  const note = (s: R, what: string): R => ({ ...s, log: [...s.log, what] });
  const reduce = composeReduce<R, { type: 'go' }>({
    phases: { write: (s, e, next) => (e.type === 'timer' ? next(s, e.now) : note(s, e.type)) },
    advance: (s) => note(s, 'advance'),
    end: (s) => note(s, 'end'),
    onSpeech: (s, key) => note(s, `speech ${key}`),
  });

  it('runs player → speech → VIP → paused → phase, in that order', () => {
    const drop: PlayerEvent = { type: 'player', now: 1, playerId: 'b', connected: false };
    expect(reduce(at, drop).players['b']?.connected).toBe(false);
    expect(reduce(at, { type: 'speech', now: 1, key: 'k', ms: 900 }).log).toEqual(['speech k']);
    // T-0159: a started reading reaches onSpeechStart, and is ignored without one
    expect(reduce(at, { type: 'speechStart', now: 1, key: 'k' })).toBe(at);
    const started = composeReduce<R, { type: 'go' }>({
      phases: {},
      advance: (s) => s,
      end: (s) => s,
      onSpeechStart: (s, key) => note(s, `started ${key}`),
    });
    expect(started(at, { type: 'speechStart', now: 1, key: 'k' }).log).toEqual(['started k']);
    expect(reduce(at, { type: 'vip', now: 1, action: 'skip' }).log).toEqual(['advance']);
    expect(reduce(at, { type: 'vip', now: 1, action: 'end' }).log).toEqual(['end']);
    const input = { type: 'input' as const, now: 1, playerId: 'a', input: { type: 'go' as const } };
    expect(reduce(at, input).log).toEqual(['input']);
    const timer = { type: 'timer' as const, now: 1, phaseId: 'write', startedAt: 0 };
    expect(reduce(at, timer).log).toEqual(['advance']);
  });

  it('prepare readies the state for the VIP and the phase; afterVip still gets the state the event found', () => {
    let before: R | null = null;
    const prepared = composeReduce<R, { type: 'go' }>({
      phases: { write: (s) => note(s, 'phase') },
      advance: (s) => note(s, 'advance'),
      end: (s) => s,
      onSpeech: (s) => note(s, 'speech'),
      prepare: (s) => note(s, 'prepared'),
      afterVip: (b, after) => {
        before = b;
        return after;
      },
    });
    const input = { type: 'input' as const, now: 1, playerId: 'a', input: { type: 'go' as const } };
    expect(prepared(at, input).log).toEqual(['prepared', 'phase']);
    expect(prepared(at, { type: 'vip', now: 1, action: 'skip' }).log).toEqual([
      'prepared',
      'advance',
    ]);
    expect(before).toBe(at);
    expect(prepared(at, { type: 'speech', now: 1, key: 'k', ms: 1 }).log).toEqual(['speech']);
  });

  it('a skip while paused runs the resume first: the game clock moves past the pause', () => {
    type C = R & { began: number };
    const clocked = composeReduce<C, { type: 'go' }>({
      phases: {},
      advance: (s, now) => ({ ...s, log: [...s.log, `advance ${now - s.began}`] }),
      end: (s) => s,
      prepare: (s, e) =>
        e.type === 'vip' && e.action === 'resume' && s.phase.paused
          ? { ...s, began: s.began + (e.now - s.phase.paused.at) }
          : s,
    });
    const paused = clocked({ ...at, began: 0 }, { type: 'vip', now: 10_000, action: 'pause' });
    // 30 s paused, then a skip: 10 s played, not 40
    const skipped = clocked(paused, { type: 'vip', now: 40_000, action: 'skip' });
    expect(skipped.log).toEqual(['advance 10000']);
    expect(skipped.phase.paused).toBeUndefined();
    // a plain resume shifts the deadline only; the phase keeps its start (the phase's identity)
    const resumed = clocked(paused, { type: 'vip', now: 40_000, action: 'resume' });
    expect(resumed.phase.startedAt).toBe(0);
    expect(resumed.phase.deadline).toBe(90_000);
  });

  it('a prepare that shifts on both the resume and the skip moves the clock once', () => {
    type C = R & { began: number };
    const clocked = composeReduce<C, { type: 'go' }>({
      phases: {},
      advance: (s, now) => ({ ...s, log: [...s.log, `advance ${now - s.began}`] }),
      end: (s) => s,
      prepare: (s, e) =>
        e.type === 'vip' && (e.action === 'resume' || e.action === 'skip') && s.phase.paused
          ? { ...s, began: s.began + (e.now - s.phase.paused.at) }
          : s,
    });
    const paused = clocked({ ...at, began: 0 }, { type: 'vip', now: 10_000, action: 'pause' });
    expect(clocked(paused, { type: 'vip', now: 40_000, action: 'skip' }).log).toEqual([
      'advance 10000',
    ]);
  });

  it('a resume that already moved the phase on spends the skip', () => {
    const reentered = composeReduce<R, { type: 'go' }>({
      phases: {},
      advance: (s) => note(s, 'advance'),
      end: (s) => s,
      afterVip: (_before, after, e) =>
        e.type === 'vip' && e.action === 'resume'
          ? { ...after, phase: { id: 'next', startedAt: e.now, deadline: null } }
          : after,
    });
    const paused = reentered(at, { type: 'vip', now: 10_000, action: 'pause' });
    const skipped = reentered(paused, { type: 'vip', now: 20_000, action: 'skip' });
    expect(skipped.phase.id).toBe('next');
    expect(skipped.log).toEqual([]);
  });

  it('a skip of its own serves the VIP; the phases still get advance', () => {
    const stepwise = composeReduce<R, { type: 'go' }>({
      phases: { write: (s, e, next) => (e.type === 'timer' ? next(s, e.now) : s) },
      advance: (s) => note(s, 'advance'),
      skip: (s) => note(s, 'one step'),
      end: (s) => s,
    });
    expect(stepwise(at, { type: 'vip', now: 1, action: 'skip' }).log).toEqual(['one step']);
    const timer = { type: 'timer' as const, now: 1, phaseId: 'write', startedAt: 0 };
    expect(stepwise(at, timer).log).toEqual(['advance']);
  });

  it('waits while paused, ignores a phase with no reducer, and hands afterVip the state it acted on', () => {
    const paused: R = { ...at, phase: { ...at.phase, paused: { at: 1 } } };
    const input = { type: 'input' as const, now: 2, playerId: 'a', input: { type: 'go' as const } };
    expect(reduce(paused, input)).toBe(paused);
    const other: R = { ...at, phase: { id: 'scores', startedAt: 0, deadline: null } };
    expect(reduce(other, input)).toBe(other);
    const seen: string[] = [];
    const withHook = composeReduce<R, { type: 'go' }>({
      phases: {},
      advance: (s) => s,
      end: (s) => s,
      afterVip: (before, after) => {
        seen.push(`${before.phase.paused ? 'paused' : 'running'}→${after.phase.paused ? 'paused' : 'running'}`); // prettier-ignore
        return after;
      },
    });
    withHook(paused, { type: 'vip', now: 5, action: 'resume' });
    expect(seen).toEqual(['paused→running']);
    expect(withHook(at, { type: 'speech', now: 1, key: 'k', ms: 1 })).toBe(at);
  });

  it('whilePaused takes a paused input (a sheet closed on a phone), never a timer, and only while paused', () => {
    const paused: R = { ...at, phase: { ...at.phase, paused: { at: 1 } } };
    const input = { type: 'input' as const, now: 2, playerId: 'a', input: { type: 'go' as const } };
    const timer = { type: 'timer' as const, now: 2, phaseId: 'write', startedAt: 0 };
    const taken: string[] = [];
    const withPause = composeReduce<R, { type: 'go' }>({
      phases: { write: (s) => note(s, 'phase') },
      advance: (s) => note(s, 'advance'),
      end: (s) => s,
      whilePaused: (s, e) => {
        taken.push(`${e.playerId}:${e.input.type}`);
        return note(s, `paused ${e.playerId}`);
      },
    });
    expect(withPause(paused, input).log).toEqual(['paused a']);
    expect(withPause(paused, timer)).toBe(paused);
    expect(taken).toEqual(['a:go']);
    // running, the same input goes to the phase, not to the hook
    expect(withPause(at, input).log).toEqual(['phase']);
    expect(taken).toEqual(['a:go']);
    // a VIP act is applyVip's, never the hook's
    expect(withPause(paused, { type: 'vip', now: 5, action: 'resume' }).log).toEqual([]);
    expect(taken).toEqual(['a:go']);
  });
});

describe('nextStep (audit #14)', () => {
  it('keeps the phase instance, sets the new deadline and the game its step', () => {
    type T = GameStateBase & { step: 'land' | 'shown' };
    const landing: T = { ...base, phase: { id: 'reveal', startedAt: 1_000, deadline: 4_000 }, step: 'land' }; // prettier-ignore
    const shown = nextStep(landing, 9_000, (s) => ({ ...s, step: 'shown' as const }));
    expect(shown.phase).toEqual({ id: 'reveal', startedAt: 1_000, deadline: 9_000 });
    expect(shown.step).toBe('shown');
    expect(landing.step).toBe('land');
    // The later deadline's timer belongs to the same instance; one from before the phase doesn't.
    const timer = (startedAt: number) => ({ type: 'timer' as const, now: 9_000, phaseId: 'reveal', startedAt }); // prettier-ignore
    expect(isTimerFor(shown, timer(1_000))).toBe(true);
    expect(isTimerFor(shown, timer(500))).toBe(false);
    expect(nextStep(landing, null).phase.deadline).toBeNull();
  });
});
