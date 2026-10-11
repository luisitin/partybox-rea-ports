// The D-010 wave-2 helpers (docs/ABSTRACTION_AUDIT.md rows 9, 16, 19 and 20): the awards every
// game hands out, with each game's tie policy, the frame every recap shares, a pause's clocks and
// the patience net under a ready-up.
import { describe, expect, it } from 'vitest';
import type { GameStateBase } from '@partybox/shared';
import { seedRng } from '@partybox/shared';
import { pickAwards } from './awards';
import type { AwardRule } from './awards';
import { recapMarkdown } from './recap';
import { patienceNet, pausedFor, shiftClocks } from './timer';

const stats: Record<string, number> = { a: 3, b: 3, c: 1, d: 0 };
const most: AwardRule = { id: 'most', title: 'Most', description: (n) => `${n} of them`, value: (id) => stats[id] ?? 0 }; // prettier-ignore
const ids = ['a', 'b', 'c', 'd'];

describe('pickAwards', () => {
  it('shares a tie with every holder, or not at all past a cap', () => {
    expect(pickAwards([most], { candidates: ids, ties: { kind: 'share' } })).toEqual([
      { id: 'most', title: 'Most', description: '3 of them', playerId: 'a' },
      { id: 'most', title: 'Most', description: '3 of them', playerId: 'b' },
    ]);
    expect(pickAwards([most], { candidates: ids, ties: { kind: 'share', max: 1 } })).toEqual([]);
    expect(pickAwards([most], { candidates: ids, ties: { kind: 'share', fraction: 0.4 } })).toEqual([]); // prettier-ignore
    const ided = pickAwards([most], {
      candidates: ids,
      ties: { kind: 'share' },
      idFor: (r, _p, i) => (i === 0 ? r.id : `${r.id}-${i + 1}`),
    });
    expect(ided.map((x) => x.id)).toEqual(['most', 'most-2']);
  });

  it('gives a tie to nobody, or to one holder by the game’s order', () => {
    expect(pickAwards([most], { candidates: ids, ties: { kind: 'none' } })).toEqual([]);
    const byName = (x: string, y: string): number => (x < y ? 1 : -1);
    const one = pickAwards([most], { candidates: ids, ties: { kind: 'one', order: byName } });
    expect(one.map((x) => x.playerId)).toEqual(['b']);
    expect(pickAwards([most], { candidates: ids, ties: { kind: 'one' } })[0]?.playerId).toBe('a');
  });

  it('spreads awards: on a tie, someone without one yet comes first (I-474)', () => {
    const again: AwardRule = { ...most, id: 'again' };
    const got = pickAwards([most, again], { candidates: ids, ties: { kind: 'one', spread: true } });
    expect(got.map((x) => `${x.id}:${x.playerId}`)).toEqual(['most:a', 'again:b']);
    const won = new Set(['a']); // a game's own award went to Ana first
    const later = pickAwards([most], { candidates: ids, ties: { kind: 'one', spread: true }, won });
    expect(later[0]?.playerId).toBe('b');
    expect([...won]).toEqual(['a', 'b']);
  });

  it('skips what nobody earned, honours `min`, `lowest` and players not in the running', () => {
    const none: AwardRule = { ...most, value: () => 0 };
    expect(pickAwards([none], { candidates: ids, ties: { kind: 'share' } })).toEqual([]);
    const high: AwardRule = { ...most, min: 4 };
    expect(pickAwards([high], { candidates: ids, ties: { kind: 'share' } })).toEqual([]);
    const fastest: AwardRule = {
      id: 'fast',
      title: 'Fast',
      description: 'Fastest',
      lowest: true,
      value: (id) => ({ a: 900, b: 700, c: null, d: 700 })[id] ?? null,
    };
    expect(
      pickAwards([fastest], { candidates: ids, ties: { kind: 'share' } }).map((x) => x.playerId),
    ).toEqual(['b', 'd']);
  });
});

