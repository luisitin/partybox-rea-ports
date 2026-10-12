// Semantic screen coverage. The browser capture runner measures actual layout separately.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Arena } from '../client/Arena';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { standings } from '../client/display';
import { radius } from '../server/geometry';
import { game } from '../server/index';
import type { BlobArenaControllerView } from '../server/index';
import type { State } from '../server/types';
import done from '../fixtures/done.json';
import play from '../fixtures/play.json';
import score from '../fixtures/score.json';
import scoreLast from '../fixtures/score-last.json';

const fixtures: Record<string, State> = {
  play: play as unknown as State,
  score: score as unknown as State,
  'score-last': scoreLast as unknown as State,
  done: done as unknown as State,
};

const withTv = (state: State): State => {
  const copy = {
    ...state,
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, p]) => [id, { ...p, canSeeTv: true }]),
    ),
  };
  delete copy.phoneOnly;
  return copy;
};

function renderController(view: BlobArenaControllerView, phoneOnly: boolean): string {
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={view.began + view.checked - Date.now()}>
      <PhoneOnlyProvider value={phoneOnly}>
        <Controller
          view={{ ...view, vip: null }}
          me={{ id: view.me.id, name: 'Viewer', avatarId: 'fox' }}
          send={() => undefined}
        />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}

function phone(state: State, id: string, phoneOnly: boolean): string {
  return renderController(
    game.controllerView(phoneOnly ? { ...state, phoneOnly: true } : state, id),
    phoneOnly,
  );
}
const tv = (state: State): string =>
  renderToStaticMarkup(
    <ServerClockProvider offsetMs={state.began + state.world.time - Date.now()}>
      <Tv view={{ ...game.tvView(state), vip: null }} />
    </ServerClockProvider>,
  );
const entityIds = (html: string, kind: 'cell' | 'snack'): number[] =>
  [...html.matchAll(new RegExp(`data-${kind}-id="(\\d+)"`, 'g'))]
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
const buttons = (html: string): string[] => html.match(/<button\b[^>]*>/g) ?? [];
const roster = (html: string): string =>
  html.match(/<ol[^>]*aria-label="All players"[^>]*>([\s\S]*?)<\/ol>/)?.[1] ?? '';
const noTvCopy = (html: string): void => {
  expect(html).not.toMatch(/look at (the )?TV|on the TV|One moment/i);
};

function expectArena(html: string, state: State): void {
  if (state.phase.id !== 'play') {
    expect(html).not.toContain('data-arena="true"');
    expect(html).not.toContain('data-name-inside=');
    return;
  }
  expect(html).toContain('<svg');
  expect(html).toContain('data-arena="true"');
  if (html.includes('data-camera="personal"')) {
    expect(html).toContain('viewBox="0 0 362 420"');
    expect(html).toContain('data-camera-clipping="intentional player viewport"');
    expect(html).toContain('data-intentional-clipping="player-camera"');
  } else {
    expect(html).toContain('viewBox="0 0 160 100"');
    expect(html).toContain('data-camera="overview"');
  }
  expect(entityIds(html, 'cell')).toEqual(state.world.cells.map((c) => c.id).sort((a, b) => a - b));
  expect(entityIds(html, 'snack')).toEqual(
    state.world.pellets.map((p) => p.id).sort((a, b) => a - b),
  );
  expect(html).toContain(
    `Shared arena: ${state.world.cells.length} blobs and ${state.world.pellets.length} snacks`,
  );
}

