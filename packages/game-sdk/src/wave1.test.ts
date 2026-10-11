// The D-010 wave-1 helpers (docs/ABSTRACTION_AUDIT.md rows 1, 3, 5, 6, 18, 21): each replaces the
// same few lines copied into several games, so each is pinned to what those copies did.
import { describe, expect, it } from 'vitest';
import type { GameManifest, GameStateBase, PlayerInfo } from '@partybox/shared';
import { seedRng } from '@partybox/shared';
import { joinNames, playerName } from './names';
import { isoDay, recapName } from './recap';
import {
  buildResults,
  completeScores,
  coopResults,
  rankPlayers,
  standingsWithDelta,
  teamResults,
} from './scoring';
import { boolSetting, numberSetting, picksSetting, readSettings, selectSetting } from './settings';
import { plurality } from './turns';

// Only `settings` is read: the rest of a manifest does not matter here.
const manifest = {
  id: 'demo',
  name: 'Demo',
  icon: '🎲',
  tagline: 'A demo',
  description: 'A demo game for the helper tests.',
  howToPlay: ['Play.'],
  version: '0.1.0',
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 5,
  tags: [],
  addedOn: '2026-01-01',
  settings: [
    { key: 'rounds', label: 'Rounds', type: 'number', default: 3, min: 1, max: 5, step: 1 },
    { key: 'secs', label: 'Seconds', type: 'number', default: 60, min: 30, max: 120, step: 15 },
    { key: 'spicy', label: 'Spicy', type: 'boolean', default: false },
    {
      key: 'reader',
      label: 'Reader',
      type: 'select',
      default: 'sky',
      options: [
        { value: 'none', label: 'None' },
        { value: 'sky', label: 'Sky' },
      ],
    },
    {
      key: 'topics',
      label: 'Topics',
      type: 'multiselect',
      default: '',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    },
  ],
} as unknown as GameManifest;

function stateOf(ids: string[]): GameStateBase {
  const players: GameStateBase['players'] = {};
  for (const id of ids)
    players[id] = { id, name: id.toUpperCase(), avatarId: 'fox', connected: true };
  return { phase: { id: 'x', startedAt: 0, deadline: null }, rng: seedRng(1), players };
}

describe('settings (row 3)', () => {
  it('reads each kind against its spec, with the engine rule for bad or missing values', () => {
    const raw = { rounds: 9, secs: 50, spicy: true, reader: 'none', topics: 'b,x,a' };
    expect(numberSetting(manifest, raw, 'rounds')).toBe(5); // clamped
    expect(numberSetting(manifest, raw, 'secs')).toBe(45); // snapped to the 15 s step
    expect(numberSetting(manifest, {}, 'secs')).toBe(60); // default
    expect(numberSetting(manifest, { secs: '75' as never }, 'secs')).toBe(60); // not a number
    expect(boolSetting(manifest, raw, 'spicy')).toBe(true);
    expect(boolSetting(manifest, { spicy: 'yes' as never }, 'spicy')).toBe(false);
    expect(selectSetting<'none' | 'sky'>(manifest, raw, 'reader')).toBe('none');
    expect(selectSetting(manifest, { reader: 'bob' }, 'reader')).toBe('sky');
    expect(picksSetting(manifest, raw, 'topics')).toEqual(['a', 'b']);
    expect(readSettings(manifest, raw)).toEqual({
      rounds: 5,
      secs: 45,
      spicy: true,
      reader: 'none',
      topics: 'a,b',
    });
  });

  it('never throws for a key the manifest lacks', () => {
    expect(numberSetting(manifest, {}, 'nope')).toBe(0);
    expect(boolSetting(manifest, {}, 'rounds')).toBe(false);
    expect(selectSetting(manifest, {}, 'nope')).toBe('');
    expect(picksSetting(manifest, {}, 'nope')).toEqual([]);
  });
});

