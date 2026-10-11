import { describe, expect, it } from 'vitest';
import { testPlayers } from '@partybox/game-sdk/testing';
import { createRng } from '@partybox/game-sdk';
import { game } from '../server/index';
import { publicMask } from '../server/mask';
import { CHOOSE_MS, PHASES, REVEAL_MS } from '../server/types';
import type { State } from '../server/types';
import { T0, chunk, drawing, freeze, guesserIds, kit, leafStrings, players } from './helpers';

describe('artist choice and turn order', () => {
  it('opens a private three-word choice with a twelve-second clock', () => {
    const state = kit.start();
    expect(state.phase).toEqual({ id: 'choose', startedAt: T0, deadline: T0 + CHOOSE_MS });
    expect(CHOOSE_MS).toBe(12_000);
    expect(PHASES).toEqual(['choose', 'draw', 'reveal', 'done']);
    expect(state.word).toBeNull();
    expect(state.choices).toHaveLength(3);
    expect(new Set(state.choices.map((word) => word.id)).size).toBe(3);
    expect(state.drawerId).toBe(state.order[0]);
    expect(state.turnIndex).toBe(0);
    expect(game.results(state)).toBeNull();
  });

  it('lets only the connected artist choose and honours each of the three choices', () => {
    for (const index of [0, 1, 2]) {
      const state = kit.start();
      const other = guesserIds(state)[0]!;
      expect(kit.input(state, other, { type: 'choose', index })).toBe(state);
      expect(kit.input(state, 'spectator', { type: 'choose', index })).toBe(state);
      const selected = kit.input(state, state.drawerId, { type: 'choose', index });
      expect(selected.phase.id).toBe('draw');
      expect(selected.word).toEqual(state.choices[index]);
      expect(selected.endsAt - selected.began).toBe(60_000);
      expect(kit.input(selected, selected.drawerId, { type: 'choose', index })).toBe(selected);
    }
  });

  it('automatically takes the first seeded choice at the choice deadline', () => {
    const state = kit.start();
    const drawn = kit.timer(state);
    expect(drawn.word).toEqual(state.choices[0]);
    expect(drawn.phase.id).toBe('draw');
    expect(drawn.began).toBe(T0 + CHOOSE_MS);
    const late = kit.input(
      state,
      state.drawerId,
      { type: 'choose', index: 2 },
      state.phase.deadline!,
    );
    expect(late).toBe(state);
  });

  it('gives everybody exactly one turn per configured round and resets their canvas', () => {
    let state = kit.start({ players: testPlayers(8), settings: { rounds: 2 } });
    expect(state.order).toHaveLength(16);
    const artists: string[] = [];
    while (state.phase.id !== 'done') {
      expect(state.phase.id).toBe('choose');
      artists.push(state.drawerId);
      state = kit.input(state, state.drawerId, { type: 'choose', index: 0 });
      state = kit.input(state, state.drawerId, chunk(), state.began + 1000);
      expect(state.strokes).toHaveLength(1);
      state = kit.finish(state);
      expect(state.phase.id).toBe('reveal');
      state = kit.timer(state);
      if (state.phase.id === 'choose') {
        expect(state.strokes).toEqual([]);
        expect(state.guesses).toEqual({});
        expect(state.solved).toEqual({});
        expect(state.lastSeq).toBe(-1);
      }
    }
    expect(artists).toEqual(state.order);
    for (const id of Object.keys(state.players))
      expect(artists.filter((artist) => artist === id)).toHaveLength(2);
    expect(state.phase.deadline).toBeNull();
    expect(game.results(state)?.ranking).toHaveLength(8);
  });

  it('reads each difficulty and clamps stale settings to supported values', () => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const state = kit.start({ settings: { difficulty, seconds: 45, rounds: 1 } });
      expect(state.choices.every((word) => word.difficulty === difficulty)).toBe(true);
      expect(kit.timer(state).endsAt - kit.timer(state).began).toBe(45_000);
    }
    const state = kit.start({ settings: { rounds: 9, seconds: -5, difficulty: 'unknown' } });
    expect(state.settings.rounds).toBeGreaterThanOrEqual(1);
    expect(state.settings.rounds).toBeLessThanOrEqual(2);
    expect(state.settings.seconds).toBeGreaterThanOrEqual(45);
    expect(state.settings.seconds).toBeLessThanOrEqual(75);
    expect(['easy', 'medium', 'hard', 'mixed']).toContain(state.settings.difficulty);
  });
});

