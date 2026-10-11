// Speech keys and how many readings a game keeps in flight (ADR-045 addendum; audit #18, #48; the
// owner's ruling 17). A key names the audio for good — the host serves it `immutable` — so it
// hashes everything that shapes that audio: the engine, the voice and the exact parts. There is no
// per-host salt: the same line hits the cache in any room, on any night. Pure.
import type { SpeechPart } from '@partybox/shared';

/**
 * Bump when the same parts in the same voice would sound different: a new Kokoro model or voice
 * file, a voice's speed or accent (packages/server/src/speech.ts `KOKORO`), the sidecar's
 * phonemiser, Zira's prosody, or the loudness every reading is levelled to (ruling 18). Every key
 * changes with it. 2: every voice levelled to one loudness (T-0137).
 */
export const SPEECH_ENGINE_VERSION = '2';

/** murmur3's finaliser: spreads the last characters' bits over the whole word. */
function mix(h: number): number {
  let x = h ^ (h >>> 16);
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** 64 bits as 16 hex digits: two FNV-1a lanes with different bases and primes (no node:crypto in
 *  pure code). Collisions across a lifetime of lines are negligible at 64 bits; at 32 they are not. */
export function speechHash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x050c5d1f;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return mix(a).toString(16).padStart(8, '0') + mix(b).toString(16).padStart(8, '0');
}

/**
 * `<gameId>-<16 hex>`, e.g. `fake-out-3f9a1c0b2d4e5f60`: what SpeechRequest.key should be. The
 * hash is over `SPEECH_ENGINE_VERSION|voice|JSON(parts)`, each part rewritten as `{ ipa, text }` or
 * `{ text }` first, so key order or a stray field cannot split one line into two keys. Every game
 * id fits the host's key pattern (SPEECH_KEY_PATTERN).
 */
export function speechKey(gameId: string, voice: string, parts: readonly SpeechPart[]): string {
  const canonical = parts.map((p) =>
    'ipa' in p ? { ipa: p.ipa, text: p.text } : { text: p.text },
  );
  const hash = speechHash(`${SPEECH_ENGINE_VERSION}|${voice}|${JSON.stringify(canonical)}`);
  return `${gameId}-${hash}`;
}

/**
 * How many readings a state may ask for at once (§5.7, audit #48): ten, or one per player plus
 * the question when the room is bigger — Blanks asks for the question and every played card.
 */
export function pendingCap(players: number): number {
  return Number.isFinite(players) ? Math.max(10, Math.floor(players) + 1) : 10;
}
