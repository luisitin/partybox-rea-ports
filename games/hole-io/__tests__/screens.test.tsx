// Production close-camera wrappers, permanent loss, presence and true score ties.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { liveStandings, standings, targetsFor, watchingLeader } from '../client/presentation';
import { game } from '../server/index';
import type { HoleControllerView, State } from '../server/types';
import { start, T0, vip } from './helpers';

function phoneView(view: HoleControllerView, phoneOnly = false): string {
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={{ ...view, vip: null }}
        me={
          view.players.find((p) => p.id === view.me.id) ?? {
            id: view.me.id,
            name: 'Spectator',
            avatarId: 'fox',
            connected: true,
          }
        }
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}
function phone(state: State, id: string, phoneOnly = false): string {
  return phoneView(game.controllerView({ ...state, phoneOnly }, id), phoneOnly);
}
function tv(state: State): string {
  return renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
}
function phaseState(phase: string): State {
  const s = start(8, 19);
  return phase === 'play' ? s : vip(s, phase === 'reveal' ? 'skip' : 'end', T0);
}

describe.each(['play', 'reveal', 'done'])('native wrapper %s', (phase) => {
  it('renders each player and complete finished rankings on TV', () => {
    const s = phaseState(phase);
    const html = tv(s);
    for (const p of Object.values(s.players)) expect(html).toContain(p.name);
    if (phase === 'play') {
      expect(html.match(/data-camera-id=/g)).toHaveLength(8);
      expect(html).toContain('data-close-cameras="true"');
      expect(html.match(/role="timer"/g)).toHaveLength(1);
    } else {
      expect(html).toContain('Final standings');
      expect(html.match(/<li\b/g)).toHaveLength(8);
      expect(html).not.toContain('data-close-cameras');
    }
  });

  it.each([false, true])('restores own phone phase, phoneOnly=%s', (phoneOnly) => {
    const s = phaseState(phase);
    const html = phone(s, 'p1', phoneOnly);
    expect(html).not.toMatch(/on the TV|Look at the TV|One moment|Start small again|Back in/);
    expect(html.includes('Move your hole')).toBe(phase === 'play');
    if (phase === 'play') {
      expect(html).toContain('Your close city view');
      expect(html).toContain('data-camera-id="p1"');
      expect(html).toContain('<svg');
    } else {
      expect(html.match(/<li\b/g)).toHaveLength(8);
      expect(html).toContain('Banked points decide the winners.');
    }
  });

  it.each([false, true])('spectators cannot steer, phoneOnly=%s', (phoneOnly) => {
    const html = phone(phaseState(phase), 'spectator', phoneOnly);
    expect(html).not.toContain('Move your hole');
    if (phase === 'play') {
      expect(html).toContain('Live city view');
      expect(html).toContain('Watching the city');
    } else expect(html).toContain('Final standings');
  });
});

it('uses own close cameras for remote and nearby players alike', () => {
  const s = start(2);
  const remote = { ...s, players: { ...s.players, p1: { ...s.players.p1!, canSeeTv: false } } };
  for (const state of [s, remote]) {
    const html = phone(state, 'p1');
    expect(html).toContain('data-camera-id="p1"');
    expect(html).toContain('Your close city view');
    expect(html).toContain('Move your hole');
  }
});

it('banks eliminated points and follows the live leader without retry controls', () => {
  const view = game.controllerView(start(3), 'p1');
  const mine = { ...view.mine!, alive: false, score: 37, eliminatedBy: 'p2', eliminatedAt: 1500 };
  const city = {
    ...view.city,
    holes: view.city.holes.map((h) =>
      h.id === 'p1' ? mine : { ...h, score: h.id === 'p2' ? 50 : 10 },
    ),
  };
  const html = phoneView({ ...view, mine, city, participating: false, stage: true });
  expect(html).toContain('You were swallowed!');
  expect(html).toContain('37 points banked');
  expect(html).toContain('data-camera-id="p2"');
  expect(html).toContain('Final scores at the end of the clock.');
  expect(html).not.toMatch(/Move your hole|Back in|Start small|Try again|respawn/i);
});

it('leavers watch; temporarily disconnected players retain a disabled local pad', () => {
  const view = game.controllerView(start(2), 'p1');
  const gone = phoneView({
    ...view,
    mine: { ...view.mine!, left: true },
    participating: false,
    city: { ...view.city, holes: view.city.holes.map((h) => ({ ...h, left: h.id === 'p1' })) },
  });
  expect(gone).toContain('You left the round');
  expect(gone).not.toContain('Move your hole');
  const away = phoneView({ ...view, mine: { ...view.mine!, connected: false } });
  expect(away).toContain('data-camera-id="p1"');
  expect(away).toContain('Move your hole');
  expect(away).toContain('disabled=""');
  expect(away).toContain('Disconnected');
});

