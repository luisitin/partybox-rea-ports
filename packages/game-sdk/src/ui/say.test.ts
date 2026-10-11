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
  it('lines due inside the fade keep their spacing once it is over', () => {
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
      [item('a', next), item('b', next + 100)],
      { phaseId: 'reveal', startedAt: next, deadline: null },
      next,
      sound,
    );
    vi.advanceTimersByTime(249);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250']);
    vi.advanceTimersByTime(1);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250', 'clip /api/speech/a.wav']);
    // 'b' was due 100 ms after 'a', so it plays 100 ms after it: not on the same instant.
    vi.advanceTimersByTime(99);
    expect(sound.log).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(sound.log[3]).toBe('clip /api/speech/b.wav');
  });

  it('a booking the next phase clears is traced, so every booked line is explained', () => {
    const traced: unknown[] = [];
    (globalThis as { __pbTrace?: unknown[] }).__pbTrace = traced;
    try {
      const sound = fakeSound();
      bookSay(
        [item('who', startedAt + 5_000)],
        { phaseId: 'guess', startedAt, deadline: null },
        startedAt,
        sound,
      );
      const next = startedAt + 1_000;
      bookSay(
        [item('card', next)],
        { phaseId: 'reveal', startedAt: next, deadline: null },
        next,
        sound,
      );
      expect(traced).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'say',
            booking: `who@${startedAt + 5_000}`,
            cleared: 'phase',
          }),
        ]),
      );
    } finally {
      delete (globalThis as { __pbTrace?: unknown[] }).__pbTrace;
    }
  });

  it('a later push in the same phase takes the phase shift too', () => {
    const sound = fakeSound();
    bookSay(
      [item('who', startedAt)],
      { phaseId: 'guess', startedAt, deadline: null },
      startedAt,
      sound,
    );
    vi.advanceTimersByTime(300); // 'who' is mid-sentence
    const next = startedAt + 300;
    const reveal = { phaseId: 'reveal', startedAt: next, deadline: null };
    bookSay([item('a', next)], reveal, next, sound);
    vi.advanceTimersByTime(50);
    // 'b' is pushed 50 ms later, due 100 ms after 'a': it keeps the phase's shift, so it plays 100 ms
    // after 'a', not on top of it.
    bookSay([item('b', next + 100)], reveal, next + 50, sound);
    vi.advanceTimersByTime(199);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250']);
    vi.advanceTimersByTime(1);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250', 'clip /api/speech/a.wav']);
    vi.advanceTimersByTime(99);
    expect(sound.log).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(sound.log[3]).toBe('clip /api/speech/b.wav');
  });

  it('a line due well after the fade keeps its server time', () => {
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
      [item('late', next + 600)],
      { phaseId: 'reveal', startedAt: next, deadline: null },
      next,
      sound,
    );
    // The fade pushes only the lines that fall inside it: this one is 600 ms out, so it plays on time.
    vi.advanceTimersByTime(599);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250']);
    vi.advanceTimersByTime(1);
    expect(sound.log).toEqual([
      'clip /api/speech/who.wav',
      'hush 250',
      'clip /api/speech/late.wav',
    ]);
  });

  it('a later push due inside the fade waits for the fade to end', () => {
    const sound = fakeSound();
    bookSay(
      [item('who', startedAt)],
      { phaseId: 'guess', startedAt, deadline: null },
      startedAt,
      sound,
    );
    vi.advanceTimersByTime(300); // 'who' is mid-sentence
    const next = startedAt + 300;
    const reveal = { phaseId: 'reveal', startedAt: next, deadline: null };
    bookSay([item('far', next + 600)], reveal, next, sound);
    vi.advanceTimersByTime(100);
    // 'soon' is pushed 100 ms in and due 50 ms after that, inside the fade: it waits for the fade.
    bookSay([item('soon', next + 150)], reveal, next + 100, sound);
    vi.advanceTimersByTime(149);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250']);
    vi.advanceTimersByTime(1);
    expect(sound.log).toEqual([
      'clip /api/speech/who.wav',
      'hush 250',
      'clip /api/speech/soon.wav',
    ]);
    // 'far' is due 600 ms in, unshifted: it plays on its server time.
    vi.advanceTimersByTime(349);
    expect(sound.log).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(sound.log[3]).toBe('clip /api/speech/far.wav');
  });

  it('a line already due waits for the fade, and the next line keeps its gap', () => {
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
      [item('due', next - 200), item('after', next + 100)],
      { phaseId: 'reveal', startedAt: next, deadline: next + 5_000 },
      next,
      sound,
    );
    // 'due' is 200 ms late but still fits before the deadline: it plays as the fade ends, not under it.
    vi.advanceTimersByTime(249);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250']);
    vi.advanceTimersByTime(1);
    expect(sound.log[2]).toBe('clip /api/speech/due.wav');
    vi.advanceTimersByTime(99);
    expect(sound.log).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(sound.log[3]).toBe('clip /api/speech/after.wav');
  });

  it('an empty entering batch does not pin the shift: lines pushed after it keep their gap', () => {
    const sound = fakeSound();
    bookSay(
      [item('who', startedAt)],
      { phaseId: 'guess', startedAt, deadline: null },
      startedAt,
      sound,
    );
    vi.advanceTimersByTime(300); // 'who' is mid-sentence
    const next = startedAt + 300;
    const reveal = { phaseId: 'reveal', startedAt: next, deadline: null };
    bookSay([], reveal, next, sound); // the phase starts before its speech is ready
    vi.advanceTimersByTime(100);
    // Both are pushed 100 ms in, due 50 and 150 ms on, inside the fade (it ends at +250): the first
    // waits for the fade end and the second keeps its 100 ms gap after it.
    bookSay([item('card', next + 150), item('after', next + 250)], reveal, next + 100, sound);
    vi.advanceTimersByTime(149);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250']);
    vi.advanceTimersByTime(1);
    expect(sound.log).toEqual([
      'clip /api/speech/who.wav',
      'hush 250',
      'clip /api/speech/card.wav',
    ]);
    vi.advanceTimersByTime(99);
    expect(sound.log).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(sound.log[3]).toBe('clip /api/speech/after.wav');
  });

  it('a line already due after the fade is over plays at once, not a whole shift late', () => {
    const sound = fakeSound();
    bookSay(
      [item('who', startedAt)],
      { phaseId: 'guess', startedAt, deadline: null },
      startedAt,
      sound,
    );
    vi.advanceTimersByTime(300); // 'who' is mid-sentence
    const next = startedAt + 300;
    const reveal = { phaseId: 'reveal', startedAt: next, deadline: null };
    bookSay([item('card', next)], reveal, next, sound); // shifted by the fade: plays as it ends
    vi.advanceTimersByTime(500); // the fade is over
    // 'late' was due 300 ms before this push: it plays now, not 250 ms after it.
    bookSay([item('late', next + 200)], reveal, next + 500, sound);
    vi.advanceTimersByTime(0);
    expect(sound.log).toEqual([
      'clip /api/speech/who.wav',
      'hush 250',
      'clip /api/speech/card.wav',
      'clip /api/speech/late.wav',
    ]);
  });

  it('the fade runs on this device clock: a jump in the server estimate does not move it', () => {
    const sound = fakeSound();
    bookSay(
      [item('who', startedAt)],
      { phaseId: 'guess', startedAt, deadline: null },
      startedAt,
      sound,
    );
    vi.advanceTimersByTime(300); // 'who' is mid-sentence
    const next = startedAt + 300;
    const reveal = { phaseId: 'reveal', startedAt: next, deadline: null };
    bookSay([], reveal, next, sound); // the fade starts on this device now
    vi.advanceTimersByTime(100);
    // The server estimate jumps 400 ms ahead, but the fade still ends 250 ms after it started here.
    const jumped = next + 500;
    bookSay([item('card', jumped + 10)], reveal, jumped, sound);
    vi.advanceTimersByTime(149);
    expect(sound.log).toEqual(['clip /api/speech/who.wav', 'hush 250']);
    vi.advanceTimersByTime(1);
    expect(sound.log).toEqual([
      'clip /api/speech/who.wav',
      'hush 250',
      'clip /api/speech/card.wav',
    ]);
  });
});
