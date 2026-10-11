// useSay's bookings (audit #8, from who-said-it): a line plays at its server time, once per phase
// instance, a stale one never, and a new phase ducks the last one's line out.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SayItem } from '../views';
import { bookSay } from './say';
import type { SoundApi } from './sound';

// Every clip in these tests runs for a second (item()'s default), so a hush has a voice to duck
// only while one is still speaking.
const CLIP_MS = 1_000;

function fakeSound(): SoundApi & { log: string[] } {
  const log: string[] = [];
  let speakingUntil = 0;
  return {
    log,
    play: () => undefined,
    clip: (src) => {
      speakingUntil = Date.now() + CLIP_MS;
      log.push(`clip ${src}`);
    },
    hush: (fadeMs) => {
      log.push(fadeMs === undefined ? 'hush' : `hush ${fadeMs}`);
      const wait = Date.now() < speakingUntil ? (fadeMs ?? 0) : 0;
      speakingUntil = 0;
      return wait;
    },
  };
}

const item = (key: string, at: number, ms = 1_000): SayItem => ({
  key,
  url: `/api/speech/${key}.wav`,
  at,
  ms,
});

// Each test is a later phase than the last: the bookings are module-level, like on a real TV. A
// quiet phase first leaves nothing booked, so a test's first phase has nothing to hush.
let startedAt = 1_000_000;

describe('bookSay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startedAt += 100_000;
    bookSay([], { phaseId: 'quiet', startedAt: startedAt - 1, deadline: null }, 0, fakeSound());
  });
  afterEach(() => vi.useRealTimers());

  it('plays each line at its server time, once however often the view is pushed', () => {
    const sound = fakeSound();
    const phase = { phaseId: 'guess', startedAt, deadline: startedAt + 20_000 };
    const items = [item('who', startedAt + 500), item('card', startedAt + 2_000)];
    bookSay(items, phase, startedAt, sound);
    bookSay(items, phase, startedAt + 100, sound);
    vi.advanceTimersByTime(499);
    expect(sound.log).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sound.log).toEqual(['clip /api/speech/who.wav']);
    vi.advanceTimersByTime(2_000);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'clip /api/speech/card.wav']);
  });

  it('plays a late line at once if it still fits before the deadline; a stale one never', () => {
    const sound = fakeSound();
    const now = startedAt + 10_000;
    bookSay([item('late', now - 2_000)], { phaseId: 'p', startedAt, deadline: now + 5_000 }, now, sound); // prettier-ignore
    vi.advanceTimersByTime(0);
    expect(sound.log).toEqual(['clip /api/speech/late.wav']);

    const next = fakeSound();
    const later = { phaseId: 'q', startedAt: startedAt + 1, deadline: now + 1_000 };
    bookSay([item('stale', now - 2_000)], later, now, next);
    vi.advanceTimersByTime(5_000);
    expect(next.log).toEqual(['hush 250']); // the last phase's line, not this one's
  });

  it("a new phase drops the last one's bookings and hushes it; an older phase is ignored", () => {
    const sound = fakeSound();
    bookSay(
      [item('a', startedAt + 3_000)],
      { phaseId: 'p', startedAt, deadline: null },
      startedAt,
      sound,
    );
    const next = startedAt + 1_000;
    bookSay(
      [item('b', next + 100)],
      { phaseId: 'q', startedAt: next, deadline: null },
      next,
      sound,
    );
    expect(sound.log).toEqual(['hush 250']);
    // The fading ghost of the older phase pushes its view again: nothing is booked.
    bookSay([item('c', next)], { phaseId: 'p', startedAt, deadline: null }, next, sound);
    vi.advanceTimersByTime(5_000);
    expect(sound.log).toEqual(['hush 250', 'clip /api/speech/b.wav']);
  });

  it('a phase change during a line ducks that line out, and the new phase waits for the fade', () => {
    const sound = fakeSound();
    bookSay(
      [item('who', startedAt)],
      { phaseId: 'guess', startedAt, deadline: null },
      startedAt,
      sound,
    );
    vi.advanceTimersByTime(300); // 'who' is mid-sentence
    const next = startedAt + 300;
    bookSay(
      [item('card', next)],
      { phaseId: 'reveal', startedAt: next, deadline: null },
      next,
      sound,
    );
    // The line fades out over READING_FADE_MS rather than stopping mid-word...
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250']);
    // ...and the new phase's line starts once it is silent, not on top of the fade.
    vi.advanceTimersByTime(249);
    expect(sound.log).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sound.log).toEqual([
      'clip /api/speech/who.wav',
      'hush 250',
      'clip /api/speech/card.wav',
    ]);
  });

  it('a phase change after the last line has finished waits for nothing', () => {
    const sound = fakeSound();
    bookSay(
      [item('who', startedAt)],
      { phaseId: 'guess', startedAt, deadline: null },
      startedAt,
      sound,
    );
    vi.advanceTimersByTime(1_500);
    const next = startedAt + 1_500;
    bookSay(
      [item('card', next)],
      { phaseId: 'reveal', startedAt: next, deadline: null },
      next,
      sound,
    );
    vi.advanceTimersByTime(0);
    expect(sound.log).toEqual([
      'clip /api/speech/who.wav',
      'hush 250',
      'clip /api/speech/card.wav',
    ]);
  });
});
