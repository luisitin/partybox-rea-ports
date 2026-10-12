// Every fixture and room surface: the stage stays public and spectators never acquire controls.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Arena } from '../client/Arena';
import arenaStyles from '../client/Arena.module.css';
import { Tv } from '../client/Tv';
import { clockText } from '../client/timing';
import { game } from '../server/index';
import type { State, World } from '../server/types';
import play from '../fixtures/play.json';
import score from '../fixtures/score.json';
import scoreLast from '../fixtures/score-last.json';
import done from '../fixtures/done.json';

const fixtures: Record<string, State> = {
  play: play as unknown as State,
  score: score as unknown as State,
  'score-last': scoreLast as unknown as State,
  done: done as unknown as State,
};
type Mode = 'tv-room' | 'phone-only' | 'remote' | 'spectator-tv' | 'spectator-phone';
const modes: Mode[] = ['tv-room', 'phone-only', 'remote', 'spectator-tv', 'spectator-phone'];

function room(state: State, id: string, mode: Mode): State {
  return {
    ...state,
    phoneOnly: mode === 'phone-only' || mode === 'spectator-phone',
    players: Object.fromEntries(
      Object.entries(state.players).map(([playerId, player]) => [
        playerId,
        { ...player, canSeeTv: !(mode === 'remote' && playerId === id) },
      ]),
    ),
  };
}

const offset = (state: State): number =>
  (state.phase.paused?.at ??
    (state.phase.id === 'play' ? state.began + state.world.elapsed : state.phase.startedAt)) -
  Date.now();

function phone(state: State, id: string, mode: Mode): string {
  const s = room(state, id, mode);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={offset(s)}>
      <PhoneOnlyProvider value={s.phoneOnly}>
        <Controller
          view={{ ...game.controllerView(s, id), vip: null }}
          me={s.players[id] ?? { id, name: 'Guest', avatarId: 'fox' }}
          send={() => undefined}
        />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}

function tv(state: State): string {
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={offset(state)}>
      <Tv view={{ ...game.tvView(state), vip: null }} />
    </ServerClockProvider>,
  );
}

const buttons = (html: string): string[] => html.match(/<button\b[^>]*>/g) ?? [];

it('fractional rich food has the diamond cue while ordinary sparks and spent boost retain circles', () => {
  const world: World = {
    elapsed: 0,
    snakes: [],
    food: [
      { x: 10, y: 20, value: 0.3 },
      { x: 30, y: 20, value: 1 },
      { x: 50, y: 20, value: 1.5 },
      { x: 70, y: 20, value: 1.957 },
    ],
  };
  const html = renderToStaticMarkup(<Arena world={world} names={new Map()} />);
  const sparks = (html.match(/<circle\b[^>]*>/g) ?? []).filter((tag) =>
    tag.includes(`class="${arenaStyles.food}"`),
  );
  const rich = (html.match(/<path\b[^>]*>/g) ?? []).filter((tag) =>
    tag.includes(`class="${arenaStyles.corpseFood}"`),
  );
  expect(sparks).toHaveLength(2);
  expect(sparks[0]).toContain('cx="10"');
  expect(sparks[1]).toContain('cx="30"');
  expect(rich).toHaveLength(2);
  expect(rich[0]).toContain('d="M50 ');
  expect(rich[1]).toContain('d="M70 ');
});

describe.each(Object.entries(fixtures))('every surface: %s', (_phase, state) => {
  it('the TV renders the arena and every starting player', () => {
    const html = tv(state);
    expect(html).toContain('<svg');
    expect(html).toContain('Snake arena.');
    for (const player of Object.values(state.players)) expect(html).toContain(player.name);
    expect(buttons(html)).toHaveLength(0);
  });

  it.each(modes)('%s carries the correct stage and guards controls', (mode) => {
    const spectator = mode.startsWith('spectator');
    const id = spectator ? 'guest' : 'p1';
    const s = room(state, id, mode);
    const view = game.controllerView(s, id);
    const html = phone(state, id, mode);
    const stage = mode !== 'tv-room';
    expect(view.world !== undefined).toBe(stage);
    if (stage) {
      expect(html).toContain('aria-label="Snake arena.');
      expect(html).toContain('<svg');
      for (const player of Object.values(state.players)) expect(html).toContain(player.name);
      expect(html).not.toMatch(/Look at the TV|on the TV|One moment/);
    } else expect(html).not.toContain('aria-label="Snake arena.');
    if (spectator || state.phase.id !== 'play') {
      expect(buttons(html)).toHaveLength(0);
      expect(html).not.toContain('Snake controls');
      expect(html).not.toContain('DRAG TO STEER');
      expect(html).not.toContain('BOOST');
    } else {
      expect(buttons(html)).toHaveLength(2);
      expect(html).toContain('Direction pad.');
      expect(html).toContain('Hold BOOST to sprint.');
      if (!view.alive)
        expect(buttons(html).every((button) => button.includes('disabled'))).toBe(true);
    }
  });
});

