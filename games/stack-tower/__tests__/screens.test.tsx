// Real fixtures on both surfaces: phones retain the precise mover even beside a TV.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { slotOf } from '../client/display';
import { game } from '../server/index';
import type { State } from '../server/types';
import initial from '../fixtures/initial.json';
import play from '../fixtures/play.json';
import score from '../fixtures/score.json';
import done from '../fixtures/done.json';

const fixtures: Record<string, State> = {
  initial: initial as unknown as State,
  play: play as unknown as State,
  score: score as unknown as State,
  done: done as unknown as State,
};

const withTv = (state: State): State => ({
  ...state,
  phoneOnly: false,
  players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, { ...p, canSeeTv: true }])),
});

function phone(state: State, id: string, provider: boolean): string {
  const view = { ...game.controllerView(state, id), vip: null };
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={state.checked - Date.now()}>
      <PhoneOnlyProvider value={provider}>
        <Controller view={view} me={state.players[id] ?? { id, name: '', avatarId: 'fox', connected: true }} send={() => undefined} />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}

function tv(state: State): string {
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={state.checked - Date.now()}>
      <Tv view={{ ...game.tvView(state), vip: null }} />
    </ServerClockProvider>,
  );
}

const count = (html: string, tag: string): number => (html.match(new RegExp(`<${tag}\\b`, 'g')) ?? []).length;
const standings = (html: string): string => html.match(/<ol[^>]*aria-label="Final standings"[^>]*>([\s\S]*?)<\/ol>/)?.[1] ?? '';
const noTvDirections = (html: string): void => {
  for (const phrase of ['Look at the TV', 'on the TV', 'One moment']) expect(html).not.toContain(phrase);
};

describe.each(Object.entries(fixtures))('rendered fixture: %s', (_phase, fixture) => {
  it('TV labels every SVG tower with its owner and visible height', () => {
    const html = tv(fixture);
    expect(count(html, 'svg')).toBe(8);
    expect(count(html, 'li')).toBe(8);
    for (const tower of fixture.towers) {
      const owner = fixture.players[tower.id]?.name;
      const height = fixture.phase.id === 'play' ? tower.height : tower.best;
      expect(html).toContain(`aria-label="${owner}: ${height} floors"`);
      expect(html).toContain(`Best ${tower.best}`);
    }
    expect(count(html, 'button')).toBe(0);
  });

  it('TV-room phones show their own alignment tower and hide reducer randomness', () => {
    const state = withTv(fixture);
    const id = (state.towers.find((t) => t.crashedAt === null) ?? state.towers[0])!.id;
    const view = game.controllerView(state, id);
    const html = phone(state, id, false);
    expect(count(html, 'svg')).toBe(1);
    expect(view.towers).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('"rng"');
    expect(game.controllerView({ ...state, rng: { seed: 1_234_567_890, step: 999 } }, id)).toEqual(view);
    expect(html).not.toContain('movingSince');
    expect(html).not.toContain('1,234,567,890');
    if (state.phase.id === 'play') {
      expect(html).toContain(`Your tower ${slotOf(view.slots, id) + 1}`);
      expect(html).toContain('DROP BLOCK');
      expect(count(html, 'button')).toBe(1);
    }
  });

  it('phone-only rooms show all eight names without directing anyone to a TV', () => {
    const state = { ...fixture, phoneOnly: true };
    const html = phone(state, state.towers[0]!.id, true);
    noTvDirections(html);
    for (const p of Object.values(state.players)) expect(html).toContain(p.name);
    expect(count(html, 'li')).toBe(8);
    expect(count(html, 'svg')).toBe(1);
  });

  it('a remote phone shows the stage even when the provider says a TV is present', () => {
    const tvState = withTv(fixture);
    const id = tvState.towers[0]!.id;
    const state = { ...tvState, players: { ...tvState.players, [id]: { ...tvState.players[id]!, canSeeTv: false } } };
    expect(game.controllerView(state, id).stage).toBe(true);
    const html = phone(state, id, false);
    for (const p of Object.values(state.players)) expect(html).toContain(p.name);
    noTvDirections(html);
    expect(count(html, 'svg')).toBe(1);
  });

  it('spectators get a stage and roster with no action buttons', () => {
    const state = { ...fixture, phoneOnly: true };
    const html = phone(state, 'spectator', true);
    expect(game.controllerView(state, 'spectator').tower).toBeNull();
    expect(count(html, 'button')).toBe(0);
    expect(count(html, 'li')).toBe(8);
    for (const p of Object.values(state.players)) expect(html).toContain(p.name);
    noTvDirections(html);
    if (state.phase.id === 'play') expect(count(html, 'svg')).toBe(1);
    expect(count(phone(withTv(state), 'spectator', false), 'button')).toBe(0);
  });
});

