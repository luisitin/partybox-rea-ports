import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import type { State } from '../server/types';
import { drawing, kit } from './helpers';

function reveal(): State {
  const state = drawing();
  return kit.vip(state, 'skip', state.began + 1000);
}

function views(state: State) {
  return [
    game.tvView(state),
    ...[...Object.keys(state.players), 'spectator'].map((id) => game.controllerView(state, id)),
  ];
}

function expectNext(state: State, name: string | undefined): void {
  for (const view of views(state)) {
    if (name === undefined) expect(view).not.toHaveProperty('nextArtistName');
    else expect(view.nextArtistName).toBe(name);
  }
}

describe('reveal artist handoff', () => {
  it('previews the same next artist that the reveal deadline actually starts', () => {
    const state = reveal();
    const next = kit.timer(state);
    expect(next.phase.id).toBe('choose');
    expectNext(state, next.players[next.drawer]!.name);
  });

  it('skips disconnected future seats and updates if a seat reconnects during reveal', () => {
    const state = reveal();
    const first = state.order[1]!;
    const second = state.order[2]!;
    const dropped = kit.player(state, first, false, undefined, state.phase.startedAt + 500);
    expectNext(dropped, state.players[second]!.name);
    const rejoined = kit.player(dropped, first, true, undefined, state.phase.startedAt + 1000);
    expectNext(rejoined, state.players[first]!.name);
  });

  it('excludes permanently departed seats even when their transport is connected', () => {
    const state = reveal();
    const first = state.order[1]!;
    const skipped = { ...state, left: [first] };
    expectNext(skipped, state.players[state.order[2]!]!.name);
    expect(kit.timer(skipped).drawer).toBe(state.order[2]);
  });

  it('announces an artist again when the second lap starts', () => {
    let state = kit.start({ settings: { laps: 2 } });
    const first = state.drawer;
    for (let turn = 0; turn < 4; turn++) {
      state = kit.input(state, state.drawer, { type: 'choose', index: 1 });
      state = kit.vip(state, 'skip', state.began + 1000);
      if (turn < 3) state = kit.timer(state);
    }
    expect(state.turn).toBe(3);
    expectNext(state, state.players[first]!.name);
    expect(kit.timer(state).drawer).toBe(first);
    expect(kit.timer(state).turn).toBe(4);
  });

  it('omits the handoff on the last turn or when no future artist remains', () => {
    const state = reveal();
    const final = { ...state, turn: state.order.length - 1 };
    expectNext(final, undefined);
    expect(kit.timer(final).phase.id).toBe('done');
    const futureGone = {
      ...state,
      turn: state.order.length - 2,
      drawer: state.order[state.order.length - 2]!,
      left: [state.order.at(-1)!],
    };
    expectNext(futureGone, undefined);
  });

  it('omits the handoff when fewer than two connected non-departed seats remain', () => {
    const state = reveal();
    const next = state.order[1]!;
    const alone = {
      ...state,
      players: Object.fromEntries(
        Object.entries(state.players).map(([id, player]) => [
          id,
          { ...player, connected: id === next },
        ]),
      ),
    };
    expectNext(alone, undefined);
    expect(kit.timer(alone).phase.id).toBe('done');
  });

  it('does not expose future artist names during choice, drawing or final standings', () => {
    for (const state of [kit.start(), drawing(), kit.vip(reveal(), 'end')])
      expectNext(state, undefined);
  });

  it('preserves the reveal handoff across pause/resume without exposing private choices', () => {
    const state = reveal();
    const expected = state.players[state.order[1]!]!.name;
    const paused = kit.vip(state, 'pause', state.phase.startedAt + 500);
    const resumed = kit.vip(paused, 'resume', state.phase.startedAt + 5500);
    for (const snapshot of [state, paused, resumed]) {
      expectNext(snapshot, expected);
      for (const view of views(snapshot)) {
        expect(view.answer).toBe(state.word);
        expect(view).not.toHaveProperty('choices');
        expect(view).not.toHaveProperty('secret');
      }
    }
    const draw = drawing();
    const privatePause = kit.vip(draw, 'pause', draw.began + 500);
    const privateResume = kit.vip(privatePause, 'resume', draw.began + 5500);
    for (const snapshot of [draw, privatePause, privateResume]) {
      expectNext(snapshot, undefined);
      const changed = {
        ...snapshot,
        word: 'z'.repeat(snapshot.word.length),
        choices: ['private choice one', 'private choice two', 'private choice three'],
      };
      expect(game.tvView(changed)).toEqual(game.tvView(snapshot));
      for (const id of [...snapshot.order.filter((id) => id !== snapshot.drawer), 'spectator'])
        expect(game.controllerView(changed, id)).toEqual(game.controllerView(snapshot, id));
    }
  });
});
