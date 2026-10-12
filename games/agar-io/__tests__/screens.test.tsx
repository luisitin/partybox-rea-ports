// Semantic screen coverage. The browser capture runner measures actual layout separately.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Arena } from '../client/Arena';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { standings } from '../client/display';
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
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={{ ...view, vip: null }}
        me={{ id: view.me.id, name: 'Viewer', avatarId: 'fox' }}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}

function phone(state: State, id: string, phoneOnly: boolean): string {
  return renderController(
    game.controllerView(phoneOnly ? { ...state, phoneOnly: true } : state, id),
    phoneOnly,
  );
}
const tv = (state: State): string =>
  renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
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
  expect(html).toContain('<svg');
  expect(html).toContain('viewBox="0 0 160 100"');
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

  it('renders the entire public world and eight readable player rows on the TV', () => {
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
      expect(local).not.toContain('<svg');
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
    expect(local).not.toContain('<svg');
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

  it('puts the same arena before the steering controls with a labelled split action', () => {
    const view = game.controllerView({ ...state, phoneOnly: true }, 'p1');
    const html = renderController(view, true);
    expect(buttons(html)).toHaveLength(2);
    expect(html).toContain('Steering pad. Drag or use arrow keys or W A S D.');
    expect(html).toContain('SPLIT');
    expect(html).toContain(view.splitReason);
    expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('Steering pad.'));
    expect(html).toContain('aria-describedby="blob-split-reason"');
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
    expect(html).toContain('Paused — steering is held');
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

  it('promises final results after round three instead of another round', () => {
    const last = withTv(fixtures['score-last']!);
    expect(last.round).toBe(3);
    for (const html of [
      tv(last),
      phone(last, 'p1', true),
      phone(last, 'p1', false),
      phone(last, 'spectator', true),
    ]) {
      expect(html).toContain('Final results follow shortly.');
      expect(html).not.toContain('Next round starts shortly.');
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

  it('renders long names safely and labels all pieces while naming only one piece per player', () => {
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
    expect(html.lastIndexOf('data-cell-id=')).toBeLessThan(html.indexOf('data-name-owner='));
    expect(html.lastIndexOf('data-name-owner=')).toBeLessThan(html.indexOf('data-cell-label-id='));
    expect(html).not.toContain('<name>');
    expect(html).toContain('&lt;name&gt; &amp; friends');
    expect(html).toContain(`${name.slice(0, 8)}…`);
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
