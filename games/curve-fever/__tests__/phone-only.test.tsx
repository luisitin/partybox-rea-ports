// Phone only (no TV in the room, T-1044, owner 2026-10-10): the phone IS the stage. Every phase shows the real thing on the phone (the
// arena, who is in, the round's standings, the winner), never a placeholder or a line that sends the player to a TV that is not there.
// With a TV present the phone stays two buttons (it is sent no arena). Runs the Controller on every fixture's state in both rooms.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { standingsRows } from '../client/standings';
import { game } from '../server/index';
import type { State } from '../server/types';
import done from '../fixtures/done.json';
import play from '../fixtures/play.json';
import ready from '../fixtures/ready.json';
import scoreLast from '../fixtures/score-last.json';
import score from '../fixtures/score.json';

const fixtures: Record<string, State> = {
  ready: ready as unknown as State,
  play: play as unknown as State,
  score: score as unknown as State,
  'score-last': scoreLast as unknown as State,
  done: done as unknown as State,
};

/** The same match with everyone in front of the TV (the fixtures seat one player who cannot see it). */
const withTv = (state: State): State => ({
  ...state,
  players: Object.fromEntries(
    Object.entries(state.players).map(([id, p]) => [id, { ...p, canSeeTv: true }]),
  ),
});

/** What a player in a phone-only room must never read. */
const TV_LINES = ['One moment', 'Look at the TV', 'on the TV'];

/** The phone's picture of `state` for `playerId` in a room with or without a TV. */
function phone(state: State, playerId: string, phoneOnly: boolean): string {
  const s: State = phoneOnly ? { ...state, phoneOnly: true } : withTv(state);
  const view = { ...game.controllerView(s, playerId), vip: null };
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={view}
        me={s.players[playerId] ?? { id: playerId, name: '', avatarId: 'fox', connected: true }}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}

describe.each(Object.entries(fixtures))('phone only: %s', (_name, state) => {
  const ids = Object.keys(state.players);

  it('the controller view carries the whole arena; with a TV it does not', () => {
    for (const id of [...ids, 'a-spectator']) {
      const view = game.controllerView({ ...state, phoneOnly: true }, id);
      expect(view.worms).toEqual(state.world.worms);
      expect(game.controllerView(withTv(state), id).worms).toBeUndefined();
    }
  });

  it('a phone that cannot see the TV in a TV room is sent the arena too', () => {
    const tv = withTv(state);
    const remote: State = {
      ...tv,
      players: {
        ...tv.players,
        [ids[0] as string]: {
          ...(tv.players[ids[0] as string] as object),
          canSeeTv: false,
        } as State['players'][string],
      },
    };
    expect(game.controllerView(remote, ids[0] as string).worms).toBeDefined();
    expect(game.controllerView(remote, ids[1] as string).worms).toBeUndefined();
  });

  it('shows the arena and the players, and never a placeholder or a line about the TV', () => {
    for (const id of [...ids, 'a-spectator']) {
      const html = phone(state, id, true);
      for (const line of TV_LINES) expect(html, `${id}: ${line}`).not.toContain(line);
      expect(html, id).toContain('<canvas');
      if (state.phase.id !== 'play') {
        for (const p of Object.values(state.players)) expect(html, id).toContain(p.name);
      }
    }
  });
});

describe('phone only: what each phase says', () => {
  it('ready: the round, the arena with its countdown and the roster', () => {
    const html = phone(fixtures.ready as State, 'p1', true);
    expect(html).toContain('Round 1 of');
    expect(html).toContain('Find your worm by its arrow');
    expect(html).toContain('Player 2');
  });

  it('play: the arena above the hold buttons for a worm that lives', () => {
    const state = fixtures.play as State;
    const html = phone(state, 'p1', true);
    expect(html).toContain('<canvas');
    expect(html).toContain('Turn left');
    expect(html).toContain('Turn right');
    expect(html.indexOf('<canvas')).toBeLessThan(html.indexOf('Turn left'));
  });

  it('score: the round over, the points gained and the standings', () => {
    const html = phone(fixtures.score as State, 'p1', true);
    expect(html).toContain('Round 1 over');
    expect(html).toContain('this round');
    expect(html).toContain('points so far');
  });

  it('done: the winner and your own place', () => {
    const state = fixtures.done as State;
    const html = phone(state, 'p1', true);
    expect(html).toMatch(/ wins!|A tie at the top!/);
    expect(html).toMatch(/You won the match!|Place \d|A tie|points/);
  });

  it('with a TV present the phone keeps its old screens', () => {
    const html = phone(fixtures.ready as State, 'p1', false);
    expect(html).toContain('Find your worm on the TV');
    expect(html).not.toContain('<canvas');
    expect(phone(fixtures.score as State, 'p1', false)).toContain('this round');
  });
});

describe('the roster', () => {
  const players = [
    { id: 'a', name: 'Ana' },
    { id: 'b', name: 'Ben' },
  ];
  it('lists worms in colour order, best first when ranked, and marks the viewer and the crashed', () => {
    const view = {
      players,
      worms: [
        { id: 'a', died: 100 },
        { id: 'b', died: null },
      ],
      scores: { a: 1, b: 3 },
      lastPoints: { b: 1 },
    };
    const plain = standingsRows(view, 'a', false);
    expect(plain.map((r) => r.id)).toEqual(['a', 'b']);
    expect(plain[0]).toMatchObject({ slot: 0, out: true, me: true, total: 1 });
    const ranked = standingsRows(view, 'a', true);
    expect(ranked.map((r) => [r.id, r.slot])).toEqual([
      ['b', 1],
      ['a', 0],
    ]);
    expect(ranked[0]?.gained).toBe(1);
  });

  it('falls back to the players when the phone was sent no arena', () => {
    const rows = standingsRows({ players, scores: {}, lastPoints: {} }, 'b', false);
    expect(rows.map((r) => [r.name, r.slot, r.out, r.me, r.total])).toEqual([
      ['Ana', 0, false, false, 0],
      ['Ben', 1, false, true, 0],
    ]);
  });
});

describe('the room the match starts in', () => {
  const players = [
    { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
    { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
  ];
  const start = (phoneOnly: boolean): State =>
    game.init({
      players,
      settings: {},
      seed: 7,
      now: 1000,
      presence: { mode: 'together', phoneOnly },
    });

  it('a room with no TV sends every phone the arena from the first screen', () => {
    const s = start(true);
    expect(s.phoneOnly).toBe(true);
    expect(game.controllerView(s, 'a').worms).toHaveLength(2);
  });

  it('a room with a TV does not', () => {
    const s = start(false);
    expect(s.phoneOnly).toBeUndefined();
    expect(game.controllerView(s, 'a').worms).toBeUndefined();
  });
});
