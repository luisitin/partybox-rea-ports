// The reader helpers (audit #7): a line keeps the key a game built by hand, speech() drains as every
// game did, and a view gets a key only once its audio exists.
import { describe, expect, it } from 'vitest';
import type { SpeechRequest } from '@partybox/shared';
import { speechKey } from './key';
import { parsePronunciations } from './overrides';
import { drainSpeech, madeMs, playable, reader, speechLine, speechUrl } from './reader';
import { toSpeakable } from './speakable';

const OVERRIDES = parsePronunciations({
  words: { Gif: { say: 'jif' } },
  items: { 'q-1': { Nguyen: { say: 'win' } } },
});

const req = (key: string): SpeechRequest => ({ key, voice: 'fable', parts: [{ text: key }] });

describe('reader', () => {
  it('is null when nobody reads aloud', () => {
    expect(reader('echo', 'none')).toBeNull();
    expect(reader('echo', '')).toBeNull();
    expect(reader('echo', null)).toBeNull();
    expect(reader('echo', undefined)).toBeNull();
  });

  it('builds the request a game built by hand: toSpeakable parts under speechKey', () => {
    const cases = [
      { text: 'Send the GIF, Nguyen!', opts: {} },
      { text: 'Send the GIF, Nguyen!', opts: { itemId: 'q-1' } },
      { text: 'NOOOO way!!!', opts: { playerText: true } },
      { text: 'It was both Ana and Eli!', opts: { playerText: true, itemId: 'q-1' } },
    ];
    for (const { text, opts } of cases) {
      const parts = toSpeakable(text, {
        voice: 'fable',
        lang: 'en',
        overrides: OVERRIDES,
        ...opts,
      });
      const byHand = { key: speechKey('who-said-it', 'fable', parts), voice: 'fable', parts };
      const r = reader('who-said-it', 'fable', { overrides: OVERRIDES });
      expect(r?.line(text, opts)).toEqual(byHand);
      expect(speechLine('who-said-it', 'fable', text, { overrides: OVERRIDES, ...opts })).toEqual(
        byHand,
      );
      // Same field order as the hand-built request (views and golden traces compare JSON).
      expect(JSON.stringify(r?.line(text, opts))).toBe(JSON.stringify(byHand));
    }
  });

  it('reads Spanish and no-override lines like toSpeakable does', () => {
    const es = toSpeakable('¿Listos?', { voice: 'sky', lang: 'es' });
    expect(reader('x', 'sky', { lang: 'es' })?.line('¿Listos?').parts).toEqual(es);
    const en = toSpeakable('Place your bets!', { voice: 'sky', lang: 'en' });
    expect(reader('blind-auction', 'sky')?.line('Place your bets!')).toEqual({
      key: speechKey('blind-auction', 'sky', en),
      voice: 'sky',
      parts: en,
    });
  });

  it('keeps empty parts (a game decides whether such a line is asked for)', () => {
    const r = reader('echo', 'fable');
    expect(r?.line('🎉🎉').parts).toEqual([]);
    expect(r?.line('🎉🎉').key).toBe(speechKey('echo', 'fable', []));
  });

  it('takes parts a game made itself, under the same key', () => {
    const parts = [{ text: 'Ocean, three.' }];
    expect(reader('spy-grid', 'george')?.parts(parts)).toEqual({
      key: speechKey('spy-grid', 'george', parts),
      voice: 'george',
      parts,
    });
  });
});

describe('drainSpeech', () => {
  it('keeps order, drops nulls, repeats and made or failed keys', () => {
    const wanted = [req('a'), null, req('b'), req('a'), undefined, req('c'), req('d')];
    expect(drainSpeech(wanted, { b: 900, c: -1 }, 10).map((r) => r.key)).toEqual(['a', 'd']);
  });

  it('stops at max, counting only what it returns', () => {
    const wanted = ['a', 'b', 'c', 'd', 'e'].map(req);
    expect(drainSpeech(wanted, { a: 1 }, 2).map((r) => r.key)).toEqual(['b', 'c']);
    expect(drainSpeech(wanted, {}, Number.POSITIVE_INFINITY)).toHaveLength(5);
    expect(drainSpeech(wanted, {}, 0)).toEqual([]);
  });

  it('returns the requests themselves', () => {
    const a = req('a');
    expect(drainSpeech([a], {}, 10)[0]).toBe(a);
  });
});

describe('madeMs / playable / speechUrl', () => {
  const made = { a: 1200, f: -1 };
  it('madeMs: the length, -1 when failed, undefined while pending or with no request', () => {
    expect(madeMs(made, req('a'))).toBe(1200);
    expect(madeMs(made, req('f'))).toBe(-1);
    expect(madeMs(made, req('p'))).toBeUndefined();
    expect(madeMs(made, null)).toBeUndefined();
  });

  it('playable: key and url only once the audio exists', () => {
    expect(playable(made, req('a'))).toEqual({ key: 'a', url: '/api/speech/a.wav' });
    expect(playable({ z: 0 }, req('z'))).toEqual({ key: 'z', url: '/api/speech/z.wav' });
    expect(playable(made, req('f'))).toBeNull();
    expect(playable(made, req('p'))).toBeNull();
    expect(playable(made, undefined)).toBeNull();
  });

  it('speechUrl: where the host serves a key', () => {
    expect(speechUrl('echo-0123456789abcdef')).toBe('/api/speech/echo-0123456789abcdef.wav');
  });
});
