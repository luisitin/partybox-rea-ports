import { describe, expect, it } from 'vitest';
import { PHOTO_MAX_BYTES } from './constants';
import { joinPayloadSchema } from './protocol';
import {
  AVATAR_IDS,
  EVERYDAY_AVATAR_IDS,
  avatarFace,
  avatarTint,
  isAvatarId,
  isRoomCode,
  nameKey,
  normalizeName,
  normalizeRoomCode,
  roomCodeFrom,
  seasonalAvatarId,
} from './ids';
import { createRng } from './rng';

describe('room codes', () => {
  it('generates valid codes without ambiguous letters', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      const code = roomCodeFrom(rng);
      expect(isRoomCode(code)).toBe(true);
      expect(code).not.toMatch(/[01IOL]/);
    }
  });
  it('rejects wrong length or characters', () => {
    expect(isRoomCode('ABC')).toBe(false);
    expect(isRoomCode('ABCO')).toBe(false);
    expect(isRoomCode('abcd')).toBe(false);
    expect(isRoomCode(normalizeRoomCode(' abcd '))).toBe(true);
  });
});

describe('names', () => {
  it('trims, collapses and strips invisible characters', () => {
    expect(normalizeName('  Ana   Maria ')).toBe('Ana Maria');
    expect(normalizeName(`bob${String.fromCodePoint(0x200b, 0x202e)}`)).toBe('bob');
    expect(normalizeName('\t\n')).toBeNull();
    expect(normalizeName('')).toBeNull();
  });
  it('limits to 16 code points, counting emoji as one', () => {
    expect(normalizeName('abcdefghijklmnop')).toBe('abcdefghijklmnop');
    expect(normalizeName('abcdefghijklmnopq')).toBeNull();
    expect(normalizeName('😀'.repeat(16))).toHaveLength(32);
    expect(normalizeName('😀'.repeat(17))).toBeNull();
  });
  it('compares case-insensitively', () => {
    expect(nameKey('Ana')).toBe(nameKey('aNA'));
  });
});

describe('avatars', () => {
  it('has 16 everyday ids plus the three seasonal ones, all unique', () => {
    expect(new Set(AVATAR_IDS).size).toBe(19);
    expect(new Set(EVERYDAY_AVATAR_IDS).size).toBe(16);
    expect(isAvatarId('fox')).toBe(true);
    expect(isAvatarId('dragon')).toBe(false);
  });

  // I-086 A: a face may carry one of the eight player colours — `fox#3`.
  it('reads a colour slot beside the face, and ignores a bad one', () => {
    expect(isAvatarId('fox#3')).toBe(true);
    expect(isAvatarId('dragon#3')).toBe(false);
    expect([avatarFace('fox#3'), avatarTint('fox#3')]).toEqual(['fox', 3]);
    expect([avatarFace('fox'), avatarTint('fox')]).toEqual(['fox', null]);
    expect(avatarTint('fox#8')).toBeNull();
    expect(avatarTint('fox#x')).toBeNull();
  });

  // I-079 A: the seasonal faces are valid ids every day, so an old chip never breaks.
  it('offers a seasonal face only in its month', () => {
    expect(isAvatarId('pumpkin')).toBe(true);
    expect(seasonalAvatarId(new Date('2026-10-15T12:00:00'))).toBe('pumpkin');
    expect(seasonalAvatarId(new Date('2026-12-03T12:00:00'))).toBe('snowflake');
    expect(seasonalAvatarId(new Date('2026-02-14T12:00:00'))).toBe('heart');
    expect(seasonalAvatarId(new Date('2026-06-01T12:00:00'))).toBe(null);
  });
});

describe('joinPayloadSchema.photo (ADR-037)', () => {
  const base = { name: 'Sam', avatarId: 'fox' };
  it('takes a small JPEG data URL and nothing else', () => {
    expect(
      joinPayloadSchema.safeParse({ ...base, photo: 'data:image/jpeg;base64,/9j/4AAQ==' }).success,
    ).toBe(true);
    expect(joinPayloadSchema.safeParse({ ...base }).success).toBe(true);
    expect(
      joinPayloadSchema.safeParse({ ...base, photo: 'data:image/png;base64,iVBORw0=' }).success,
    ).toBe(false);
    expect(
      joinPayloadSchema.safeParse({ ...base, photo: 'https://example.com/a.jpg' }).success,
    ).toBe(false);
    expect(
      joinPayloadSchema.safeParse({
        ...base,
        photo: `data:image/jpeg;base64,${'A'.repeat(PHOTO_MAX_BYTES)}`,
      }).success,
    ).toBe(false);
  });
});

describe('names that render as nothing (2026-09-22)', () => {
  it('are rejected, however they are spelled', () => {
    for (const blank of ['ㅤ', 'ㅤㅤㅤ', '⠀⠀', 'ﾠ', 'ᅟᅠ', '᠎', '͏'])
      expect(normalizeName(blank)).toBeNull();
  });

  it('lose the invisible part and keep the rest', () => {
    expect(normalizeName('Samㅤ')).toBe('Sam');
    expect(normalizeName('⠀Priya⠀')).toBe('Priya');
  });
});
