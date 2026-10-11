// `@partybox/game-sdk/speech` — what a game's server code uses to build its readings (ADR-045,
// Part 00 §5): toSpeakable, the pronunciation lists, speech keys. Server-only: it carries zod and
// the override lists, so no client file may import it (dependency-cruiser). Pure.
export { PLAYER_TEXT_MAX, speakableName, toSpeakable } from './speech/speakable';
export type { SpeakableOptions } from './speech/speakable';
export { parsePronunciations, pronunciationsSchema } from './speech/overrides';
export type { Override, Pronunciations, PronunciationsFile } from './speech/overrides';
export { SPEECH_ENGINE_VERSION, pendingCap, speechHash, speechKey } from './speech/key';
export {
  drainSpeech,
  madeMs,
  playable,
  reader,
  speechLine,
  speechUrl,
  uniqueReadings,
} from './speech/reader';
export type { LineOptions, Reader, ReaderOptions, SpeechLengths } from './speech/reader';
export { unknownPhonemes } from './speech/letters';
export { SPEECH_KEY_PATTERN } from '@partybox/shared';
export type { SpeechPart, SpeechRequest } from '@partybox/shared';