describe.each(Object.entries(fixtures))('screens: %s', (_fixture, source) => {
  const state = withTv(source);
  const ids = Object.keys(state.players);

  it('renders the public play overview and eight player rows, with summary-only results on the TV', () => {
    const html = tv(state);
    expectArena(html, state);
    expect((roster(html).match(/<li\b/g) ?? []).length).toBe(8);
    for (const player of Object.values(state.players)) expect(roster(html)).toContain(player.name);
    if (state.phase.id === 'play') expect(html).toContain('Time left');
    else expect(html).toContain('Total');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('renders every player in both room modes and sends the same arena to phone-only players', () => {
    for (const id of ids) {
      const local = phone(state, id, false);
      expect(local).not.toContain('data-arena="true"');
      const html = phone(state, id, true);
      expectArena(html, state);
      noTvCopy(html);
      expect(html).not.toMatch(/NaN|Infinity/);
      if (state.phase.id !== 'play') {
        const rows = roster(html);
        expect((rows.match(/<li\b/g) ?? []).length).toBe(8);
        for (const p of Object.values(state.players)) expect(rows).toContain(p.name);
        expect(rows).toContain(`+${state.lastPoints[id] ?? 0}`);
        expect(rows).toContain(`>${state.scores[id] ?? 0}</b>`);
        expect(buttons(html)).toHaveLength(0);
      }
    }
  });

  it('uses an arena-bearing remote view even when the phone-only provider is false', () => {
    const id = ids[0]!;
    const remote: State = {
      ...state,
      players: { ...state.players, [id]: { ...state.players[id]!, canSeeTv: false } },
    };
    expect(game.controllerView(remote, id).arena).toEqual({
      cells: state.world.cells,
      pellets: state.world.pellets,
    });
    const html = phone(remote, id, false);
    expectArena(html, state);
    noTvCopy(html);
    expect(game.controllerView(remote, ids[1]!).arena).toBeUndefined();
  });

  it('lets spectators watch without steering or split buttons', () => {
    const local = phone(state, 'spectator', false);
    expect(buttons(local)).toHaveLength(0);
    expectArena(local, state);
    noTvCopy(local);
    const html = phone(state, 'spectator', true);
    expectArena(html, state);
    expect(buttons(html)).toHaveLength(0);
    expect(html).not.toContain('Steering pad');
    expect((roster(html).match(/<li\b/g) ?? []).length).toBe(8);
    noTvCopy(html);
  });
});

describe('play states', () => {
  const state = withTv(fixtures.play!);

  it('overlays floating steering and the original split glyph on the personal play field', () => {
    const view = game.controllerView({ ...state, phoneOnly: true }, 'p1');
    const html = renderController(view, true);
    expect(buttons(html)).toHaveLength(2);
    expect(html).toContain('Steering pad. Drag or use arrow keys or W A S D.');
    expect(html).toContain('SPLIT');
    expect(html).toContain(view.splitReason);
    expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('Steering pad.'));
    expect(html).toContain('aria-describedby="blob-split-reason"');
    expect(html).toContain('data-controls-overlay="true"');
    expect(html).toContain('data-floating-joystick="true"');
    expect(html).toContain('data-split-glyph="true"');
    expect(html).toContain(`Score: ${view.mass}`);
    expect(html).toContain('Leaderboard');
    expect(html).toContain('data-camera="personal"');
  });

  it('keeps a swallowed player watching the arena and explains their return', () => {
    const swallowed: State = {
      ...state,
      world: {
        ...state.world,
        cells: state.world.cells.filter((c) => c.owner !== 'p1'),
        respawns: { ...state.world.respawns, p1: state.world.time + 3000 },
      },
    };
    const html = phone(swallowed, 'p1', true);
    expectArena(html, swallowed);
    expect(html).toContain('Swallowed! Back in 3s');
    expect(buttons(html)).toHaveLength(2);
    expect(buttons(html).every((button) => button.includes('disabled=""'))).toBe(true);
  });

  it('holds the arena and disables both actions while paused', () => {
    const paused: State = {
      ...state,
      phase: { ...state.phase, paused: { at: state.began + state.world.time } },
    };
    const html = phone(paused, 'p1', true);
    expectArena(html, paused);
    expect(html).toContain('Paused — steering stopped');
    expect(html).toContain('data-frozen="true"');
    expect(buttons(html).every((button) => button.includes('disabled=""'))).toBe(true);
    expect(tv(paused)).toContain('Paused');
  });

  it.each([
    'Grow one blob to 48 mass',
    'Steer to aim',
    'Spawn shield',
    'Split cooling down',
    'Four blobs maximum',
    'Returning soon',
    'Round held',
  ])('explains unavailable split: %s', (reason) => {
    const base = game.controllerView(state, 'p1');
    const html = renderController({ ...base, canSplit: false, splitReason: reason }, false);
    const split = buttons(html).find((button) =>
      button.includes('aria-describedby="blob-split-reason"'),
    );
    expect(split).toContain('disabled=""');
    expect(html).toContain(reason);
  });

  it('enables split only when the public server view authorizes it', () => {
    const base = game.controllerView(state, 'p1');
    const html = renderController(
      { ...base, mass: 80, canSplit: true, splitReason: 'Ready to lunge' },
      false,
    );
    const split = buttons(html).find((button) =>
      button.includes('aria-describedby="blob-split-reason"'),
    );
    expect(split).toBeDefined();
    expect(split).not.toContain('disabled');
    expect(html).toContain('Ready to lunge');
  });
});

describe('stable identity and results', () => {
  it('keeps seat numbers and tokens when envelope order differs from initial seat order', () => {
    const state = game.init({
      players: [
        { id: 'z', name: 'Zoe', avatarId: 'fox', connected: true },
        { id: 'a', name: 'Ada', avatarId: 'owl', connected: true },
      ],
      settings: {},
      seed: 1,
      now: 1000,
    });
    const view = game.tvView(state);
    expect(view.players.map((p) => p.id)).toEqual(['a', 'z']);
    expect(view.slots).toEqual({ z: 0, a: 1 });
    expect(standings(view, false).map((row) => [row.name, row.slot])).toEqual([
      ['Zoe', 0],
      ['Ada', 1],
    ]);
    const html = tv(state);
    expect(html).toContain('Zoe, blob 1, 24 mass');
    expect(html).toContain('Ada, blob 2, 24 mass');
    expect(roster(html)).toMatch(/>1<\/b><span[^>]*>Zoe/);
    expect(roster(html)).toMatch(/>2<\/b><span[^>]*>Ada/);
    expect(phone(state, 'z', false)).toMatch(/>1<\/b>Your blob/);
    expect(phone(state, 'a', false)).toMatch(/>2<\/b>Your blob/);
    expect(html).toContain('var(--pb-player-1)');
    expect(html).toContain('var(--pb-player-2)');
  });

  it('announces the server-scored winner on both surfaces', () => {
    const state = withTv(fixtures.done!);
    const result = game.results(state)!;
    expect(result.winnerIds).toHaveLength(1);
    const winnerId = result.winnerIds[0]!;
    const winnerName = state.players[winnerId]!.name;
    const winnerLine = `${winnerName} wins!`;
    expect(tv(state)).toContain(winnerLine);
    expect(phone(state, winnerId, true)).toContain(winnerLine);
    expect(phone(state, winnerId, true)).toContain(`Top place! ${state.scores[winnerId]} points`);
    const otherId = Object.keys(state.players).find((id) => !result.winnerIds.includes(id))!;
    expect(phone(state, otherId, false)).toContain('Place');
  });

  it('describes the summary-only finished spectator view without promising an arena', () => {
    for (const phoneOnly of [false, true]) {
      const html = phone(withTv(fixtures.done!), 'spectator', phoneOnly);
      expect(html).toMatch(/role="status">Watching the results<\/p>/);
      expectArena(html, fixtures.done!);
      expect(buttons(html)).toHaveLength(0);
      expect((roster(html).match(/<li\b/g) ?? []).length).toBe(8);
      const playing = phone(withTv(fixtures.play!), 'spectator', phoneOnly);
      expect(playing).toMatch(/role="status">Watching the arena<\/p>/);
      expectArena(playing, fixtures.play!);
    }
  });

  it('promises final results after round three instead of another round', () => {
    const last = withTv(fixtures['score-last']!);
    expect(last.round).toBe(3);
    expect(tv(last)).toContain('Final results follow shortly.');
    for (const html of [
      phone(last, 'p1', true),
      phone(last, 'p1', false),
      phone(last, 'spectator', true),
    ]) {
      expect(html).toContain('Final results in');
      expect(html).not.toContain('Next round in');
    }
    expect(tv(withTv(fixtures.score!))).toContain('Next round starts shortly.');
  });

  it('names every tied winner without applying an extra tie-break', () => {
    const source = withTv(fixtures.done!);
    const state: State = {
      ...source,
      scores: Object.fromEntries(
        Object.keys(source.players).map((id) => [id, id === 'p1' || id === 'p2' ? 5000 : 10]),
      ),
    };
    expect(game.results(state)?.winnerIds).toEqual(['p1', 'p2']);
    for (const html of [tv(state), phone(state, 'p1', true), phone(state, 'spectator', true)])
      expect(html).toContain('Ana, Ben tie for the win!');
  });

  it('escapes full names safely and names every physical split piece at its centre', () => {
    const view = game.tvView(withTv(fixtures.play!));
    const owner = view.cells[0]!.owner;
    const name = 'A very long <name> & friends';
    const cells = [...view.cells, { ...view.cells[0]!, id: 10000, mass: 50 }];
    const html = renderToStaticMarkup(
      <Arena
        {...view}
        cells={cells}
        players={view.players.map((p) => (p.id === owner ? { ...p, name } : p))}
      />,
    );
    expect(entityIds(html, 'cell')).toHaveLength(cells.length);
    expect((html.match(/data-cell-label-id=/g) ?? []).length).toBe(cells.length);
    expect((html.match(/data-name-owner=/g) ?? []).length).toBe(cells.length);
    expect((html.match(/data-name-inside="true"/g) ?? []).length).toBe(cells.length);
    for (const cell of cells) {
      const group = html.match(
        new RegExp(`<g[^>]*data-cell-id="${cell.id}"[^>]*>([\\s\\S]*?)<\\/g>`),
      )?.[1];
      expect(group).toBeDefined();
      expect(group!.indexOf('data-cell-body=')).toBeLessThan(group!.indexOf('data-name-owner='));
    }
    expect(html).not.toContain('<name>');
    expect(html).toContain('&lt;name&gt; &amp; friends');
    expect(
      [...html.matchAll(/<text[^>]*data-name-owner="p1"[^>]*>([^<]*)<\/text>/g)].map(
        (match) => match[1],
      ),
    ).toEqual(['A very long &lt;name&gt; &amp; friends', 'A very long &lt;name&gt; &amp; friends']);
    expect(html).not.toContain('data-cell-label-backplate=');
    expect(html).not.toContain('data-name-leader=');
  });
});

describe('connection, departure and compact stages', () => {
  it('labels a dropped seat Offline and a permanent departure Left on both public rosters', () => {
    const source = withTv(fixtures.play!);
    const state: State = {
      ...source,
      left: ['p2'],
      players: {
        ...source.players,
        p1: { ...source.players.p1!, connected: false },
        p2: { ...source.players.p2!, connected: false },
      },
      world: { ...source.world, cells: source.world.cells.filter((cell) => cell.owner !== 'p2') },
    };
    for (const html of [tv(state), phone(state, 'spectator', true)]) {
      expect(roster(html)).toMatch(/aria-label="Disconnected"[^>]*>Offline<\/span>/);
      expect(roster(html)).toContain('Left');
      expect(roster(html)).not.toContain('○');
    }
  });
  it('disables a disconnected living seat and restores controls at the same pose on reconnect', () => {
    const state = withTv(fixtures.play!);
    const base = game.controllerView(state, 'p1');
    const offline = {
      ...base,
      connected: false,
      players: base.players.map((row) => (row.id === 'p1' ? { ...row, connected: false } : row)),
    };
    const html = renderController(offline, false);
    expect(html).toContain('Disconnected — steering stopped. Reconnect to play.');
    expect(html).not.toContain('Swallowed!');
    expect(buttons(html)).toHaveLength(2);
    expect(buttons(html).every((button) => button.includes('disabled=""'))).toBe(true);
    const restored = renderController(
      { ...base, canSplit: true, splitReason: 'Ready to lunge' },
      false,
    );
    expect(buttons(restored).every((button) => !button.includes('disabled=""'))).toBe(true);
    expect(restored).toContain('Snack to grow. Swallow smaller rivals.');
  });

  it('also stops when the shell envelope reports a drop before the reducer connection flag changes', () => {
    const base = game.controllerView(withTv(fixtures.play!), 'p1');
    expect(base.connected).toBe(true);
    const html = renderController(
      {
        ...base,
        players: base.players.map((row) => (row.id === 'p1' ? { ...row, connected: false } : row)),
      },
      false,
    );
    expect(html).toContain('Disconnected — steering stopped.');
    expect(buttons(html).every((button) => button.includes('disabled=""'))).toBe(true);
  });

  it('a departed remote seat watches the public arena and never receives controls or a respawn promise', () => {
    const source = withTv(fixtures.play!);
    const left: State = {
      ...source,
      left: ['p1'],
      players: {
        ...source.players,
        p1: { ...source.players.p1!, connected: false, canSeeTv: false },
      },
      world: {
        ...source.world,
        cells: source.world.cells.filter((cell) => cell.owner !== 'p1'),
        respawns: {},
      },
    };
    const html = phone(left, 'p1', false);
    expectArena(html, left);
    noTvCopy(html);
    expect(buttons(html)).toHaveLength(0);
    expect(html).toContain('You left this match — watching the arena.');
    expect(html).not.toMatch(/Back in|Returning soon|Your blob/);
    expect(roster(html)).toContain('Left');
    expect(tv(left)).not.toContain('Swallowed blobs return in 3s.');
    const paused: State = {
      ...left,
      phase: { ...left.phase, paused: { at: left.began + left.world.time } },
    };
    expect(buttons(phone(paused, 'p1', false))).toHaveLength(0);
    expect(phone(paused, 'p1', false)).toContain('You left this match');
  });

  it('keeps a departed seat’s banked score and final place inspectable without offering re-entry', () => {
    const source = withTv(fixtures.done!);
    const left: State = {
      ...source,
      left: ['p1'],
      players: { ...source.players, p1: { ...source.players.p1!, connected: false } },
      world: {
        ...source.world,
        cells: source.world.cells.filter((cell) => cell.owner !== 'p1'),
        respawns: {},
      },
    };
    const view = game.controllerView(left, 'p1');
    expect(view.rank).not.toBeNull();
    const html = phone(left, 'p1', false);
    expectArena(html, left);
    expect(html).toContain(`Place ${view.rank} · ${left.scores.p1} points`);
    expect(roster(html)).toContain('data-me="true"');
    expect(roster(html)).toContain('Left');
    expect(buttons(html)).toHaveLength(0);
    expect(html).not.toMatch(/Back in|Next round in/);
  });

  it('does not promise a three-second respawn beyond the final horn', () => {
    const source = withTv(fixtures.play!);
    const state: State = {
      ...source,
      round: 3,
      endsAt: source.began + source.world.time + 1000,
      world: {
        ...source.world,
        cells: source.world.cells.filter((cell) => cell.owner !== 'p1'),
        respawns: { p1: source.world.time + 3000 },
      },
    };
    const html = phone(state, 'p1', true);
    expect(html).toContain('Swallowed — watching until the round ends.');
    expect(html).not.toContain('Back in 3s');
    expect(buttons(html).every((button) => button.includes('disabled=""'))).toBe(true);
  });

  it('keeps all eight long-name shared winners and duplicate places in compact results', () => {
    const source = withTv(fixtures.done!);
    const names = Object.keys(source.players).map(
      (_, index) => `Player ${index + 1} with a long name`,
    );
    const state: State = {
      ...source,
      players: Object.fromEntries(
        Object.entries(source.players).map(([id, row], index) => [
          id,
          { ...row, name: names[index]! },
        ]),
      ),
      scores: Object.fromEntries(Object.keys(source.players).map((id) => [id, 5000])),
    };
    const html = phone(state, 'p1', true);
    expect(html).toMatch(/<h2[^>]*>8 tied winners<\/h2>/);
    expect(html).toContain('Tied top place! 5000 points');
    expect((roster(html).match(/aria-label="Place 1"/g) ?? []).length).toBe(8);
    expect((roster(html).match(/data-winner="true"/g) ?? []).length).toBe(8);
    for (const name of names) expect(roster(html)).toContain(`title="${name}"`);
    expect(html).toContain('Place / player');
    expect(buttons(html)).toHaveLength(0);
    expect(tv(state)).toMatch(/<h2[^>]*>8 tied winners<\/h2>/);
  });
});

describe('public pose and identity layers', () => {
  it('retains true physical radii and centres identity without opaque external plates', () => {
    const view = game.tvView(withTv(fixtures.play!));
    const cells = [24, 60].map((mass, index) => ({
      ...view.cells[index]!,
      x: 40 + index * 60,
      y: 50,
      mass,
      shieldUntil: view.checked + 1000,
    }));
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(
        <Arena {...view} cells={cells} pellets={[]} phone compact={compact} />,
      );
      for (const cell of cells) {
        const group = html.match(
          new RegExp(`<g[^>]*data-cell-id="${cell.id}"[^>]*>([\\s\\S]*?)<\\/g>`),
        )?.[1];
        expect(group).toBeDefined();
        for (const carrier of ['logical', 'outline']) {
          const sampled = group!.match(
            new RegExp(`<circle[^>]*data-cell-${carrier}-radius="true"[^>]*r="([^"]+)"`),
          );
          expect(sampled).not.toBeNull();
          expect(Number(sampled![1])).toBeCloseTo(radius(cell.mass));
        }
        const body = group!.match(/<path[^>]*data-cell-body="true"[^>]*d="([^"]+)"/);
        expect(body).not.toBeNull();
        const vertices = [...body![1]!.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
        expect(vertices).toHaveLength(48);
        for (const point of vertices)
          expect(
            Math.abs(Math.hypot(Number(point[1]), Number(point[2])) - radius(cell.mass)),
          ).toBeLessThan(0.05);
        expect(group).not.toMatch(/<circle[^>]*data-cell-body=/);
        expect(html).toMatch(
          new RegExp(
            `<text[^>]*data-cell-label-id="${cell.id}"[^>]*data-name-inside="true"[^>]*x="0"[^>]*y="0"`,
          ),
        );
      }
      expect(html).not.toContain('data-number-leader=');
      expect(html).not.toContain('data-name-leader=');
      expect(html).not.toContain('data-cell-label-backplate=');
      for (const cell of cells) {
        const group = html.match(
          new RegExp(`<g[^>]*data-cell-id="${cell.id}"[^>]*>([\\s\\S]*?)<\\/g>`),
        )?.[1];
        expect(group).toContain(`data-cell-label-id="${cell.id}"`);
      }
    }
  });
  it('keeps each received body and inside name aligned before and after a movement snapshot', () => {
    const view = game.tvView(withTv(fixtures.play!));
    for (const cells of [
      view.cells,
      view.cells.map((cell) => ({ ...cell, x: cell.x + (cell.x < 150 ? 4 : -4) })),
    ]) {
      const html = renderToStaticMarkup(<Arena {...view} cells={cells} />);
      const layers = [
        ...html.matchAll(
          /<g\b[^>]*data-pose-cell="(\d+)"[^>]*data-pose-layer="([^"]+)"[^>]*style="([^"]*)"/g,
        ),
      ];
      expect(layers).toHaveLength(cells.length);
      for (const cell of cells) {
        const poses = layers.filter((match) => Number(match[1]) === cell.id);
        expect(poses.map((match) => match[2])).toEqual(['cell']);
        for (const match of poses)
          expect(match[3]).toContain(`transform:translate(${cell.x}px, ${cell.y}px)`);
      }
      expect(entityIds(html, 'cell')).toEqual(cells.map((cell) => cell.id).sort((a, b) => a - b));
    }
  });
  it('retains outlined accessible identity on every coincident split piece in the compact world', () => {
    const view = game.tvView(withTv(fixtures.play!));
    const cells = view.cells.flatMap((cell, index) =>
      Array.from({ length: 4 }, (_, piece) => ({
        ...cell,
        id: 10000 + index * 4 + piece,
        x: 80,
        y: 50,
        mass: 24,
      })),
    );
    const html = renderToStaticMarkup(
      <Arena {...view} cells={cells} phone compact frozen mine="p1" />,
    );
    expect(entityIds(html, 'cell')).toHaveLength(32);
    expect((html.match(/data-cell-label-id=/g) ?? []).length).toBe(32);
    expect((html.match(/data-name-inside="true"/g) ?? []).length).toBe(32);
    expect((html.match(/data-name-owner=/g) ?? []).length).toBe(32);
    expect(html).not.toContain('data-cell-label-backplate=');
    for (const player of view.players)
      expect(html).toContain(`${player.name}, blob ${(view.slots[player.id] ?? 0) + 1}, 24 mass`);
    expect(html).toContain('Your blob');
    expect(html).toContain('data-frozen="true"');
  });
});

describe('theme and motion policy', () => {
  it('uses token colours and preserves the two reduced-motion controls', () => {
    for (const file of ['Arena.module.css', 'Controller.module.css', 'Tv.module.css']) {
      const css = readFileSync(new URL(`../client/${file}`, import.meta.url), 'utf8');
      expect(css).not.toMatch(/#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/i);
      expect(css).toContain('var(--pb-');
      if (/\b(?:animation|transition)\s*:/.test(css)) {
        expect(css).toContain('prefers-reduced-motion: reduce');
        expect(css).toContain("data-motion='off'");
      }
    }
  });
});
