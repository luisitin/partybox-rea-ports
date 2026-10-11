// The game pack's manifest fields (Part 00 §1.2, ADR-049): the schema must refuse what the picker
// cannot show, because zod would otherwise strip or pass it silently.
import { describe, expect, it } from 'vitest';
import { gameManifestSchema } from './contract';

const base = {
  id: 'quiz',
  name: 'Quiz',
  icon: '❓',
  tagline: 'Quick questions.',
  description: 'Answer questions.',
  howToPlay: ['Read the question.', 'Tap an answer.', 'Fastest right answer wins.'],
  version: '1.0.0',
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 6,
  tags: ['trivia'],
  category: 'classics',
  presence: { needs: 'anywhere' },
  addedOn: '2026-09-24',
  settings: [],
};
const ok = (patch: Record<string, unknown>): boolean =>
  gameManifestSchema.safeParse({ ...base, ...patch }).success;

describe('manifest: game pack fields', () => {
  it('accepts a complete manifest, a ZWJ emoji and a flag', () => {
    expect(ok({})).toBe(true);
    expect(ok({ icon: '🧑‍🍳' })).toBe(true);
    expect(ok({ icon: '🇲🇽' })).toBe(true);
    expect(ok({ icon: '✏️' })).toBe(true);
  });
  it('refuses two emoji, no icon, or text for an icon', () => {
    expect(ok({ icon: '🎱🎱' })).toBe(false);
    expect(ok({ icon: '' })).toBe(false);
    expect(ok({ icon: 'ab' })).toBe(false);
    expect(ok({ icon: undefined })).toBe(false);
  });
  it('takes 1–3 tags from the list; quick is derived, never written', () => {
    expect(ok({ tags: [] })).toBe(false);
    expect(ok({ tags: ['words', 'bluff', 'teams', 'co-op'] })).toBe(false);
    expect(ok({ tags: ['party'] })).toBe(false);
    expect(ok({ tags: ['quick'] })).toBe(false);
    expect(ok({ tags: ['classic'] })).toBe(true);
  });
  it('wants exactly three how-to-play steps of at most 90 characters', () => {
    expect(ok({ howToPlay: ['a', 'b'] })).toBe(false);
    expect(ok({ howToPlay: ['a', 'b', 'c', 'd'] })).toBe(false);
    expect(ok({ howToPlay: ['a', 'b', 'x'.repeat(91)] })).toBe(false);
    expect(ok({ howToPlay: ['a', 'b', 'x'.repeat(90)] })).toBe(true);
  });
  it('holds the tagline to 60 and the description to 300 characters', () => {
    expect(ok({ tagline: 'x'.repeat(61) })).toBe(false);
    expect(ok({ description: 'x'.repeat(301) })).toBe(false);
  });
  it('needs a presence from the list and an ISO addedOn', () => {
    expect(ok({ presence: { needs: 'somewhere' } })).toBe(false);
    expect(ok({ presence: { needs: 'voice-if-remote', note: 'Join a call.' } })).toBe(true);
    expect(ok({ addedOn: 'yesterday' })).toBe(false);
  });
});
