// Production SSR for every surface and phase, including remote and spectator controllers.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { holeLabels, standings, targetsFor } from '../client/presentation';
import { game } from '../server/index';
import type { HoleView, State } from '../server/types';
import play from '../fixtures/play.json';
import reveal from '../fixtures/reveal.json';
import done from '../fixtures/done.json';

const fixtures = { play, reveal, done } as unknown as Record<string, State>;
function phone(state: State, id: string, phoneOnly: boolean): string {
  const s = { ...state, phoneOnly };
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={{ ...game.controllerView(s, id), vip: null }}
        me={s.players[id] ?? { id, name: 'Spectator', avatarId: 'fox', connected: true }}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}
describe.each(Object.entries(fixtures))('screen %s', (phase, state) => {
  it('renders the full city and every player on TV', () => {
    const html = renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
    expect(html).toContain('<svg');
    for (const p of Object.values(state.players)) expect(html).toContain(p.name);
    expect(html).toContain('Player scores');
  });
  it('shows a complete phone-only stage and actionable play controls', () => {
    const html = phone(state, 'p1', true);
    expect(html).toContain('City with numbered player holes');
    expect(html).not.toMatch(/on the TV|Look at the TV|One moment/);
    expect(html.includes('Move your hole')).toBe(phase === 'play');
    if (phase !== 'play')
      for (const p of Object.values(state.players)) expect(html).toContain(p.name);
  });
  it('keeps the TV-room controller small and restores the correct phase', () => {
    const html = phone(state, 'p1', false);
    expect(html).not.toContain('City with numbered player holes');
    expect(html.includes('Move your hole')).toBe(phase === 'play');
    expect(html).toMatch(/Points|points/);
  });
  it('lets spectators watch the stage without steering in both room modes', () => {
    for (const phoneOnly of [false, true]) {
      const html = phone(state, 'spectator', phoneOnly);
      expect(html).toContain('City with numbered player holes');
      expect(html).not.toContain('Move your hole');
    }
  });
});
it('supports a remote phone in a room with a TV', () => {
  const s = fixtures.play!;
  const remote = { ...s, players: { ...s.players, p1: { ...s.players.p1!, canSeeTv: false } } };
  expect(phone(remote, 'p1', false)).toContain('City with numbered player holes');
});
it('labels edible classes at strict thresholds and keeps shared score ranks', () => {
  expect(targetsFor(4.2)).toEqual({ current: 'Benches', next: 'Cars' });
  expect(targetsFor(4.2001)).toEqual({ current: 'Cars', next: 'Houses' });
  expect(targetsFor(14)).toEqual({ current: 'Towers', next: null });
  const rows = standings(
    undefined,
    [
      { id: 'a', name: 'A', connected: true },
      { id: 'b', name: 'B', connected: false },
    ],
    { a: 20, b: 20 },
  );
  expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  expect(rows.map((r) => r.connected)).toEqual([true, false]);
});

// Real room ids need not sort in the order the players joined. Numbers survive that sorting.
describe.each(['reveal', 'done'])('stable roster identities during %s', (phase) => {
  const roster = [
    { id: 'z-player', name: 'Zelda', avatarId: 'fox', connected: true },
    { id: 'a-player', name: 'Alpha', avatarId: 'owl', connected: true },
    { id: 'm-player', name: 'Mira', avatarId: 'frog', connected: false },
  ];
  const slots = { 'z-player': 0, 'a-player': 1, 'm-player': 2 };
  function stateForPhase(): State {
    const initial = game.init({ players: roster, now: 1000, seed: 19, settings: {} });
    const scored = {
      ...initial,
      world: {
        ...initial.world,
        holes: initial.world.holes.map((h) => ({ ...h, score: h.id === 'a-player' ? 10 : 20 })),
      },
    };
    return game.reduce(scored, {
      type: 'vip',
      now: 1000,
      action: phase === 'reveal' ? 'skip' : 'end',
    });
  }

  it('carries each original slot for every controller, including disconnected players and spectators', () => {
    const s = stateForPhase();
    for (const id of [...roster.map((p) => p.id), 'spectator']) {
      const cv = game.controllerView(s, id);
      expect(cv.players.map((p) => p.id)).toEqual(['a-player', 'm-player', 'z-player']);
      expect(cv.slots).toEqual(slots);
      expect(JSON.parse(JSON.stringify(cv.slots))).toEqual(slots);
    }
  });

  it('keeps TV-room and phone-only ranking numbers identical to the TV at tied scores', () => {
    const s = stateForPhase();
    const tv = game.tvView(s);
    const expected = standings(tv.city, tv.players).map((r) => [r.hole.id, r.hole.slot, r.rank]);
    expect(expected).toEqual([
      ['z-player', 0, 1],
      ['m-player', 2, 1],
      ['a-player', 1, 3],
    ]);
    for (const phoneOnly of [false, true]) {
      const cv = game.controllerView({ ...s, phoneOnly }, 'z-player');
      const rows = standings(cv.city, cv.players, cv.scores, cv.slots);
      expect(rows.map((r) => [r.hole.id, r.hole.slot, r.rank])).toEqual(expected);
    }
  });

  it('renders the correct original hole number beside every named result on a nearby phone', () => {
    const s = stateForPhase();
    const html = phone(s, 'z-player', false);
    const cards = html.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
    expect(cards).toHaveLength(3);
    for (const p of roster) {
      const card = cards.find((text) => text.includes(p.name));
      expect(card, p.name).toBeDefined();
      expect(card, p.name).toContain(`aria-label="Hole ${slots[p.id as keyof typeof slots] + 1}"`);
    }
  });
});

it.each([
  [90, 55],
  [4, 5],
  [176, 105],
])('keeps all eight crowded identities readable near city position %i, %i', (x, y) => {
  const holes: HoleView[] = Array.from({ length: 8 }, (_, slot) => ({
    id: `p${slot}`,
    slot,
    x,
    y,
    radius: 3.4,
    score: 0,
    swallowed: 0,
    respawnIn: 0,
    shield: false,
    lastGain: 0,
  }));
  const before = JSON.stringify(holes);
  const labels = holeLabels(holes);
  expect(labels).toEqual(holeLabels(holes));
  expect(labels.map((label) => label.hole.id)).toEqual(holes.map((h) => h.id));
  expect(JSON.stringify(holes)).toBe(before);
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!;
    expect(label.callout).toBe(true);
    expect(label.x).toBeGreaterThanOrEqual(4);
    expect(label.x).toBeLessThanOrEqual(176);
    expect(label.y).toBeGreaterThanOrEqual(5);
    expect(label.y).toBeLessThanOrEqual(105);
    for (const other of labels.slice(i + 1))
      expect(Math.hypot(label.x - other.x, label.y - other.y)).toBeGreaterThanOrEqual(7);
  }
});
