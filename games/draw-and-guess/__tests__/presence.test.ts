import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { chunk, drawing, guesserIds, kit } from './helpers';

describe('pause, departure and reconnect', () => {
  it('holds drawing/guesses while paused and moves every drawing clock on resume', () => {
    const state = drawing();
    const paused = kit.vip(state, 'pause', state.began + 2000);
    expect(paused.phase.paused).toEqual({ at: state.began + 2000 });
    expect(kit.input(paused, paused.drawerId, chunk(), state.began + 3000)).toBe(paused);
    expect(
      kit.input(
        paused,
        guesserIds(state)[0]!,
        { type: 'guess', text: state.word!.text },
        state.began + 3000,
      ),
    ).toBe(paused);
    expect(kit.timer(paused, state.phase.deadline!)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', state.began + 7000);
    expect(resumed.phase.paused).toBeUndefined();
    expect(resumed.began).toBe(state.began + 5000);
    expect(resumed.endsAt).toBe(state.endsAt + 5000);
    expect(resumed.phase.deadline).toBe(state.phase.deadline! + 5000);
    let solved = kit.input(
      resumed,
      guesserIds(state)[0]!,
      { type: 'guess', text: state.word!.text },
      resumed.began + 15_000,
    );
    solved = kit.input(
      solved,
      guesserIds(state)[1]!,
      { type: 'guess', text: state.word!.text },
      resumed.began + 30_000,
    );
    expect(solved.lastPoints[guesserIds(state)[0]!]).toBe(400);
    expect(solved.lastPoints[guesserIds(state)[1]!]).toBe(300);
  });

  it('returns a disconnected player to exactly the current drawing and their solved state', () => {
    let state = drawing();
    const id = guesserIds(state)[0]!;
    state = kit.input(state, state.drawerId, chunk(), state.began + 1000);
    state = kit.input(state, id, { type: 'guess', text: state.word!.text }, state.began + 2000);
    state = kit.player(state, id, false, undefined, state.began + 3000);
    const back = kit.player(state, id, true, undefined, state.began + 4000);
    expect(back.phase.id).toBe('draw');
    expect(kit.cv(back, id).strokes).toEqual(state.strokes);
    expect(kit.cv(back, id).solved).toBe(true);
    expect(back.solved[id]).toBe(state.began + 2000);
    expect(back.guesses[id]).toEqual(state.guesses[id]);
  });

  it('an absent artist cannot stall choice or drawing', () => {
    const start = kit.start();
    const absent = kit.player(
      start,
      start.drawerId,
      false,
      undefined,
      start.phase.startedAt + 1000,
    );
    expect(absent.phase.id).not.toBe('choose');
    const state = drawing();
    const dropped = kit.player(state, state.drawerId, false, undefined, state.began + 1000);
    expect(dropped.phase.id).toBe('reveal');
    expect(dropped.scores).toEqual(state.scores);
  });

  it('a permanent leaver is skipped on future turns and still has finite results', () => {
    let state = kit.start();
    const leaver = guesserIds(state)[0]!;
    state = kit.player(state, leaver, false, 'left', state.phase.startedAt + 1000);
    expect(state.left).toContain(leaver);
    let steps = 0;
    while (state.phase.id !== 'done' && steps++ < 50) {
      if (state.phase.id === 'choose') expect(state.drawerId).not.toBe(leaver);
      state = kit.timer(state);
    }
    expect(state.phase.id).toBe('done');
    expect(Number.isFinite(game.results(state)?.scores[leaver])).toBe(true);
    const back = kit.player(state, leaver, true, undefined, state.phase.startedAt + 1000);
    expect(back.left).toContain(leaver);
  });

  it('rechecks all solved after a drop during pause and progresses on resume', () => {
    let state = drawing();
    const ids = guesserIds(state);
    state = kit.input(
      state,
      ids[0]!,
      { type: 'guess', text: state.word!.text },
      state.began + 1000,
    );
    state = kit.vip(state, 'pause', state.began + 2000);
    state = kit.player(state, ids[1]!, false, undefined, state.began + 3000);
    expect(state.phase.id).toBe('draw');
    expect(kit.vip(state, 'resume', state.began + 7000).phase.id).toBe('reveal');
  });

  it('phone-only and remote rooms expose the public stage to players and spectators', () => {
    for (const mode of ['together', 'remote-voice', 'remote-text'] as const) {
      const state = kit.start({ presence: { mode, phoneOnly: true } });
      expect(state.phoneOnly).toBe(true);
      for (const id of [...Object.keys(state.players), 'spectator'])
        expect(kit.cv(state, id).stage).toBe(true);
    }
  });
});
