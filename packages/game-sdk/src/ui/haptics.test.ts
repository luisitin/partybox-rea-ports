// A shorter buzz never cuts a longer one still running (loop 334).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buzz } from './haptics';

describe('buzz', () => {
  const calls: (number | number[])[] = [];
  let now = 0;
  beforeEach(() => {
    calls.length = 0;
    now += 100_000; // the module remembers the last pattern's end: start each test long after it
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    Object.defineProperty(globalThis, 'navigator', {
      value: { vibrate: (p: number | number[]) => calls.push(p) },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: () => null, setItem: () => undefined },
      configurable: true,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('a 20 ms tick on the same tick as a 320 ms celebration is dropped', () => {
    buzz([40, 60, 40, 60, 120]);
    buzz(20);
    expect(calls).toEqual([[40, 60, 40, 60, 120]]);
  });

  it('a pattern at least as long as what is left takes over; anything runs once the last is done', () => {
    buzz(20);
    buzz([40, 60, 40]); // an error over a tap
    now += 200;
    buzz(12); // the last one is long over
    expect(calls).toEqual([20, [40, 60, 40], 12]);
  });

  it("the same pattern twice inside 30 ms is one buzz (a tap and the shell's lock-in)", () => {
    buzz(20);
    now += 22;
    buzz(20);
    now += 30;
    buzz(20); // 52 ms after the first: its own
    expect(calls).toEqual([20, 20]);
  });

  it('daubs 33 ms apart each buzz (18 ms, the last is over)', () => {
    buzz(18);
    now += 33;
    buzz(18);
    expect(calls).toEqual([18, 18]);
  });
});

// Before a page's first tap the browser drops a vibrate and logs an error every time (2026-09-22:
// 180 of them in one resume sweep). buzz() asks first where the browser can say.
describe('buzz before the first tap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function withNavigator(userActivation: { hasBeenActive: boolean } | undefined) {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate, ...(userActivation ? { userActivation } : {}) });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    vi.resetModules();
    const fresh = await import('./haptics');
    return { buzz: fresh.buzz, vibrate };
  }

  it('does not call vibrate before the page has been tapped', async () => {
    const t = await withNavigator({ hasBeenActive: false });
    t.buzz(20);
    expect(t.vibrate).not.toHaveBeenCalled();
  });

  it('vibrates once the page has been tapped', async () => {
    const t = await withNavigator({ hasBeenActive: true });
    t.buzz(20);
    expect(t.vibrate).toHaveBeenCalledWith(20);
  });

  it('vibrates where the browser cannot say (no userActivation)', async () => {
    const t = await withNavigator(undefined);
    t.buzz([10, 20]);
    expect(t.vibrate).toHaveBeenCalledWith([10, 20]);
  });
});