describe('recapMarkdown', () => {
  const name = (id: string): string => ({ a: 'Ana', b: 'Ben' })[id] ?? id;

  it('frames a finished game: title and date, body, final scores, awards', () => {
    const { markdown } = recapMarkdown({
      title: 'Wisecrack',
      at: Date.UTC(2026, 8, 26, 20),
      endedEarly: false,
      body: ['## Round 1', '', '- a joke'],
      ranking: [
        { playerId: 'a', rank: 1, score: 5 },
        { playerId: 'b', rank: 2, score: 3 },
      ],
      awards: [{ id: 'x', title: 'Crowd favourite', description: 'Most votes: 5', playerId: 'a' }],
      name,
    });
    expect(markdown).toBe(
      [
        '# Wisecrack · 2026-09-26',
        '',
        '## Round 1',
        '',
        '- a joke',
        '',
        '## Final scores',
        '',
        '1. Ana — 5',
        '2. Ben — 3',
        '',
        '## Awards',
        '',
        '- Crowd favourite: Ana (Most votes: 5)',
        '',
      ].join('\n'),
    );
  });

  it('says an ended game was ended early and leaves empty parts out', () => {
    const recap = recapMarkdown({ title: 'Echo', at: 0, endedEarly: true, body: [], name });
    expect(recap).toEqual({ markdown: '# Echo · 1970-01-01\n\n_The game was ended early._\n' });
    const es = { endedEarly: '_Terminó antes._', scores: '## Puntos', awards: '## Premios' };
    const ranking = [{ playerId: 'a', rank: 1, score: 2 }];
    const spanish = recapMarkdown({ title: 'X', at: 0, endedEarly: true, body: [], ranking, name, labels: es }); // prettier-ignore
    expect(spanish.markdown).toBe(
      '# X · 1970-01-01\n\n_Terminó antes._\n\n## Puntos\n\n1. Ana — 2\n',
    );
    const files = [{ name: 'a.svg', body: '<svg/>' }];
    expect(recapMarkdown({ title: 'X', at: 0, endedEarly: false, body: ['hi'], name, files }).files).toEqual(files); // prettier-ignore
  });
});

describe('pausedFor / shiftClocks (audit #20)', () => {
  const running: GameStateBase = {
    phase: { id: 'play', startedAt: 1_000, deadline: 9_000 },
    rng: seedRng(1),
    players: {},
  };
  const paused: GameStateBase = { ...running, phase: { ...running.phase, paused: { at: 4_000 } } };

  it('pausedFor: how long the phase has been paused, 0 while it runs or before the pause', () => {
    expect(pausedFor(paused, 6_500)).toBe(2_500);
    expect(pausedFor(paused, 3_000)).toBe(0);
    expect(pausedFor(running, 6_500)).toBe(0);
  });

  it('shiftClocks moves the named timestamps and leaves unset ones and the rest alone', () => {
    const r = {
      popAt: 5_000,
      resumeAt: null as number | null,
      at: undefined as number | undefined,
      n: 3,
    };
    const out = shiftClocks(r, ['popAt', 'resumeAt', 'at'], 2_500);
    expect(out).toEqual({ popAt: 7_500, resumeAt: null, at: undefined, n: 3 });
    expect(Object.keys(out)).toEqual(Object.keys(r));
    expect(r.popAt).toBe(5_000);
  });
});

describe('patienceNet (audit #19)', () => {
  const at0: GameStateBase = {
    phase: { id: 'seating', startedAt: 0, deadline: 0 },
    rng: seedRng(1),
    players: {},
  };
  /** The deadlines a busy room's net sets, firing on time, until it moves on. */
  function walk(stepMs: number, capMs: number): number[] {
    const out: number[] = [];
    let s: GameStateBase | null = { ...at0, phase: { ...at0.phase, deadline: stepMs } };
    while (s && s.phase.deadline !== null) {
      out.push(s.phase.deadline);
      s = patienceNet(s, s.phase.deadline, { busy: true, stepMs, capMs });
    }
    return out;
  }

  it('an idle room moves on at the first check', () => {
    expect(patienceNet(at0, 180_000, { busy: false, stepMs: 180_000, capMs: 600_000 })).toBeNull();
  });

  it("re-arms a busy room and lands the last check on the cap (Secret Hitler's seating)", () => {
    expect(walk(180_000, 600_000)).toEqual([180_000, 360_000, 540_000, 600_000]);
  });

  it('never re-arms past the cap, however late a check fires (a pause moves the deadline)', () => {
    const late = { ...at0, phase: { ...at0.phase, startedAt: 0, deadline: 541_201 } };
    const net = { busy: true, stepMs: 180_000, capMs: 540_000 };
    expect(patienceNet(late, 361_201, net)?.phase.deadline).toBe(540_000);
    expect(patienceNet(late, 540_000, net)).toBeNull();
  });
});
