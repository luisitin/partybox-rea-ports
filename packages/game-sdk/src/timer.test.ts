// A VIP skip while paused into a beat of the same phase instance (ADR-101, T-0779 F6): the beat is named
// by the skip's time, so the views' phaseAt changes and the clocks read it as a new countdown, not a resume.
import type { GameEvent, GameStateBase } from '@partybox/shared';
import { seedRng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { applyVip, enterPhase, nextStep } from './timer';

const T0 = 1_000;
const base: GameStateBase = {
  phase: { id: 'reveal', startedAt: T0, deadline: T0 + 20_000 },
  rng: seedRng(3),
  players: {},
};
// A skip moves on to the next beat of the same instance, 4 s long; a resume keeps the handlers out of it.
const handlers = {
  skip: (s: GameStateBase, now: number) => nextStep(s, now + 4_000),
  end: (s: GameStateBase) => s,
};
const vip = (now: number, action: 'pause' | 'resume' | 'skip'): GameEvent<unknown> => ({
  type: 'vip',
  now,
  action,
});
const run = (s: GameStateBase, event: GameEvent<unknown>, h = handlers): GameStateBase =>
  applyVip(s, event, h) as GameStateBase;

describe('a VIP skip while paused into a beat (ADR-101, T-0779 F6)', () => {
  it('keeps the instance and names the beat by the skip time', () => {
    // Paused at 5 s of a 20 s phase; the skip at 40 s lands a 4 s beat, after the 35 s pause.
    const beat = run(run(base, vip(T0 + 5_000, 'pause')), vip(T0 + 40_000, 'skip'));
    expect(beat.phase).toEqual({
      id: 'reveal',
      startedAt: T0,
      deadline: T0 + 44_000,
      beatAt: T0 + 40_000,
    });
  });

  it('a resume keeps the beat name and moves the beat deadline by its own pause', () => {
    const beat = run(run(base, vip(T0 + 5_000, 'pause')), vip(T0 + 40_000, 'skip'));
    const again = run(run(beat, vip(T0 + 41_000, 'pause')), vip(T0 + 46_000, 'resume'));
    expect(again.phase).toEqual({
      id: 'reveal',
      startedAt: T0,
      deadline: T0 + 49_000,
      beatAt: T0 + 40_000,
    });
  });

  it('a skip that moves no deadline names nothing', () => {
    const still = run(run(base, vip(T0 + 5_000, 'pause')), vip(T0 + 40_000, 'skip'), {
      skip: (s) => s,
      end: (s) => s,
    });
    expect(still.phase).not.toHaveProperty('beatAt');
  });

  it('a skip into another phase names nothing', () => {
    const next = run(run(base, vip(T0 + 5_000, 'pause')), vip(T0 + 40_000, 'skip'), {
      skip: (s, now) => enterPhase(s, 'tally', now, 10_000),
      end: (s) => s,
    });
    expect(next.phase).toEqual({ id: 'tally', startedAt: T0 + 40_000, deadline: T0 + 50_000 });
  });

  it('enterPhase drops the name with the instance', () => {
    const beat = run(run(base, vip(T0 + 5_000, 'pause')), vip(T0 + 40_000, 'skip'));
    expect(enterPhase(beat, 'tally', T0 + 50_000, 5_000).phase).not.toHaveProperty('beatAt');
  });

  it('a skip while running is not named: the client reads its deadline, as before', () => {
    const skipped = run(base, vip(T0 + 5_000, 'skip'));
    expect(skipped.phase).toEqual({ id: 'reveal', startedAt: T0, deadline: T0 + 9_000 });
  });
});