describe('hints and private views', () => {
  it('has two progressive public hints, then reveals at exactly the drawing cap', () => {
    const start = drawing();
    const base = publicMask(start);
    expect(base).toBe(start.word!.text.replace(/[a-z]/g, '_'));
    expect(start.phase.deadline).toBe(start.began + 20_000);
    const first = kit.timer(start);
    expect(first.phase.id).toBe('draw');
    expect(first.hintLevel).toBe(1);
    expect(publicMask(first).replace(/[_ ]/g, '')).toHaveLength(1);
    expect(first.phase.deadline).toBe(first.began + 40_000);
    const second = kit.timer(first);
    expect(second.phase.id).toBe('draw');
    expect(second.hintLevel).toBe(2);
    expect(publicMask(second).replace(/[_ ]/g, '')).toHaveLength(2);
    expect(second.phase.deadline).toBe(second.endsAt);
    const revealed = kit.timer(second);
    expect(revealed.phase.id).toBe('reveal');
    expect(revealed.phase.startedAt).toBe(start.endsAt);
    expect(revealed.phase.deadline).toBe(revealed.phase.startedAt + REVEAL_MS);
    expect(REVEAL_MS).toBe(7000);
  });

  it('keeps every choice and the answer away from guessers and spectators until reveal', () => {
    const start = kit.start();
    const drawer = game.controllerView(start, start.drawerId);
    expect(drawer.choices).toEqual(start.choices.map((word) => word.text));
    for (const id of [...guesserIds(start), 'spectator', '__proto__', '']) {
      const phone = game.controllerView(start, id);
      expect(phone.choices).toEqual([]);
      expect(phone.secret).toBeNull();
      const text = leafStrings(phone);
      for (const word of start.choices) expect(text).not.toContain(word.text);
    }
    for (const word of start.choices)
      expect(leafStrings(game.tvView(start))).not.toContain(word.text);
    const state = drawing();
    expect(game.controllerView(state, state.drawerId).secret).toBe(state.word!.text);
    for (const id of [...guesserIds(state), 'spectator', '__proto__']) {
      const phone = game.controllerView(state, id);
      expect(phone.secret).toBeNull();
      expect(leafStrings(phone)).not.toContain(state.word!.text);
    }
    expect(leafStrings(game.tvView(state))).not.toContain(state.word!.text);
    const reveal = kit.finish(state);
    expect(game.tvView(reveal).answer).toBe(state.word!.text);
    for (const id of [...guesserIds(state), 'spectator'])
      expect(game.controllerView(reveal, id).answer).toBe(state.word!.text);
  });

  it('two states with different secrets and the same public pattern have identical guesser views', () => {
    const state = drawing();
    const alternate: State = {
      ...state,
      word: { ...state.word!, text: state.word!.text.replace(/[a-z]/g, 'z') },
    };
    for (const id of [...guesserIds(state), 'spectator'])
      expect(game.controllerView(state, id)).toEqual(game.controllerView(alternate, id));
    expect(game.tvView(state)).toEqual(game.tvView(alternate));
  });

  it('marks a private correct guess without displaying typed guesses publicly', () => {
    const state = drawing();
    const id = guesserIds(state)[0]!;
    const wrong = kit.input(
      state,
      id,
      { type: 'guess', text: 'a private wrong guess' },
      state.began + 1000,
    );
    expect(game.controllerView(wrong, id).feedback).toBe('wrong');
    expect(leafStrings(game.tvView(wrong))).not.toContain('a private wrong guess');
    expect(leafStrings(game.controllerView(wrong, guesserIds(state)[1]!))).not.toContain(
      'a private wrong guess',
    );
    const solved = kit.input(
      wrong,
      id,
      { type: 'guess', text: state.word!.text },
      state.began + 2000,
    );
    expect(game.controllerView(solved, id).solved).toBe(true);
    expect(game.controllerView(solved, id).feedback).toBe('correct');
    expect(game.controllerView(solved, id).secret).toBeNull();
    expect(leafStrings(game.tvView(solved))).not.toContain(state.word!.text);
  });
});