it('disables steering during pause without losing the camera or clock', () => {
  const view = game.controllerView(start(2), 'p1');
  const html = phoneView({ ...view, paused: true, clockHeldAt: T0 });
  expect(html).toContain('data-camera-id="p1"');
  expect(html).toContain('disabled=""');
  expect(html).toContain('Paused');
  expect(html.match(/role="timer"/g)).toHaveLength(1);
});

it('shows all-out state without early results or steering', () => {
  const s = start(2);
  const state = {
    ...s,
    world: {
      ...s.world,
      holes: s.world.holes.map((h) => ({
        ...h,
        alive: false,
        eliminatedAt: 1000,
        eliminatedBy: 'other',
      })),
    },
  };
  const html = tv(state);
  expect(html).toContain('No holes left in the city');
  expect(html).toContain('role="timer"');
  expect(html).not.toContain('Final standings');
  expect(phone(state, 'p1')).toContain('No holes left in the city');
  expect(phone(state, 'p1')).not.toContain('Move your hole');
});

describe.each(['reveal', 'done'])('score ties during %s', (phase) => {
  it('highlights both score winners even when one is eliminated, with stable slots', () => {
    const roster = [
      { id: 'z-player', name: 'Zelda', avatarId: 'fox', connected: true },
      { id: 'a-player', name: 'Alpha', avatarId: 'owl', connected: true },
      { id: 'm-player', name: 'Mira', avatarId: 'frog', connected: false },
    ];
    const initial = game.init({ players: roster, now: T0, seed: 19, settings: {} });
    const scored = {
      ...initial,
      world: {
        ...initial.world,
        holes: initial.world.holes.map((h) => ({
          ...h,
          score: h.id === 'a-player' ? 10 : 20,
          alive: h.id !== 'z-player',
        })),
      },
    };
    const s = vip(scored, phase === 'reveal' ? 'skip' : 'end', T0);
    const view = game.tvView(s);
    const rows = standings(view.city, view.players);
    expect(rows.map((r) => [r.hole.id, r.hole.slot, r.rank])).toEqual([
      ['z-player', 0, 1],
      ['m-player', 2, 1],
      ['a-player', 1, 3],
    ]);
    for (const html of [tv(s), phone(s, 'z-player'), phone(s, 'z-player', true)]) {
      expect(html).toContain('Tied winners');
      const cards = html.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
      expect(cards).toHaveLength(3);
      for (const row of rows) {
        const card = cards.find((text) => text.includes('data-player-id="' + row.hole.id + '"'))!;
        expect(card).toContain(row.name);
        expect(card).toContain('var(--pb-player-' + (row.hole.slot + 1) + ')');
        expect(card.includes('data-winner="true"')).toBe(row.rank === 1);
        expect(card).toContain('Place ' + row.rank);
      }
    }
  });
});

it('renders full legal 40-character names in wrappers and result cards', () => {
  const base = start(8);
  const players = Object.fromEntries(
    Object.entries(base.players).map(([id, p]) => [
      id,
      { ...p, name: (id + ' Maximiliana Guadalupe Washington XIII!!!').slice(0, 40) },
    ]),
  );
  const s = { ...base, players };
  const tvHtml = tv(s);
  for (const p of Object.values(players)) {
    expect(p.name).toHaveLength(40);
    expect(tvHtml).toContain(p.name);
  }
  expect(phone(s, 'p1')).toContain(players.p1!.name);
  const resultHtml = phone(vip(s, 'skip', T0), 'p1');
  for (const p of Object.values(players)) expect(resultHtml).toContain(p.name);
});

it('keeps strict size cues and chooses connected surviving watch targets', () => {
  expect(targetsFor(4.2)).toEqual({ current: 'Benches', next: 'Cars' });
  expect(targetsFor(4.2001)).toEqual({ current: 'Cars', next: 'Houses' });
  const view = game.tvView(start(3));
  const rows = standings(
    {
      ...view.city,
      holes: view.city.holes.map((h) => ({
        ...h,
        score: h.id === 'p1' ? 100 : h.id === 'p2' ? 50 : 10,
        alive: h.id !== 'p1',
      })),
    },
    view.players.map((p) => ({ ...p, connected: p.id !== 'p2' })),
  );
  expect(liveStandings(rows).map((r) => r.hole.id)).toEqual(['p2', 'p3']);
  expect(watchingLeader(rows)?.hole.id).toBe('p3');
  const fallback = standings(undefined, view.players, { p1: 20, p2: 20, p3: 0 });
  expect(fallback.map((r) => r.rank)).toEqual([1, 1, 3]);
  expect(liveStandings(fallback)).toEqual([]);
});