describe('controller action and final rankings', () => {
  it('pause disables the one labelled native drop button', () => {
    const base = withTv(fixtures.play!);
    const state: State = { ...base, phase: { ...base.phase, paused: { at: base.checked } } };
    const html = phone(state, state.towers.find((t) => t.crashedAt === null)!.id, false);
    expect(count(html, 'button')).toBe(1);
    expect(html).toMatch(/<button\b[^>]*type="button"[^>]*disabled=""/);
    expect(html).toContain('DROP BLOCK');
    expect(html).not.toContain('BUILD AGAIN');
  });

  it('a miss replaces drop with rebuild while retaining the recorded best', () => {
    const base = fixtures.play!;
    const id = base.towers[0]!.id;
    const state: State = {
      ...base,
      towers: base.towers.map((t) => t.id === id ? { ...t, best: 12, crashedAt: base.checked - 700, feedback: 'miss' } : t),
      scores: { ...base.scores, [id]: 12 },
    };
    const html = phone(state, id, false);
    expect(count(html, 'button')).toBe(1);
    expect(html).toContain('BUILD AGAIN');
    expect(html).not.toContain('DROP BLOCK');
    expect(html).toContain('Best 12');
    expect(html).toContain('your best is safe');
  });

  it('score and done list all eight players in descending best-height order', () => {
    for (const fixture of [fixtures.score!, fixtures.done!]) {
      const state = withTv(fixture);
      const html = phone(state, state.towers[0]!.id, false);
      const rows = standings(html);
      expect(count(rows, 'li')).toBe(8);
      const ordered = Object.values(state.players).sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));
      for (let index = 1; index < ordered.length; index++) {
        expect(rows.indexOf(ordered[index - 1]!.name)).toBeLessThan(rows.indexOf(ordered[index]!.name));
      }
      expect(count(html, 'button')).toBe(0);
    }
  });

  it('ties use the shared skyline headline and give every tied finisher first place', () => {
    const base = fixtures.done!;
    const state: State = { ...base, scores: Object.fromEntries(base.towers.map((t) => [t.id, 12])), towers: base.towers.map((t) => ({ ...t, best: 12 })) };
    for (const id of state.towers.map((t) => t.id)) {
      const html = phone(state, id, true);
      expect(html).toContain('A tie at the skyline!');
      expect(html).toContain('You placed 1');
      expect(count(standings(html), 'li')).toBe(8);
    }
    expect(tv(state)).toContain('A tie at the skyline!');
  });
});

describe('fixed seats across arbitrary player ids', () => {
  it('TV, private phone and full roster use initial tower order, not envelope sort order', () => {
    const ids = ['z', 'p10', '__proto__', 'p2', 'constructor', 'a', 'toString', '00'];
    const state = game.init({
      players: ids.map((id, index) => ({ id, name: `Seat-${index + 1}`, avatarId: 'fox', connected: true })),
      settings: {}, seed: 16, now: 1000, presence: { mode: 'together', phoneOnly: false },
    });
    const television = tv(state);
    for (let slot = 0; slot < ids.length; slot++) {
      const id = ids[slot]!;
      const view = game.controllerView(state, id);
      expect(slotOf(view.slots, id)).toBe(slot);
      const html = phone(state, id, false);
      expect(html).toContain(`Your tower ${slot + 1}`);
      expect(html).toContain(`--tower-ink:var(--pb-player-${slot + 1})`);
      expect(television).toContain(`Seat-${slot + 1}`);
      const stage = phone({ ...state, phoneOnly: true }, id, true);
      expect(stage).toMatch(new RegExp(`--tower-ink:var\\(--pb-player-${slot + 1}\\)[^>]*>[\\s\\S]*?Seat-${slot + 1}`));
    }
    expect(slotOf({}, '__proto__')).toBe(0);
    expect(slotOf({}, 'constructor')).toBe(0);
  });
});
