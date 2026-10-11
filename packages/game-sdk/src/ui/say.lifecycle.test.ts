import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SayItem } from '../views';
import type { SayPhase } from './say';

const env = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  sound: { play: vi.fn(), clip: vi.fn(), hush: vi.fn(() => 0) },
}));
vi.mock('react', () => ({
  useEffect: (setup: () => void | (() => void)) => env.effects.push(setup),
}));
vi.mock('./clock', () => ({ useServerOffset: () => 0 }));
vi.mock('./sound', () => ({ READING_FADE_MS: 250, useSoundApi: () => env.sound }));

const item = (key: string, at: number): SayItem => ({
  key,
  at,
  ms: 1000,
  url: '/api/speech/' + key + '.wav',
});
async function mount(items: SayItem[], phase: SayPhase, on = true): Promise<() => void> {
  const { useSay } = await import('./say');
  env.effects.length = 0;
  useSay(items, phase, on);
  const cleanups = env.effects.map((effect) => effect());
  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('scheduled readings belong to mounted game surfaces', () => {
  const phase = { phaseId: 'prompt', startedAt: 0, deadline: 10_000 };
  it('cancels pending speech after the final game surface leaves', async () => {
    const leave = await mount([item('a', 3000)], phase);
    leave();
    await vi.advanceTimersByTimeAsync(5000);
    expect(env.sound.clip).not.toHaveBeenCalled();
  });
  it('preserves one booking through a StrictMode cleanup/remount', async () => {
    const leave = await mount([item('a', 3000)], phase);
    leave();
    await mount([item('a', 3000)], phase);
    await vi.advanceTimersByTimeAsync(5000);
    expect(env.sound.clip).toHaveBeenCalledTimes(1);
    expect(env.sound.clip).toHaveBeenCalledWith('/api/speech/a.wav', { gain: 1, duck: false });
  });
  it('an outgoing crossfade ghost cannot cancel the incoming phase', async () => {
    const leave = await mount([item('a', 3000)], phase);
    vi.setSystemTime(1000);
    await mount([item('b', 3100)], { ...phase, phaseId: 'guess', startedAt: 1000 });
    leave();
    await vi.advanceTimersByTimeAsync(5000);
    expect(env.sound.clip).toHaveBeenCalledTimes(1);
    expect(env.sound.clip).toHaveBeenCalledWith('/api/speech/b.wav', { gain: 1, duck: false });
  });
  it('disabling the last reader also releases its pending bookings', async () => {
    const leave = await mount([item('a', 3000)], phase);
    leave();
    await mount([], phase, false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(env.sound.clip).not.toHaveBeenCalled();
  });
  it('retirement does not hush a new game using the same shell audio', async () => {
    const leave = await mount([item('a', 3000)], phase);
    leave();
    env.sound.clip('/api/speech/new-game.wav');
    await vi.advanceTimersByTimeAsync(5000);
    expect(env.sound.hush).not.toHaveBeenCalled();
    expect(env.sound.clip).toHaveBeenCalledTimes(1);
  });
  it('a handover between two surfaces inside one tick keeps the booking until the last one leaves', async () => {
    const first = await mount([item('a', 3000)], phase);
    const second = await mount([item('a', 3000)], phase);
    first();
    await vi.advanceTimersByTimeAsync(5000);
    expect(env.sound.clip).toHaveBeenCalledTimes(1);
    second();
    const late = await mount([item('b', 9000)], { ...phase, phaseId: 'next', startedAt: 20 });
    late();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(env.sound.clip).toHaveBeenCalledTimes(1);
  });
});
