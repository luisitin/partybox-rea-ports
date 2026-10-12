import { describe, expect, it } from 'vitest';
import { testPlayers } from '@partybox/game-sdk/testing';
import { createRng } from '@partybox/game-sdk';
import { game } from '../server/index';
import { MAX_STROKES, CHOOSE_MS, BEAT_MS } from '../server/types';
import type { State } from '../server/types';
import { deepFreeze, drawing, guesser, jsonBytes, kit, stroke, T0 } from './helpers';
const STATE_SIZE_LIMIT_BYTES = 256 * 1024;

describe('choice and drawing turns', () => {
  it('seats every player once, offers three distinct words privately, and gives eight seconds to choose', () => {
    const s = kit.start();
    expect(s.phase).toEqual({ id: 'choose', startedAt: T0, deadline: T0 + CHOOSE_MS });
    expect(s.order.slice().sort()).toEqual(Object.keys(s.players).sort());
    expect(s.order).toContain(s.drawer);
    expect(s.choices).toHaveLength(3);
    expect(new Set(s.choices).size).toBe(3);
    expect(game.controllerView(s, s.drawer).choices).toEqual(s.choices);
    expect(game.results(s)).toBeNull();
  });

  it('the drawer picks the selected word; the choice timeout picks a valid fallback', () => {
    const s = kit.start();
    const chosen = kit.input(s, s.drawer, { type: 'choose', index: 2 });
    expect(chosen.phase.id).toBe('draw');
    expect(chosen.word).toBe(s.choices[2]);
    expect(chosen.endsAt - chosen.began).toBe(30_000);
    expect(chosen.phase.deadline).toBe(chosen.began + BEAT_MS);
    const fallback = kit.timer(s);
    expect(fallback.phase.id).toBe('draw');
    expect(s.choices).toContain(fallback.word);
  });

  it('ignores choices from guessers and spectators, including prototype names', () => {
    const s = kit.start();
    for (const id of [guesser(s), 'spectator', '__proto__', 'constructor', '']) {
      expect(kit.input(s, id, { type: 'choose', index: 0 })).toEqual(s);
    }
  });

  it('skips an artist who drops during word choice without showing an empty reveal', () => {
    const s = kit.start();
    const next = kit.player(s, s.drawer, false, undefined, T0 + 1000);
    expect(next.phase.id).toBe('choose');
    expect(next.drawer).not.toBe(s.drawer);
    expect(next.turn).toBe(s.turn + 1);
    expect(next.phase.startedAt).toBe(T0 + 1000);
    expect(next.phase.deadline).toBe(T0 + 1000 + CHOOSE_MS);
    expect(next.word).toBe('');
    expect(next.strokes).toEqual([]);
    expect(next.scores).toEqual(s.scores);
    const pair = kit.start({ players: testPlayers(2) });
    expect(kit.player(pair, pair.drawer, false).phase.id).toBe('done');
  });

  it('holds a dropped word chooser while paused, then rotates immediately on resume', () => {
    const s = kit.start();
    const paused = kit.vip(s, 'pause', T0 + 500);
    const dropped = kit.player(paused, s.drawer, false, undefined, T0 + 1000);
    expect(dropped.phase.id).toBe('choose');
    expect(dropped.drawer).toBe(s.drawer);
    expect(dropped.phase.paused).toBeDefined();
    const resumed = kit.vip(dropped, 'resume', T0 + 5000);
    expect(resumed.phase.id).toBe('choose');
    expect(resumed.drawer).not.toBe(s.drawer);
    expect(resumed.turn).toBe(s.turn + 1);
    expect(resumed.phase.paused).toBeUndefined();
    expect(resumed.phase.startedAt).toBe(T0 + 5000);
    expect(resumed.phase.deadline).toBe(T0 + 5000 + CHOOSE_MS);
  });

  it('ignores an old chooser packet after rotation, even if that artist has reconnected', () => {
    const s = kit.start();
    const rotated = kit.player(s, s.drawer, false, undefined, T0 + 1000);
    const rejoined = kit.player(rotated, s.drawer, true, undefined, T0 + 1500);
    expect(kit.input(rejoined, s.drawer, { type: 'choose', index: 0 }, T0 + 1600)).toEqual(
      rejoined,
    );
    expect(kit.input(rejoined, s.drawer, { type: 'choose', index: 1 }, T0 + 900)).toEqual(rejoined);
  });

  it('only the connected drawer may paint, clear or undo, and undo preserves earlier strokes', () => {
    const s = drawing();
    const painted = kit.input(s, s.drawer, { type: 'stroke', stroke });
    expect(painted.strokes).toEqual([stroke]);
    const second = { ...stroke, color: 3, points: [[400, 200]] } as typeof stroke;
    const two = kit.input(painted, s.drawer, { type: 'stroke', stroke: second }, s.began + 1500);
    expect(kit.input(two, s.drawer, { type: 'undo' }, s.began + 1600).strokes).toEqual([stroke]);
    expect(kit.input(two, s.drawer, { type: 'clear' }, s.began + 1700).strokes).toEqual([]);
    for (const id of [guesser(s), 'spectator', '__proto__', 'constructor']) {
      for (const input of [
        { type: 'stroke', stroke },
        { type: 'undo' },
        { type: 'clear' },
      ] as const) {
        expect(kit.input(painted, id, input).strokes).toEqual([stroke]);
      }
    }
    const disconnected = kit.player(painted, s.drawer, false, undefined, s.began + 1100);
    expect(
      kit.input(disconnected, s.drawer, { type: 'stroke', stroke }, s.began + 1200).strokes,
    ).toEqual([stroke]);
  });

  it('caps drawings, rejects invalid payloads at the schema boundary, and stays within wire budgets', () => {
    let s = drawing();
    for (let i = 0; i < MAX_STROKES + 25; i++) {
      s = kit.input(s, s.drawer, { type: 'stroke', stroke }, s.began + 1000 + i);
    }
    expect(s.strokes).toHaveLength(MAX_STROKES);
    expect(jsonBytes(s)).toBeLessThanOrEqual(STATE_SIZE_LIMIT_BYTES);
    expect(jsonBytes(game.tvView(s))).toBeLessThanOrEqual(64 * 1024);
    for (const input of [
      { type: 'stroke', stroke: { ...stroke, points: Array(25).fill([1, 1]) } },
      { type: 'stroke', stroke: { ...stroke, points: [[1001, 1]] } },
      { type: 'stroke', stroke: { ...stroke, points: [[1, -1]] } },
      { type: 'stroke', stroke: { ...stroke, color: 6 } },
      { type: 'stroke', stroke: { ...stroke, width: 100 } },
      { type: 'choose', index: 3 },
      { type: 'guess', text: 'x'.repeat(41) },
      { type: 'guess', text: '' },
    ])
      expect(game.inputSchema.safeParse(input).success).toBe(false);
    expect(jsonBytes({ type: 'stroke', stroke })).toBeLessThanOrEqual(
      game.manifest.maxInputBytes ?? 16384,
    );
  });

  it('quantizes adversarial decimal strokes so a full 240-stroke view remains below 64 KiB', () => {
    let s = drawing();
    const large = {
      ...stroke,
      points: Array.from({ length: 24 }, (_, i): [number, number] => [
        999.1234567890123 - i / 7,
        599.1234567890123 - i / 11,
      ]),
    };
    for (let i = 0; i < MAX_STROKES; i++)
      s = kit.input(s, s.drawer, { type: 'stroke', stroke: large }, s.began + 1000 + i);
    expect(s.strokes).toHaveLength(MAX_STROKES);
    expect(
      s.strokes.every((line) => line.points.every((point) => point.every(Number.isInteger))),
    ).toBe(true);
    expect(jsonBytes(game.tvView(s))).toBeLessThanOrEqual(64 * 1024);
    for (const id of [...Object.keys(s.players), 'spectator'])
      expect(jsonBytes(game.controllerView(s, id))).toBeLessThanOrEqual(64 * 1024);
  });

  it('timer beats reveal hints at a third and two thirds, preserve the end, then reveal the answer', () => {
    let s = drawing();
    const end = s.endsAt;
    const advanceTo = (elapsed: number): void => {
      while (s.phase.id === 'draw' && s.phase.deadline! <= s.began + elapsed) s = kit.timer(s);
    };
    advanceTo(8000);
    expect(s.hintCount).toBe(0);
    advanceTo(10_000);
    expect(s.hintCount).toBe(1);
    advanceTo(20_000);
    expect(s.hintCount).toBe(2);
    expect(s.endsAt).toBe(end);
    const secret = s.word;
    s = kit.finish(s, 40);
    expect(s.phase.id).toBe('reveal');
    expect(game.tvView(s).answer).toBe(secret);
  });

  it('every player draws once per lap and the final reveal continues into stable complete results', () => {
    for (const laps of [1, 2]) {
      let s = kit.start({ settings: { laps }, players: testPlayers(8) });
      const artists: string[] = [];
      let guard = 0;
      while (s.phase.id !== 'done' && guard++ < 1200) {
        if (s.phase.id === 'choose') artists.push(s.drawer);
        if (s.phase.id === 'draw') s = kit.finish(s, 40);
        else s = kit.timer(s);
      }
      expect(s.phase.id).toBe('done');
      expect(artists).toHaveLength(8 * laps);
      for (const id of Object.keys(s.players))
        expect(artists.filter((x) => x === id)).toHaveLength(laps);
      const r = game.results(s);
      expect(r?.ranking.map((row) => row.playerId).sort()).toEqual(Object.keys(s.players).sort());
      expect(r?.winnerIds.length).toBeGreaterThan(0);
      expect(kit.timer(s)).toEqual(s);
      expect(kit.input(s, s.drawer, { type: 'clear' })).toEqual(s);
    }
  });
});