describe('recap and names (rows 1, 5)', () => {
  it('isoDay is the UTC calendar date, leap days and centuries included', () => {
    expect(isoDay(0)).toBe('1970-01-01');
    expect(isoDay(1_790_000_000_000)).toBe('2026-09-21');
    expect(isoDay(Date.UTC(2000, 1, 29, 23, 59))).toBe('2000-02-29');
    expect(isoDay(Date.UTC(2100, 2, 1))).toBe('2100-03-01');
    expect(isoDay(Date.UTC(1969, 11, 31, 12))).toBe('1969-12-31');
  });

  it('names players with a fallback, prefers the room names in a recap, and joins lists', () => {
    const state = stateOf(['p1', 'p2']);
    expect(playerName(state.players, 'p1')).toBe('P1');
    expect(playerName(state.players, 'zz')).toBe('?');
    expect(playerName(state.players, 'zz', '')).toBe('');
    expect(playerName(state.players, 'constructor')).toBe('?');
    expect(playerName(state.players, null)).toBe('?');
    const view = [{ id: 'p2', name: 'Ben' }];
    expect(playerName(view, 'p2')).toBe('Ben');
    expect(playerName(view, 'p1', '—')).toBe('—');
    const room: PlayerInfo[] = [{ id: 'p1', name: 'Ana', avatarId: 'fox', connected: true }];
    expect(recapName(room, state, 'p1')).toBe('Ana');
    expect(recapName(room, state, 'p2')).toBe('P2');
    expect(recapName(room, state, 'zz')).toBe('zz');
    expect(joinNames([])).toBe('');
    expect(joinNames(['Ana'])).toBe('Ana');
    expect(joinNames(['Ana', 'Ben'])).toBe('Ana and Ben');
    expect(joinNames(['Ana', 'Ben', 'Cy'])).toBe('Ana, Ben and Cy');
    expect(joinNames(['Ana', 'Ben'], 'y')).toBe('Ana y Ben');
  });
});

describe('standings and results (rows 6, 18)', () => {
  const state = stateOf(['p1', 'p2', 'p3']);

  it('ranks every player with their gain since a round began', () => {
    expect(completeScores(state, { p1: 5, p4: 9, p2: Number.NaN })).toEqual({
      p1: 5,
      p2: 0,
      p3: 0,
    });
    expect(rankPlayers(state, { p2: 4 }).map((r) => r.playerId)).toEqual(['p2', 'p1', 'p3']);
    expect(standingsWithDelta(['p1', 'p2', 'p3'], { p1: 5, p2: 5 }, { p1: 2 })).toEqual([
      { playerId: 'p1', score: 5, rank: 1, delta: 3 },
      { playerId: 'p2', score: 5, rank: 1, delta: 5 },
      { playerId: 'p3', score: 0, rank: 3, delta: 0 },
    ]);
  });

  it('co-op crowns the room or nobody; teams name the winner, a headline only when there is one', () => {
    const base = buildResults(state, { p1: 3, p2: 3, p3: 3 });
    const won = coopResults(base, true, '📡 Crystal clear!');
    expect(won.winnerIds).toEqual(['p1', 'p2', 'p3']);
    expect(won.outcome).toEqual({ kind: 'coop', won: true });
    expect(won.headline).toBe('📡 Crystal clear!');
    expect(coopResults(base, false).winnerIds).toEqual([]);
    expect('headline' in coopResults(base, false)).toBe(false);
    expect(coopResults(base, true, undefined, ['p3', 'p1']).winnerIds).toEqual(['p3', 'p1']);
    const teams = [
      { id: 'sun', name: 'Sun', mark: '▲', members: ['p1'] },
      { id: 'moon', name: 'Moon', mark: '●', members: ['p2', 'p3'] },
    ];
    const t = teamResults(base, { winner: 'moon', teams }, 'Moon wins! ●');
    expect(t.outcome).toEqual({ kind: 'teams', winner: 'moon', teams });
    expect(t.headline).toBe('Moon wins! ●');
    expect('headline' in teamResults(base, { winner: null, teams }, '')).toBe(false);
  });
});

describe('plurality (row 21)', () => {
  it('is the one choice with the most votes, null on a tie or no votes', () => {
    expect(plurality({ a: 'left', b: 'left', c: 'right' })).toBe('left');
    expect(plurality({ a: 'left', b: 'right' })).toBeNull();
    expect(plurality({ a: null, b: undefined })).toBeNull();
    expect(plurality({ a: 3, b: 3, c: 7, d: 7, e: 7 })).toBe(7);
    expect(plurality({ a: 3, b: 3, c: 7, d: 7 })).toBeNull();
  });
});
