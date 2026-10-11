import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { loadGame } from '@partybox/game-sdk/testing';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import type { State } from '../server/types';

const loaded = await loadGame('pong-party');
function phone(state: State, id: string, phoneOnly: boolean): string {
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={{ ...game.controllerView(state, id), vip: null }}
        me={state.players[id] ?? { id, name: 'Spectator', avatarId: 'fox', connected: true }}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}

describe.each(['play', 'score', 'done'])('render: %s', (phase) => {
  it('TV renders the original octagon and all eight named players', () => {
    const state = loaded.fixtures[phase] as State;
    const html = renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
    expect(html).toContain('<svg');
    for (const player of Object.values(state.players)) expect(html).toContain(player.name);
    expect(html).not.toContain('type="range"');
  });

  it('phone-only gives players and spectators the stage without TV directions', () => {
    const state = loaded.fixtures[phase] as State;
    for (const id of ['p1', 'p2', 'spectator-x']) {
      const html = phone(state, id, true);
      expect(html).toContain('<svg');
      for (const line of ['on the TV', 'at the TV', 'Look at the TV', 'One moment'])
        expect(html).not.toContain(line);
      if (phase !== 'play')
        for (const player of Object.values(state.players)) expect(html).toContain(player.name);
      if (id === 'spectator-x' || phase !== 'play') expect(html).not.toContain('type="range"');
    }
  });

  it('reloaded views contain the same public world and personal paddle state', () => {
    const state = loaded.fixtures[phase] as State;
    const first = game.controllerView(state, 'p1');
    const restored = game.controllerView(JSON.parse(JSON.stringify(state)) as State, 'p1');
    expect(restored).toEqual(first);
    expect(first.world.paddles).toEqual(state.world.paddles);
    expect(first.world.balls).toEqual(state.world.balls);
  });
});

it('render: active players get a labeled native bounded slider; spectators get no control', () => {
  const state = game.init({
    players: Array.from({ length: 8 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      avatarId: 'fox',
      connected: true,
    })),
    settings: {},
    seed: 20,
    now: 1000,
  });
  for (const phoneOnly of [false, true]) {
    const html = phone(state, 'p1', phoneOnly);
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="1"');
    expect(html).toContain('Slide to move your paddle');
    expect(html).toContain('aria-describedby=');
    expect(html).toContain('aria-valuetext="50 percent along your edge"');
    expect(html).toContain('Player 1');
    if (phoneOnly) {
      expect(html).toContain('<svg');
      for (let n = 1; n <= 8; n++) expect(html).toContain(`>${n}</text>`);
    }
    expect(phone(state, 'spectator-x', phoneOnly)).not.toContain('type="range"');
  }
});

it('render: pause disables the slider and elimination removes it', () => {
  const state = loaded.fixtures['play'] as State;
  const paused = {
    ...state,
    phase: { ...state.phase, paused: { at: state.began + state.checked } },
  };
  expect(phone(paused, 'p1', true)).toContain('disabled=""');
  const out = {
    ...state,
    world: {
      ...state.world,
      paddles: state.world.paddles.map((p) =>
        p.id === 'p1' ? { ...p, lives: 0, eliminatedAt: state.checked } : p,
      ),
    },
  };
  expect(phone(out, 'p1', true)).not.toContain('type="range"');
  expect(phone(out, 'p1', true)).toContain('You are out');
});

it('render: a remote player gets a stage even when the room has a TV', () => {
  const state = loaded.fixtures['play'] as State;
  const remote = {
    ...state,
    players: { ...state.players, p1: { ...state.players.p1!, canSeeTv: false } },
  };
  expect(phone(remote, 'p1', false)).toContain('<svg');
  expect(phone(remote, 'p1', false)).not.toContain('on the TV');
});

it('render: score and done show your competition rank, including ties', () => {
  for (const phase of ['score', 'done']) {
    const state = loaded.fixtures[phase] as State;
    expect(phone(state, 'p1', true)).toContain(`Place ${game.controllerView(state, 'p1').rank}`);
    const tied = {
      ...state,
      scores: Object.fromEntries(
        Object.keys(state.players).map((id) => [id, id === 'p1' || id === 'p2' ? 9999 : 0]),
      ),
    };
    expect(game.controllerView(tied, 'p1')).toMatchObject({ rank: 1, tied: true });
    expect(phone(tied, 'p1', true)).toContain('Place 1');
    expect(phone(state, 'spectator-x', true)).not.toContain('Place ');
  }
  expect(phone(loaded.fixtures['play'] as State, 'p1', true)).not.toContain('Place ');
});