describe('guesses and points', () => {
  it('awards 300 base plus 700 times remaining time, only once; the artist also earns points', () => {
    const s = drawing();
    const id = guesser(s);
    const now = s.began + 6000;
    const next = kit.input(s, id, { type: 'guess', text: s.word }, now);
    expect(next.scores[id]).toBe(300 + Math.floor((700 * 24_000) / 30_000));
    expect(next.gains[id]).toBe(next.scores[id]);
    expect(next.scores[s.drawer]).toBeGreaterThan(0);
    expect(Object.keys(next.solved)).toContain(id);
    const again = kit.input(next, id, { type: 'guess', text: s.word }, now + 1000);
    expect(again.scores).toEqual(next.scores);
    expect(again.solved).toEqual(next.solved);
  });

  it('uses the shared matcher for uppercase and punctuation; a wrong guess neither scores nor solves', () => {
    const s = drawing();
    const id = guesser(s);
    const wrong = kit.input(
      s,
      id,
      { type: 'guess', text: 'not a real drawing answer' },
      s.began + 1000,
    );
    expect(wrong.scores).toEqual(s.scores);
    expect(wrong.solved).toEqual({});
    const exact = kit.input(
      s,
      id,
      { type: 'guess', text: `THE ${s.word.toUpperCase()}!` },
      s.began + 2000,
    );
    expect(exact.scores[id]).toBeGreaterThan(0);
  });

  it('a faster guess scores more, and the drawer, disconnected seats and unknown ids cannot guess', () => {
    const s = drawing();
    const id = guesser(s);
    const early = kit.input(s, id, { type: 'guess', text: s.word }, s.began + 1000);
    const late = kit.input(s, id, { type: 'guess', text: s.word }, s.began + 29_000);
    expect(early.scores[id]).toBeGreaterThan(late.scores[id]!);
    for (const playerId of [s.drawer, 'spectator', '__proto__', 'constructor']) {
      expect(kit.input(s, playerId, { type: 'guess', text: s.word }).scores).toEqual(s.scores);
    }
    const dropped = kit.player(s, id, false, undefined, s.began + 500);
    expect(kit.input(dropped, id, { type: 'guess', text: s.word }).scores).toEqual(s.scores);
  });

  it('adds points to earlier turns instead of replacing either player total', () => {
    const s = drawing();
    const id = guesser(s);
    const prior = { ...s, scores: { ...s.scores, [id]: 1200, [s.drawer]: 2300 } };
    const next = kit.input(prior, id, { type: 'guess', text: s.word }, s.began + 6000);
    expect(next.scores[id]).toBe(1200 + 860);
    expect(next.scores[s.drawer]).toBe(2300 + 250);
  });

  it('a guess at or beyond the drawing cap never scores', () => {
    const s = drawing();
    for (const now of [s.endsAt, s.endsAt + 50_000]) {
      const next = kit.input(s, guesser(s), { type: 'guess', text: s.word }, now);
      expect(next.scores).toEqual(s.scores);
    }
  });

  it('all connected guessers solving ends the turn early, keeping the final drawing', () => {
    let s = drawing();
    s = kit.input(s, s.drawer, { type: 'stroke', stroke });
    const original = s;
    for (const id of s.order.filter((id) => id !== s.drawer)) {
      s = kit.input(s, id, { type: 'guess', text: s.word }, original.began + 2000);
    }
    expect(s.phase.id).toBe('reveal');
    expect(s.strokes).toEqual([stroke]);
    expect(game.tvView(s).solvedCount).toBe(3);
    expect(s.phase.startedAt).toBe(original.began + 2000);
  });
});