describe('scoring and phase exits', () => {
  it('scores speed and the drawer share once, as the reveal begins', () => {
    let state = drawing();
    const ids = guesserIds(state);
    state = kit.input(
      state,
      ids[0]!,
      { type: 'guess', text: state.word!.text.toUpperCase() },
      state.began + 15_000,
    );
    expect(state.phase.id).toBe('draw');
    expect(state.scores[ids[0]!]).toBe(0);
    const one = state;
    expect(
      kit.input(one, ids[0]!, { type: 'guess', text: one.word!.text }, one.began + 20_000),
    ).toBe(one);
    state = kit.input(
      state,
      ids[1]!,
      { type: 'guess', text: state.word!.text },
      state.began + 30_000,
    );
    expect(state.phase.id).toBe('reveal');
    expect(state.lastPoints[ids[0]!]).toBe(400);
    expect(state.lastPoints[ids[1]!]).toBe(300);
    expect(state.lastPoints[state.drawerId]).toBe(300);
    expect(state.scores).toEqual(state.lastPoints);
    const snapshot = structuredClone(state.scores);
    expect(kit.input(state, ids[1]!, { type: 'guess', text: state.word!.text })).toBe(state);
    expect(kit.timer(state).scores).toEqual(snapshot);
  });

  it('does not award the drawer for guessing or unsuccessful rounds', () => {
    const state = drawing();
    expect(kit.input(state, state.drawerId, { type: 'guess', text: state.word!.text })).toBe(state);
    const reveal = kit.finish(state);
    expect(Object.values(reveal.lastPoints)).toEqual([0, 0, 0]);
    expect(Object.values(reveal.scores)).toEqual([0, 0, 0]);
  });

  it('keeps the original eligible denominator when a guesser disconnects', () => {
    let state = drawing();
    const ids = guesserIds(state);
    state = kit.player(state, ids[1]!, false, undefined, state.began + 1000);
    state = kit.input(
      state,
      ids[0]!,
      { type: 'guess', text: state.word!.text },
      state.began + 30_000,
    );
    expect(state.phase.id).toBe('reveal');
    expect(state.lastPoints[state.drawerId]).toBe(150);
    expect(state.lastPoints[ids[1]!]).toBe(0);
  });

  it('ignores unknown/prototype players, disconnected input, stale timers and backwards timestamps', () => {
    const state = drawing();
    for (const id of ['spectator', '__proto__', 'constructor', 'toString'])
      expect(kit.input(state, id, { type: 'guess', text: state.word!.text })).toBe(state);
    const disconnected = kit.player(
      state,
      guesserIds(state)[0]!,
      false,
      undefined,
      state.began + 1000,
    );
    expect(
      kit.input(
        disconnected,
        guesserIds(state)[0]!,
        { type: 'guess', text: state.word!.text },
        state.began + 2000,
      ),
    ).toBe(disconnected);
    expect(
      kit.reduce(state, {
        type: 'timer',
        now: state.endsAt,
        phaseId: 'draw',
        startedAt: state.phase.startedAt - 1,
      }),
    ).toBe(state);
    const newer = kit.input(state, state.drawerId, chunk(), state.began + 2000);
    expect(
      kit.input(
        newer,
        guesserIds(state)[0]!,
        { type: 'guess', text: state.word!.text },
        state.began + 1000,
      ),
    ).toBe(newer);
    const expired = kit.input(
      state,
      guesserIds(state)[0]!,
      { type: 'guess', text: state.word!.text },
      state.endsAt,
    );
    expect(expired.phase.id).toBe('reveal');
    expect(expired.solved).toEqual({});
  });

  it('can skip each live phase or end immediately while preserving every result seat', () => {
    let state = kit.start();
    state = kit.vip(state, 'skip');
    expect(state.phase.id).toBe('draw');
    state = kit.vip(state, 'skip');
    expect(state.phase.id).toBe('reveal');
    state = kit.vip(state, 'skip');
    expect(state.phase.id).toBe('choose');
    state = kit.vip(state, 'end');
    expect(state.phase.id).toBe('done');
    expect(
      game
        .results(state)
        ?.ranking.map((row) => row.playerId)
        .sort(),
    ).toEqual(players.map((player) => player.id).sort());
    expect(kit.vip(state, 'skip')).toBe(state);
    expect(kit.timer(state)).toBe(state);
  });

  it('does not mutate a deeply frozen source state or frozen input', () => {
    const state = freeze(drawing());
    const before = JSON.stringify(state);
    const input = freeze(chunk());
    const drawn = kit.input(state, state.drawerId, input, state.began + 1000);
    expect(drawn.strokes).toHaveLength(1);
    expect(JSON.stringify(state)).toBe(before);
    expect(() => game.tvView(state)).not.toThrow();
    expect(() => game.controllerView(state, 'spectator')).not.toThrow();
  });
});

describe('honest seeded bots', () => {
  it('guessers make the same decisions when only the inaccessible secret changes', () => {
    const state = drawing();
    const other: State = {
      ...state,
      word: { ...state.word!, text: state.word!.text.replace(/[a-z]/g, 'z') },
      choices: [],
    };
    for (const skill of ['easy', 'normal', 'sharp'] as const)
      for (let seed = 1; seed <= 30; seed++)
        for (const id of guesserIds(state))
          expect(game.bot.sampleInput(state, id, createRng(seed), skill)).toEqual(
            game.bot.sampleInput(other, id, createRng(seed), skill),
          );
  });

  it('every strength returns schema-valid inputs for a player, and never acts for spectators', () => {
    for (const phase of [kit.start(), drawing(), kit.finish(drawing()), kit.vip(drawing(), 'end')])
      for (const skill of ['easy', 'normal', 'sharp'] as const)
        for (let seed = 1; seed <= 30; seed++) {
          for (const id of Object.keys(phase.players)) {
            const input = game.bot.sampleInput(phase, id, createRng(seed), skill);
            if (input !== null) expect(game.inputSchema.safeParse(input).success).toBe(true);
          }
          expect(game.bot.sampleInput(phase, 'spectator', createRng(seed), skill)).toBeNull();
        }
  });
});
