import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { makePlayers, testKit } from '@partybox/game-sdk/testing';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import type { State } from '../server/types';
import playJson from '../fixtures/play.json';
import scoreJson from '../fixtures/score.json';
import doneJson from '../fixtures/done.json';

const fixtures = {
  play: playJson as unknown as State,
  score: scoreJson as unknown as State,
  done: doneJson as unknown as State,
};

function phone(state: State, id: string, phoneOnly: boolean): string {
  const view = game.controllerView(phoneOnly ? { ...state, phoneOnly: true } : state, id);
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={{ ...view, vip: null }}
        me={state.players[id] ?? { id, name: 'Spectator', avatarId: 'fox', connected: true }}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}

describe.each(Object.entries(fixtures))('surface contract: %s', (phase, state) => {
  it('renders every phase for TV, TV-connected phones and phone-only phones', () => {
    const tv = renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
    expect(tv).toContain('<svg');
    for (const player of Object.values(state.players)) expect(tv).toContain(player.name);
    for (const phoneOnly of [false, true]) {
      for (const id of [...Object.keys(state.players), 'spectator-x']) {
        const html = phone(state, id, phoneOnly);
        expect(html).not.toMatch(/Look at the TV|on the TV|Waiting for the TV/);
        if (phoneOnly || phase === 'play' || id === 'spectator-x') expect(html).toContain('<svg');
        if (phase !== 'play') {
          if (Object.hasOwn(state.players, id)) expect(html).toContain('Your best:');
          expect(html).toContain('Final distances');
          expect(html).not.toContain('Hopping controls');
        }
      }
    }
  });

  it('gives spectators the stage and roster with no input buttons in either room type', () => {
    for (const phoneOnly of [false, true]) {
      const html = phone(state, 'spectator-x', phoneOnly);
      expect(html).toContain('<svg');
      expect(html).not.toContain('<button');
      for (const player of Object.values(state.players)) expect(html).toContain(player.name);
    }
  });
});

describe('phone controls and reconnect', () => {
  const kit = testKit(game, { players: makePlayers(8), t0: 1_000_000 });

  it('shows four labelled cardinal controls and a stage before the first hop', () => {
    const state = kit.start();
    for (const phoneOnly of [false, true]) {
      const html = phone(state, 'p1', phoneOnly);
      expect(html.match(/<button/g)).toHaveLength(4);
      for (const direction of ['Hop forward', 'Hop back', 'Hop left', 'Hop right']) {
        expect(html).toContain(`aria-label="${direction}"`);
      }
      expect(html).toContain('<svg');
      expect(html).toContain('Racer 1');
      expect(html).not.toContain('disabled=""');
    }
  });

  it('disables controls during pause and respawn while explaining a crash', () => {
    const state = kit.start();
    const paused = kit.vip(state, 'pause', 1_000_100);
    expect(phone(paused, 'p1', true).match(/disabled=""/g)).toHaveLength(4);
    const crashed: State = {
      ...state,
      world: {
        ...state.world,
        runners: state.world.runners.map((runner) =>
          runner.id === 'p1'
            ? { ...runner, alive: false, deaths: 1, lastDeath: 'water', reviveAt: 1000 }
            : runner,
        ),
      },
    };
    const html = phone(crashed, 'p1', true);
    expect(html.match(/disabled=""/g)).toHaveLength(4);
    expect(html).toContain('You missed the log');
    expect(html).toContain('Your best stays');
  });

  it('reads rejoined progress from the server view with no local identity reset', () => {
    let state = kit.input(kit.start(), 'p1', { type: 'hop', dir: 'up' }, 1_000_100);
    state = kit.player(state, 'p1', false, undefined, 1_000_200);
    state = kit.player(state, 'p1', true, undefined, 1_000_300);
    const html = phone(state, 'p1', true);
    expect(html).toContain('Racer 1');
    expect(html).toContain('Best: 1 rows');
  });

  it('sends a remote player a complete phone stage even when other players share a TV', () => {
    const state = kit.start({
      players: makePlayers(8).map((player, i) => ({
        ...player,
        canSeeTv: i !== 0,
      })),
    });
    expect(game.controllerView(state, 'p1').phoneStage).toBe(true);
    expect(game.controllerView(state, 'p2').phoneStage).toBe(false);
    expect(phone(state, 'p1', false)).toContain('<svg');
  });
});