const fresh = (): State =>
  game.init({
    players: Object.values(fixtures.play!.players),
    settings: {},
    seed: 7,
    now: 1_000_000,
  });

describe('play feedback and guards', () => {
  it('an active player has both controls, and the stage precedes them on phone-only and remote screens', () => {
    const state = fresh();
    for (const mode of ['phone-only', 'remote'] as const) {
      const html = phone(state, 'p1', mode);
      expect(buttons(html).every((button) => !button.includes('disabled'))).toBe(true);
      expect(html.indexOf('aria-label="Snake arena.')).toBeLessThan(html.indexOf('Snake controls'));
    }
  });

  it('a crash keeps the public stage, return explanation and disabled controls', () => {
    const state = fresh();
    const crashed: State = {
      ...state,
      world: {
        ...state.world,
        snakes: state.world.snakes.map((snake) =>
          snake.id === 'p1'
            ? {
                ...snake,
                body: [],
                mass: 8,
                respawnAt: 2000,
              }
            : snake,
        ),
      },
    };
    for (const mode of ['tv-room', 'phone-only', 'remote'] as const) {
      const html = phone(crashed, 'p1', mode);
      expect(html).toContain('Crashed! Back in 2s with a shield.');
      expect(buttons(html)).toHaveLength(2);
      expect(buttons(html).every((button) => button.includes('disabled'))).toBe(true);
    }
  });

  it('pause disables both controls, names the released state and holds the round clock', () => {
    const state = fresh();
    const at = state.began + 10_000;
    const paused: State = { ...state, phase: { ...state.phase, paused: { at } } };
    for (const mode of ['tv-room', 'phone-only', 'remote'] as const) {
      const html = phone(paused, 'p1', mode);
      expect(html).toContain('Paused · controls released');
      expect(buttons(html).every((button) => button.includes('disabled'))).toBe(true);
      expect(html).toContain(clockText(state.endsAt - at));
    }
    expect(tv(paused)).toContain(clockText(state.endsAt - at));
    expect(buttons(phone(paused, 'guest', 'spectator-tv'))).toHaveLength(0);
  });

  it('boost cannot start at the minimum size while steering remains available', () => {
    const state = fresh();
    const minimum: State = {
      ...state,
      world: {
        ...state.world,
        snakes: state.world.snakes.map((snake) =>
          snake.id === 'p1' ? { ...snake, mass: 8, boost: true, safeUntil: 0 } : snake,
        ),
      },
    };
    const html = phone(minimum, 'p1', 'phone-only');
    expect(buttons(html)[0]).not.toContain('disabled');
    expect(buttons(html)[1]).toContain('disabled');
    expect(html).toContain('Needs size above 8');
    const source = { ...minimum.world, snakes: [minimum.world.snakes[0]!] };
    const arena = renderToStaticMarkup(<Arena world={source} names={new Map()} />);
    expect(arena).not.toContain(`class="${arenaStyles.boost}"`);
    for (const html of [tv(minimum), phone(minimum, 'p1', 'phone-only')])
      expect(html).not.toContain('Boosting');
  });

  it('a paused spectator retains the stage and a visible pause explanation without controls', () => {
    const state = fresh();
    const paused: State = {
      ...state,
      phase: { ...state.phase, paused: { at: state.began + 10_000 } },
    };
    for (const mode of ['spectator-tv', 'spectator-phone'] as const) {
      const html = phone(paused, 'guest', mode);
      expect(html).toContain('Paused · spectating');
      expect(html).toContain('aria-label="Snake arena.');
      expect(buttons(html)).toHaveLength(0);
      expect(html).toContain(clockText(state.endsAt - (state.began + 10_000)));
    }
  });

  it('a disconnected player sees reconnect status rather than usable controls or a promised respawn', () => {
    const state = fresh();
    for (const crashed of [false, true]) {
      const disconnected: State = {
        ...state,
        players: { ...state.players, p1: { ...state.players['p1']!, connected: false } },
        world: {
          ...state.world,
          snakes: state.world.snakes.map((snake) =>
            crashed && snake.id === 'p1' ? { ...snake, body: [], mass: 8, respawnAt: 2000 } : snake,
          ),
        },
      };
      for (const mode of ['tv-room', 'phone-only', 'remote'] as const) {
        const html = phone(disconnected, 'p1', mode);
        expect(html).toContain('Reconnecting · controls released');
        expect(html).not.toContain('Crashed! Back in');
        expect(buttons(html)).toHaveLength(2);
        expect(buttons(html).every((button) => button.includes('disabled'))).toBe(true);
      }
    }
  });

  it('displayed size is the same integer the scoring function will bank', () => {
    const state = fresh();
    const fractional: State = {
      ...state,
      world: {
        ...state.world,
        snakes: state.world.snakes.map((snake) =>
          snake.id === 'p1' ? { ...snake, mass: 13.9 } : snake,
        ),
      },
    };
    for (const mode of ['tv-room', 'phone-only', 'remote'] as const)
      expect(phone(fractional, 'p1', mode)).toContain('<span><b>13</b>Size</span>');
  });
});