describe('secrets, lifecycle and determinism', () => {
  it('choices and the answer stay off every public surface until reveal, even after a correct guess', () => {
    for (const s of [kit.start(), drawing()]) {
      const altered = {
        ...s,
        word: 'zzzsafesecret',
        choices: ['zzzchoiceone', 'zzzchoicetwo', 'zzzchoicethree'],
      };
      for (const view of [
        game.tvView(altered),
        ...[guesser(s), 'spectator', '__proto__', 'constructor', ''].map((id) =>
          game.controllerView(altered, id),
        ),
      ]) {
        const text = JSON.stringify(view);
        for (const secret of [altered.word, ...altered.choices]) expect(text).not.toContain(secret);
      }
      for (const id of ['spectator', '__proto__', 'constructor', '']) {
        expect(game.controllerView(s, id).me).toEqual({ id, role: 'spectator' });
      }
    }
    const s = drawing();
    expect(game.controllerView(s, s.drawer).secret).toBe(s.word);
    const solved = kit.input(s, guesser(s), { type: 'guess', text: s.word });
    expect(JSON.stringify(game.tvView(solved))).not.toContain(s.word);
    expect(game.controllerView(solved, guesser(s)).secret).toBeUndefined();
  });

  it('views are identical when unrevealed secrets alone change, and bots cannot peek at them', () => {
    const s = drawing();
    const other = {
      ...s,
      word: 'q'.repeat(s.word.length),
      choices: s.choices.map((word) => 'z'.repeat(word.length)),
    };
    expect(game.tvView(other)).toEqual(game.tvView(s));
    for (const id of [guesser(s), 'spectator', '__proto__']) {
      expect(game.controllerView(other, id)).toEqual(game.controllerView(s, id));
      for (const skill of ['easy', 'normal', 'sharp'] as const) {
        expect(game.bot.sampleInput(other, id, createRng(42), skill)).toEqual(
          game.bot.sampleInput(s, id, createRng(42), skill),
        );
      }
    }
  });

  it('refresh reconnect preserves the live board, guessed status, score and drawer secret', () => {
    let s = drawing();
    s = kit.input(s, s.drawer, { type: 'stroke', stroke });
    const id = guesser(s);
    s = kit.input(s, id, { type: 'guess', text: s.word }, s.began + 1500);
    const before = s;
    s = kit.player(s, id, false, undefined, s.began + 1700);
    s = kit.player(s, id, true, undefined, s.began + 1900);
    expect(s.strokes).toEqual(before.strokes);
    expect(s.solved).toEqual(before.solved);
    expect(s.scores).toEqual(before.scores);
    expect(game.controllerView(s, id).solved).toBe(true);
    expect(game.controllerView(s, s.drawer).secret).toBe(before.word);
  });

  it('permanent drawer departure moves on immediately; disconnected players never block termination', () => {
    const s = drawing();
    const gone = kit.player(s, s.drawer, false, 'left', s.began + 2000);
    expect(gone.phase.id).toBe('reveal');
    let offline: State = s;
    for (const id of s.order) offline = kit.player(offline, id, false, undefined, s.began + 2000);
    expect(kit.until(offline, 'done', 1000).phase.id).toBe('done');
  });

  it('pause ignores play and timers; resume shifts all timing by precisely the held interval', () => {
    const s = drawing();
    const paused = kit.vip(s, 'pause', s.began + 1000);
    expect(paused.phase.paused).toEqual({ at: s.began + 1000 });
    expect(kit.input(paused, s.drawer, { type: 'stroke', stroke }, s.began + 1500).strokes).toEqual(
      [],
    );
    expect(kit.timer(paused, s.endsAt + 5000).phase.id).toBe('draw');
    const resumed = kit.vip(paused, 'resume', s.began + 6000);
    expect(resumed.phase.paused).toBeUndefined();
    expect(resumed.began).toBe(s.began + 5000);
    expect(resumed.endsAt).toBe(s.endsAt + 5000);
    expect(resumed.phase.deadline).toBe(s.phase.deadline! + 5000);
    const id = guesser(s);
    expect(
      kit.input(resumed, id, { type: 'guess', text: s.word }, resumed.began + 7000).scores[id],
    ).toBe(kit.input(s, id, { type: 'guess', text: s.word }, s.began + 7000).scores[id]);
  });

  it('stale, early and wrong-phase timers do not alter play; VIP skip advances and end returns results', () => {
    const s = drawing();
    for (const event of [
      { type: 'timer', now: s.phase.deadline!, phaseId: 'choose', startedAt: s.phase.startedAt },
      {
        type: 'timer',
        now: s.phase.deadline!,
        phaseId: s.phase.id,
        startedAt: s.phase.startedAt - 1,
      },
      {
        type: 'timer',
        now: s.phase.deadline! - 1,
        phaseId: s.phase.id,
        startedAt: s.phase.startedAt,
      },
    ] as const)
      expect(game.reduce(s, event)).toEqual(s);
    expect(kit.vip(s, 'skip').phase.id).toBe('reveal');
    const ended = kit.vip(s, 'end');
    expect(ended.phase.id).toBe('done');
    expect(game.results(ended)?.scores).toEqual(s.scores);
  });

  it('does not mutate any input state or payload and is deterministic after each event', () => {
    const frozen = deepFreeze(drawing());
    const input = deepFreeze({ type: 'stroke' as const, stroke });
    const event = {
      type: 'input' as const,
      playerId: frozen.drawer,
      input,
      now: frozen.began + 1000,
    };
    const first = game.reduce(frozen, event);
    const second = game.reduce(frozen, event);
    expect(first).toEqual(second);
    expect(frozen.strokes).toEqual([]);
    expect(game.init({ players: testPlayers(4), settings: {}, seed: 42, now: T0 })).toEqual(
      game.init({ players: testPlayers(4), settings: {}, seed: 42, now: T0 }),
    );
  });
});
