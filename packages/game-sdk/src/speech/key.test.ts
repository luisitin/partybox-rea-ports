// Speech keys (ADR-045 addendum, audit #18, ruling 17) and the pending-readings cap (audit #48).
import { describe, expect, it } from 'vitest';
import type { SpeechPart } from '@partybox/shared';
import { SPEECH_KEY_PATTERN } from '@partybox/shared';
import { SPEECH_ENGINE_VERSION, pendingCap, speechHash, speechKey } from './key';
import { toSpeakable } from './speakable';

const LINE: SpeechPart[] = [{ text: 'The word was' }, { ipa: 'kˈiːnwɑː', text: 'keen-wah' }];

describe('speechKey', () => {
  it('is the game id, a hyphen and 16 hex digits, and fits the host key pattern', () => {
    const key = speechKey('fake-out', 'fable', LINE);
    expect(key).toMatch(/^fake-out-[0-9a-f]{16}$/);
    expect(SPEECH_KEY_PATTERN.test(key)).toBe(true);
    // The longest game id the manifest allows still fits.
    expect(SPEECH_KEY_PATTERN.test(speechKey(`a${'b'.repeat(31)}`, 'sky', LINE))).toBe(true);
  });
  it('is stable: the same input gives the same key, call after call', () => {
    expect(speechKey('fake-out', 'fable', LINE)).toBe(speechKey('fake-out', 'fable', [...LINE]));
    // Pinned: changing the hash re-renders every cached line in every room. To make that happen
    // on purpose, bump SPEECH_ENGINE_VERSION and update this line.
    expect(speechKey('fake-out', 'fable', LINE)).toBe('fake-out-ceabf471d93a1453');
  });
  it('hashes the engine version, the voice and the parts', () => {
    const expected = speechHash(`${SPEECH_ENGINE_VERSION}|fable|${JSON.stringify(LINE)}`);
    expect(speechKey('fake-out', 'fable', LINE)).toBe(`fake-out-${expected}`);
  });
  it('changes with the voice, the words, the phonemes or the game', () => {
    const base = speechKey('fake-out', 'fable', LINE);
    const others = [
      speechKey('fake-out', 'george', LINE),
      speechKey('fake-out', 'fable', [
        { text: 'The word was' },
        { ipa: 'kˈiːnwɑː', text: 'quinoa' },
      ]),
      speechKey('fake-out', 'fable', [
        { text: 'The word was' },
        { ipa: 'kwɪnˈoʊə', text: 'keen-wah' },
      ]),
      speechKey('fake-out', 'fable', [{ text: 'The word was keen-wah' }]),
      speechKey('tune-in', 'fable', LINE),
    ];
    expect(new Set([base, ...others]).size).toBe(others.length + 1);
  });
  it("ignores the order of a part's fields and any stray field", () => {
    const shuffled = [
      { text: 'The word was' },
      { text: 'keen-wah', ipa: 'kˈiːnwɑː', extra: 1 } as SpeechPart,
    ];
    expect(speechKey('fake-out', 'fable', shuffled)).toBe(speechKey('fake-out', 'fable', LINE));
  });
  it('keys what toSpeakable gives the same way in every room', () => {
    const a = toSpeakable('The word was quinoa.', { voice: 'sky', lang: 'en' });
    const b = toSpeakable('The word was quinoa.', { voice: 'sky', lang: 'en' });
    expect(speechKey('imposter', 'sky', a)).toBe(speechKey('imposter', 'sky', b));
  });
});

describe('speechHash', () => {
  it('spreads nearby inputs apart and avoids collisions over many lines', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) seen.add(speechHash(`line ${i}`));
    expect(seen.size).toBe(20_000);
    expect(speechHash('a')).not.toBe(speechHash('b'));
  });
});

describe('pendingCap', () => {
  it('is ten, or one per player plus the question in a bigger room', () => {
    expect(pendingCap(3)).toBe(10);
    expect(pendingCap(9)).toBe(10);
    expect(pendingCap(12)).toBe(13);
    expect(pendingCap(16)).toBe(17);
    expect(pendingCap(Number.NaN)).toBe(10);
  });
});
