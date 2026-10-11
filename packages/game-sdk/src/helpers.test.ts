import { describe, expect, it } from 'vitest';
import type { GameStateBase } from '@partybox/shared';
import { seedRng } from '@partybox/shared';
import { addScores, buildResults, rank, speedPoints } from './scoring';
import { allConnectedDone, applyVip, enterPhase, isTimerFor, setConnected } from './timer';
import { controllerEnvelope, envelope } from './views';

const base: GameStateBase = {
  phase: { id: 'play', startedAt: 1000, deadline: 6000 },
  rng: seedRng(1),
  players: {
    a: { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
    b: { id: 'b', name: 'Ben', avatarId: 'owl', connected: false },
  },
};

describe('timer helpers', () => {
  it('enterPhase sets startedAt/deadline and drops paused', () => {
    const paused = { ...base, phase: { ...base.phase, paused: { at: 2000 } } };
    expect(enterPhase(paused, 'next', 5000, 3000).phase).toEqual({
      id: 'next',
      startedAt: 5000,
      deadline: 8000,
    });
    expect(enterPhase(base, 'end', 5000, null).phase.deadline).toBeNull();
  });
  it('isTimerFor matches only the current phase instance', () => {
    expect(isTimerFor(base, { type: 'timer', now: 6000, phaseId: 'play', startedAt: 1000 })).toBe(
      true,
    );
    expect(isTimerFor(base, { type: 'timer', now: 6000, phaseId: 'play', startedAt: 999 })).toBe(
      false,
    );
    expect(isTimerFor(base, { type: 'timer', now: 6000, phaseId: 'other', startedAt: 1000 })).toBe(
      false,
    );
    expect(isTimerFor(base, { type: 'vip', now: 6000, action: 'skip' })).toBe(false);
  });
  it('setConnected updates known players only', () => {
    expect(
      setConnected(base, { type: 'player', now: 1, playerId: 'b', connected: true }).players['b']
        ?.connected,
    ).toBe(true);
    expect(setConnected(base, { type: 'player', now: 1, playerId: 'zz', connected: true })).toBe(
      base,
    );
    expect(setConnected(base, { type: 'player', now: 1, playerId: 'a', connected: true })).toBe(
      base,
    );
  });
  it('applyVip pauses, resumes with a shifted deadline, ignores nonsense, delegates skip/end', () => {
    const handlers = {
      skip: (s: GameStateBase) => ({ ...s, phase: { ...s.phase, id: 'skipped' } }),
      end: (s: GameStateBase) => ({ ...s, phase: { ...s.phase, id: 'done' } }),
    };
    expect(
      applyVip(base, { type: 'input', now: 1, playerId: 'a', input: {} }, handlers),
    ).toBeNull();
    const paused = applyVip(
      base,
      { type: 'vip', now: 2000, action: 'pause' },
      handlers,
    ) as GameStateBase;
    expect(paused.phase.paused).toEqual({ at: 2000 });
    expect(applyVip(paused, { type: 'vip', now: 2500, action: 'pause' }, handlers)).toBe(paused);
    const resumed = applyVip(
      paused,
      { type: 'vip', now: 4000, action: 'resume' },
      handlers,
    ) as GameStateBase;
    expect(resumed.phase).toEqual({ id: 'play', startedAt: 1000, deadline: 8000 });
    expect(applyVip(base, { type: 'vip', now: 4000, action: 'resume' }, handlers)).toBe(base);
    const skipped = applyVip(paused, { type: 'vip', now: 4000, action: 'skip' }, handlers);
    expect(skipped?.phase.id).toBe('skipped');
    expect(skipped?.phase.paused).toBeUndefined();
    expect(applyVip(base, { type: 'vip', now: 4000, action: 'end' }, handlers)?.phase.id).toBe(
      'done',
    );
  });
  it('allConnectedDone counts only connected players', () => {
    expect(allConnectedDone(base, ['a'])).toBe(true);
    expect(allConnectedDone(base, [])).toBe(false);
    const nobody = { ...base, players: { a: { ...base.players['a']!, connected: false } } };
    expect(allConnectedDone(nobody, ['a'])).toBe(false);
  });
});

describe('scoring helpers', () => {
  it('rank shares ranks on ties and orders by score then id', () => {
    expect(rank({ a: 3, b: 5, c: 3, d: 1 })).toEqual([
      { playerId: 'b', score: 5, rank: 1 },
      { playerId: 'a', score: 3, rank: 2 },
      { playerId: 'c', score: 3, rank: 2 },
      { playerId: 'd', score: 1, rank: 4 },
    ]);
    expect(rank({ a: Number.NaN })[0]?.score).toBe(0);
  });
  it('buildResults fills every player, finite scores, winners at rank 1, awards for real players', () => {
    const r = buildResults(base, { a: 2 }, [
      { id: 'x', title: 'X', description: '', playerId: 'a' },
      { id: 'y', title: 'Y', description: '', playerId: 'ghost' },
    ]);
    expect(r.scores).toEqual({ a: 2, b: 0 });
    expect(r.winnerIds).toEqual(['a']);
    expect(r.awards.map((a) => a.id)).toEqual(['x']);
  });
  it('speedPoints scales linearly and clamps', () => {
    expect(speedPoints(0, 10_000, 1000, 200)).toBe(1000);
    expect(speedPoints(5000, 10_000, 1000, 200)).toBe(600);
    expect(speedPoints(20_000, 10_000, 1000, 200)).toBe(200);
    expect(speedPoints(5, 0, 1000)).toBe(1000);
    expect(addScores({ a: 1 }, { a: 2, b: 3 })).toEqual({ a: 3, b: 3 });
  });
});

describe('view helpers', () => {
  it('carries the authoritative pause time only while held, on TV and phone', () => {
    const paused = { ...base, phase: { ...base.phase, paused: { at: 2000 } } };
    expect(envelope(paused, 'g')).toMatchObject({ paused: true, clockHeldAt: 2000 });
    expect(controllerEnvelope(paused, 'g', 'a')).toMatchObject({ paused: true, clockHeldAt: 2000 });
    expect(envelope(base, 'g')).not.toHaveProperty('clockHeldAt');
  });
  it('envelope orders players by id and applies statuses/scores', () => {
    const e = envelope(base, 'g', {
      statusOf: (id) => (id === 'a' ? 'submitted' : 'active'),
      scores: { a: 4 },
    });
    expect(e).toMatchObject({ gameId: 'g', phaseId: 'play', deadline: 6000, paused: false });
    expect(e.players.map((p) => [p.id, p.status, p.score])).toEqual([
      ['a', 'submitted', 4],
      ['b', 'active', 0],
    ]);
  });
  it('controllerEnvelope marks unknown ids as spectators', () => {
    expect(controllerEnvelope(base, 'g', 'a').me).toEqual({ id: 'a', role: 'player' });
    expect(controllerEnvelope(base, 'g', 'zz').me).toEqual({ id: 'zz', role: 'spectator' });
  });
  it('carries a screen only when the game names one (T-0147)', () => {
    expect(envelope(base, 'g', { screen: 'card 2' }).screen).toBe('card 2');
    expect(envelope(base, 'g', { screen: undefined })).not.toHaveProperty('screen');
  });
});