describe('score and final results', () => {
  it('arbitrary player ids retain their arena snake numbers and colours on every result surface', () => {
    const initial = game.init({
      players: [
        { id: 'z-seat', name: 'Zoe', avatarId: 'fox', connected: true },
        { id: 'a-seat', name: 'Amir', avatarId: 'fox', connected: true },
      ],
      settings: {},
      seed: 7,
      now: 1_000_000,
    });
    for (const phase of ['score', 'done'] as const) {
      const state: State = {
        ...initial,
        phase: {
          id: phase,
          startedAt: initial.began,
          deadline: phase === 'done' ? null : initial.began + 7000,
        },
        scores: { 'z-seat': 10, 'a-seat': 20 },
        lastPoints: { 'z-seat': 10, 'a-seat': 20 },
      };
      const view = game.controllerView(state, 'z-seat');
      expect(view.players.map((player) => player.id)).toEqual(['a-seat', 'z-seat']);
      expect(view.snakeIds).toEqual(['z-seat', 'a-seat']);
      for (const html of [
        tv(state),
        ...(['tv-room', 'phone-only', 'remote'] as const).map((mode) =>
          phone(state, 'z-seat', mode),
        ),
      ]) {
        const rows = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const zoe = rows.find((row) => row.includes('Zoe'));
        const amir = rows.find((row) => row.includes('Amir'));
        expect(zoe).toContain('aria-label="Snake 1"');
        expect(zoe).toContain('--pb-player-1');
        expect(amir).toContain('aria-label="Snake 2"');
        expect(amir).toContain('--pb-player-2');
      }
    }
  });

  it('the final score beat promises results, while earlier scores promise another round', () => {
    expect(tv(fixtures['score-last']!)).toContain('Final results');
    for (const mode of ['tv-room', 'phone-only', 'remote'] as const) {
      expect(phone(fixtures['score-last']!, 'p1', mode)).toContain(
        'All rounds banked. Final results coming up.',
      );
      expect(phone(fixtures['score-last']!, 'p1', mode)).not.toContain('Next round');
      expect(phone(fixtures.score!, 'p1', mode)).toContain('Next round starts automatically.');
    }
  });

  it('names a unique winner and gives each phone its public rank with no controls', () => {
    const state: State = {
      ...fixtures.done!,
      scores: {
        ...Object.fromEntries(Object.keys(fixtures.done!.players).map((id) => [id, 1])),
        p1: 30,
        p2: 20,
        p3: 20,
      },
    };
    expect(tv(state)).toContain('Alex wins!');
    for (const mode of ['tv-room', 'phone-only', 'remote'] as const) {
      expect(phone(state, 'p1', mode)).toContain('Place 1 · 30 match points');
      expect(phone(state, 'p2', mode)).toContain('Place 2 · 20 match points');
      expect(phone(state, 'p3', mode)).toContain('Place 2 · 20 match points');
      expect(buttons(phone(state, 'p1', mode))).toHaveLength(0);
      expect(phone(state, 'p1', mode)).not.toContain('role="timer"');
    }
  });

  it('tied leaders share first place and a spectator gets the same result without a personal rank', () => {
    const state: State = {
      ...fixtures.done!,
      scores: {
        ...Object.fromEntries(Object.keys(fixtures.done!.players).map((id) => [id, 1])),
        p1: 30,
        p2: 30,
      },
    };
    expect(tv(state)).toContain('A tie at the top!');
    for (const mode of ['phone-only', 'remote'] as const)
      for (const id of ['p1', 'p2']) {
        const html = phone(state, id, mode);
        expect(html).toContain('A tie at the top!');
        expect(html).toContain('Place 1 · 30 match points');
      }
    const html = phone(state, 'guest', 'spectator-tv');
    expect(html).toContain('A tie at the top!');
    expect(html).not.toContain('Place 1');
    expect(buttons(html)).toHaveLength(0);
  });
});
