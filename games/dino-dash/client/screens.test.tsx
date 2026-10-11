import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { game } from '../server/index';
import type { State } from '../server/types';
import { Controller } from './Controller';
import { Tv } from './Tv';

const players = Array.from({ length: 8 }, (_, n) => ({
  id: `p${n + 1}`,
  name: `Runner ${n + 1}`,
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
const start = (): State => game.init({ players, settings: { rounds: 3 }, seed: 13, now: 1000 });
const play = start();
const score = game.reduce(play, { type: 'vip', now: 5000, action: 'skip' });
const done = game.reduce(score, { type: 'vip', now: 6000, action: 'end' });
const phases = { play, score, done };

function phone(state: State, id: string, phoneOnly: boolean): string {
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={{ ...game.controllerView(state, id), vip: null }}
        me={state.players[id] ?? { id, name: 'Spectator', avatarId: 'owl', connected: true }}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}

describe.each(Object.entries(phases))('%s phase screens', (phase, state) => {
  it('renders TV with every lane and the full named roster', () => {
    const html = renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
    expect(html).toContain('Race lanes');
    for (const player of players) expect(html).toContain(player.name);
    if (phase === 'play') expect(html).toContain('role="timer"');
    else expect(html).toContain('Match standings');
  });

  it.each([false, true])('renders all players and spectators; phoneOnly=%s', (phoneOnly) => {
    for (const id of [...players.map((p) => p.id), 'spectator']) {
      const html = phone(state, id, phoneOnly);
      const canRun = phase === 'play' && id !== 'spectator';
      expect(html.includes('aria-label="Jump over a rock"')).toBe(canRun);
      expect(html.includes('aria-label="Hold to duck under a bird"')).toBe(canRun);
      expect(html).not.toMatch(/Look at the TV|on the TV/);
      if (phoneOnly || phase !== 'play' || id === 'spectator') {
        for (const player of players) expect(html).toContain(player.name);
      }
      if (canRun) {
        expect(html).toContain('data-runner="' + id + '"');
        expect(html.indexOf('data-runner="' + id + '"')).toBeLessThan(
          html.indexOf('aria-label="Jump over a rock"'),
        );
        expect(html).toContain('Lane ' + id.slice(1));
      }
      if (phase !== 'play' && id !== 'spectator') expect(html).toMatch(/rank: |Rank /);
    }
  });
});

describe('public stage and controls', () => {
  it('gives a remote player live distances even without the phone-only provider', () => {
    const remote: State = {
      ...play,
      players: { ...play.players, p1: { ...play.players.p1!, canSeeTv: false } },
    };
    const html = phone(remote, 'p1', false);
    expect(game.controllerView(remote, 'p1').stage).toBe(true);
    expect(html).toContain('Live distances');
    for (const player of players) expect(html).toContain(player.name);
    expect(html).toContain('aria-label="Jump over a rock"');
  });

  it.each([false, true])(
    'dead runners see the continuing public race and no controls; phoneOnly=%s',
    (phoneOnly) => {
      const crashed: State = {
        ...play,
        world: {
          ...play.world,
          runners: play.world.runners.map((r, n) =>
            n === 0 ? { ...r, died: 100, distance: 36 } : r,
          ),
        },
      };
      const html = phone(crashed, 'p1', phoneOnly);
      expect(html).toContain('You crashed');
      expect(html).toContain('Race lanes');
      expect(html).not.toContain('<button');
      for (const player of players) expect(html).toContain(player.name);
    },
  );

  it('paused controls disappear while the authoritative lane remains', () => {
    const paused: State = { ...play, phase: { ...play.phase, paused: { at: 1300 } } };
    const html = phone(paused, 'p1', true);
    expect(html).toContain('Paused');
    expect(html).toContain('data-runner="p1"');
    expect(html).not.toContain('<button');
  });

  it('shows shared winners, honest shared ranks, own total and all eight names', () => {
    const tied: State = {
      ...done,
      scores: { p1: 500, p2: 500, p3: 100, p4: 100, p5: 50, p6: 25, p7: 10, p8: 0 },
    };
    const html = phone(tied, 'p1', true);
    expect(html).toContain('Shared winners!');
    expect(html).toContain('Your rank: 1, tied');
    expect(html).toContain('500 m');
    expect(html).toContain('Rank 3, tied');
    for (const player of players) expect(html).toContain(player.name);
    expect(html).not.toContain('You won');
  });
});
