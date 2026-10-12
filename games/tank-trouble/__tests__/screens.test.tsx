// Real server views/components rendered at the required surfaces, with shell space reserved.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { readingMs, wordCount } from '@partybox/game-sdk';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import type { State } from '../server/types';
import { enterScore } from '../server/phases/score';
import { MEDIA, standalone, writeFrames } from './screen-evidence';
import type { Frame, Surface } from './screen-evidence';

const fixturesPath = resolve(import.meta.dirname, '../fixtures');
const fixtures = existsSync(fixturesPath)
  ? readdirSync(fixturesPath)
      .filter((name) => name.endsWith('.json'))
      .map((name) => ({
        name: name.replace('.json', ''),
        state: JSON.parse(readFileSync(resolve(fixturesPath, name), 'utf8')) as State,
      }))
  : [];
const cases: Frame[] = [];
const names = [
  'Maximiliano Guadalupe',
  'Alexandria Montgomery',
  'Christopher Alexander',
  'Valentina Rodriguez',
  'Sebastian Washington',
  'Anastasia Wellington',
  'Constantine Benjamin',
  'Penelope Fitzgerald',
];
const longNames = (state: State): State => ({
  ...state,
  players: Object.fromEntries(
    Object.entries(state.players).map(([id, player], index) => [
      id,
      { ...player, name: names[index]! },
    ]),
  ),
});
const play = fixtures.find((fixture) => fixture.name === 'play')?.state;
const done = fixtures.find((fixture) => fixture.name === 'done')?.state;
const score = fixtures.find((fixture) => fixture.name === 'score')?.state;
let skipPending: State | undefined;
if (play) {
  const fresh = game.init({
    players: Object.values(play.players),
    seed: 42,
    settings: { powerups: true },
    now: play.began,
    presence: { mode: 'together', phoneOnly: false },
  });
  let departed = game.reduce(fresh, {
    type: 'player',
    now: play.began,
    playerId: 'p1',
    connected: false,
    gone: 'left',
  });
  departed = game.reduce(departed, { type: 'vip', now: play.began + 2000, action: 'skip' });
  departed = game.reduce(departed, {
    type: 'timer',
    now: departed.phase.deadline!,
    phaseId: departed.phase.id,
    startedAt: departed.phase.startedAt,
  });
  departed = game.reduce(departed, {
    type: 'player',
    now: departed.phase.startedAt + 1,
    playerId: 'p1',
    connected: true,
  });
  fixtures.push({ name: 'ready-gone', state: departed });
  // Born at 720 ms, this shell has advanced nineteen 20 ms samples by 1080 ms.
  // Its next sample reaches the rival before the ordinary 1200 ms timer.
  skipPending = {
    ...longNames(fresh),
    phase: { ...fresh.phase, deadline: play.began + 1200 },
    checked: 1080,
    world: {
      ...fresh.world,
      maze: {
        cols: 10,
        rows: 6,
        cell: 16,
        walls: [
          { x1: 0, y1: 0, x2: 160, y2: 0 },
          { x1: 160, y1: 0, x2: 160, y2: 96 },
          { x1: 0, y1: 96, x2: 160, y2: 96 },
          { x1: 0, y1: 0, x2: 0, y2: 96 },
        ],
      },
      tanks: fresh.world.tanks.map((tank) => ({
        ...tank,
        ...(tank.id === 'p1' ? { x: 24, y: 24, angle: 0, ammo: 4, reloadAt: 1140 } : {}),
        ...(tank.id === 'p2' ? { x: 48, y: 24, angle: Math.PI } : {}),
        alive: tank.id === 'p1' || tank.id === 'p2',
        died: tank.id === 'p1' || tank.id === 'p2' ? null : 700,
      })),
      bullets: [
        {
          id: 1,
          owner: 'p1',
          x: 44.14,
          y: 24,
          vx: 43,
          vy: 0,
          born: 720,
          bounces: 0,
          kind: 'shell',
        },
      ],
      pickups: [],
      stepped: 54,
      nextBullet: 2,
    },
  };
  const skippedWinner = game.reduce(skipPending, {
    type: 'vip',
    now: play.began + 1100,
    action: 'skip',
  });
  fixtures.push({ name: 'score-skip-winner', state: skippedWinner });
  fixtures.push({
    name: 'play-paused',
    state: game.reduce(play, {
      type: 'vip',
      action: 'pause',
      now: Math.max(play.phase.startedAt, play.began + play.checked),
    }),
  });
  fixtures.push({
    name: 'play-active-long',
    state: {
      ...longNames(play),
      world: {
        ...play.world,
        tanks: play.world.tanks.map((tank) => ({ ...tank, alive: true, died: null })),
      },
    },
  });
  fixtures.push({
    name: 'play-eliminated',
    state: {
      ...play,
      world: {
        ...play.world,
        tanks: play.world.tanks.map((tank) =>
          tank.id === 'p1' ? { ...tank, alive: false, died: 2000 } : tank,
        ),
      },
    },
  });
}
if (done)
  fixtures.push({
    name: 'done-tied-long',
    state: {
      ...longNames(done),
      scores: Object.fromEntries(Object.keys(done.players).map((id) => [id, 5])),
      winnerIds: Object.keys(done.players),
    },
  });
if (score) fixtures.push({ name: 'score-long', state: longNames(score) });

function render(state: State, surface: Surface, remote = false): string {
  const phoneOnly = surface === 'phone-only' || surface === 'spectator';
  const stable: State = {
    ...state,
    phoneOnly: phoneOnly ? true : undefined,
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [
        id,
        { ...player, canSeeTv: !(id === 'p1' && remote) },
      ]),
    ),
  };
  const id = surface === 'spectator' ? 'audience' : 'p1';
  const node =
    surface === 'tv' ? (
      <Tv view={{ ...game.tvView(stable), vip: null }} />
    ) : (
      <PhoneOnlyProvider value={phoneOnly || remote}>
        <Controller
          view={{ ...game.controllerView(stable, id), vip: null }}
          me={stable.players[id] ?? { id, name: 'Audience', avatarId: 'ghost' }}
          send={() => undefined}
        />
      </PhoneOnlyProvider>
    );
  const now =
    stable.phase.paused?.at ??
    (stable.phase.id === 'play' ? stable.began + stable.checked : stable.phase.startedAt + 1000);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={now - Date.now()}>{node}</ServerClockProvider>,
  );
}

describe.each(fixtures)('screen: $name', ({ name, state }) => {
  it('renders all four eight-seat surfaces without undefined content or spectator buttons', () => {
    for (const surface of ['tv', 'phone-tv', 'phone-only', 'spectator'] as const) {
      const html = render(state, surface);
      expect(html).not.toMatch(/NaN|undefined|placeholder|Loading/);
      expect(html).toMatch(/<h[23]/);
      if (surface === 'spectator') expect(html).not.toContain('<button');
      if (surface === 'phone-only' || surface === 'spectator') {
        if (state.phase.id !== 'score') expect(html).toContain('<svg');
        expect(html).not.toMatch(/on the TV|Look at the TV|Find your number on the TV/);
      }
      const frame = {
        name: `${name}-${surface}`,
        surface,
        width: surface === 'tv' ? 1920 : 390,
        height: surface === 'tv' ? 1080 : 844,
        html,
      };
      expect(standalone(frame)).not.toContain(':global(');
      cases.push(frame);
    }
  });

  it('finale retains every name, score and tied rank', () => {
    if (state.phase.id !== 'done') return;
    for (const surface of ['tv', 'phone-only', 'spectator'] as const) {
      const html = render(state, surface);
      for (const player of Object.values(state.players)) expect(html).toContain(player.name);
      if (name === 'done-tied-long') expect(html.match(/#1/g)).toHaveLength(8);
    }
  });
});

it('departed seats and spectators watch the next maze without an invented tank or controls', () => {
  const departed = fixtures.find((fixture) => fixture.name === 'ready-gone')?.state;
  expect(departed?.phase.id).toBe('ready');
  if (!departed) return;
  expect(game.controllerView(departed, 'p1').participating).toBe(false);
  for (const surface of ['phone-tv', 'phone-only', 'spectator'] as const) {
    const html = render(departed, surface);
    expect(html).toContain('Spectating');
    expect(html).toContain('<svg');
    expect(html).not.toMatch(/tank 0|Tank 0|Your tank|Find your|<button/);
  }
});

it('compact round receipts show the winner, own gain and current rank within an honest short beat', () => {
  expect(score).toBeDefined();
  if (!score) return;
  for (const reason of [null, 'time', 'draw', 'skip'] as const) {
    const fixture = longNames(score);
    const state = enterScore(
      {
        ...fixture,
        reason,
        world: {
          ...fixture.world,
          tanks: fixture.world.tanks.map((tank) => ({
            ...tank,
            alive: reason === null && tank.id === 'p1',
            died: null,
          })),
        },
      },
      fixture.phase.startedAt,
    );
    const duration = state.phase.deadline! - state.phase.startedAt;
    expect(duration).toBeLessThanOrEqual(11_000);
    for (const surface of ['tv', 'phone-tv', 'phone-only', 'spectator'] as const) {
      const html = render(state, surface);
      const visible = html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
      expect(duration, visible).toBeGreaterThanOrEqual(readingMs(wordCount(visible), { ui: true }));
      if (reason === null) expect(html).toContain(`${names[0]} wins`);
      else expect(html).toContain('No round points');
      if (surface === 'phone-tv' || surface === 'phone-only') {
        const total = state.scores.p1!;
        const rank = 1 + Object.values(state.scores).filter((value) => value > total).length;
        expect(html).toContain(`Your rank #${rank}`);
        expect(html).toContain(`+${state.lastPoints.p1} this round`);
      }
      expect(html).not.toContain('<ol');
    }
  }
});

it('a skip settling an imminent rival hit shows its awarded survivor and budgets the full receipt', () => {
  const state = fixtures.find((fixture) => fixture.name === 'score-skip-winner')?.state;
  expect(state).toBeDefined();
  if (!state) return;
  expect(state.phase.id).toBe('score');
  expect(state.reason).toBe('skip');
  expect(state.winnerIds).toEqual(['p1']);
  expect(state.lastPoints.p1).toBe(1);
  expect(state.scores.p1).toBe(1);
  expect(skipPending?.world.tanks.filter((tank) => tank.alive)).toHaveLength(2);
  expect(state.world.tanks.find((tank) => tank.id === 'p2')?.alive).toBe(false);
  if (skipPending) {
    const ordinary = game.reduce(skipPending, {
      type: 'timer',
      now: skipPending.began + 1200,
      phaseId: 'play',
      startedAt: skipPending.phase.startedAt,
    });
    expect(ordinary.reason).toBe('last-standing');
    expect(ordinary.lastPoints).toEqual(state.lastPoints);
  }
  const duration = state.phase.deadline! - state.phase.startedAt;
  for (const surface of ['tv', 'phone-tv', 'phone-only', 'spectator'] as const) {
    const html = render(state, surface);
    expect(html).toContain(`${names[0]} wins`);
    expect(html).toContain('1 total wins');
    expect(html).not.toContain('No round points');
    if (surface === 'phone-tv' || surface === 'phone-only') {
      expect(html).toContain('Your rank #1');
      expect(html).toContain('+1 this round');
    }
    const visible = html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
    expect(duration, visible).toBeGreaterThanOrEqual(readingMs(wordCount(visible), { ui: true }));
  }
});

it('remote phones render the same public stage and connected living players get five usable pads', () => {
  expect(play).toBeDefined();
  if (!play) return;
  const active: State = {
    ...play,
    world: {
      ...play.world,
      tanks: play.world.tanks.map((tank) => ({ ...tank, alive: true, died: null })),
    },
  };
  const html = render(active, 'phone-tv', true);
  expect(html).toContain('<svg');
  const pads = html.match(/<button\b[^>]*>/g) ?? [];
  expect(pads).toHaveLength(5);
  expect(pads.every((pad) => !pad.includes('disabled'))).toBe(true);
  for (const [paused, connected] of [
    [true, true],
    [false, false],
  ] as const) {
    const state: State = {
      ...active,
      phase: { ...active.phase, ...(paused ? { paused: { at: active.phase.startedAt } } : {}) },
      players: { ...active.players, p1: { ...active.players.p1!, connected } },
    };
    const blocked = render(state, 'phone-only').match(/<button\b[^>]*>/g) ?? [];
    expect(blocked).toHaveLength(5);
    expect(blocked.every((pad) => pad.includes('disabled'))).toBe(true);
  }
});

it('timed textual screens reserve reading time for actual rendered text including long-name standings', () => {
  // Re-enter score/ready with long names so the server sizes the actual timed screen.
  for (const fixture of fixtures.filter(
    (frame) => frame.name === 'score' || frame.name === 'ready',
  )) {
    let state = longNames(fixture.state);
    if (state.phase.id === 'score') {
      const playing: State = {
        ...state,
        phase: { id: 'play', startedAt: state.began, deadline: state.endsAt },
        checked: 0,
        reason: null,
      };
      state = game.reduce(playing, { type: 'vip', now: playing.began, action: 'skip' });
    } else {
      const scoring: State = {
        ...state,
        round: Math.max(1, state.round - 1),
        phase: {
          id: 'score',
          startedAt: state.phase.startedAt,
          deadline: state.phase.startedAt + 1,
        },
      };
      state = game.reduce(scoring, {
        type: 'timer',
        now: scoring.phase.deadline!,
        phaseId: 'score',
        startedAt: scoring.phase.startedAt,
      });
    }
    const duration = state.phase.deadline! - state.phase.startedAt;
    for (const surface of ['tv', 'phone-tv', 'phone-only'] as const) {
      const visible = render(state, surface)
        .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[^;]+;/g, ' ');
      expect(duration, `${state.phase.id}/${surface}: ${visible}`).toBeGreaterThanOrEqual(
        readingMs(wordCount(visible), { ui: true }),
      );
    }
  }
});

it('writes static frames explicitly and validates committed browser fit measurements', () => {
  expect(fixtures.length).toBeGreaterThanOrEqual(5);
  if (process.env.PB_WRITE_EVIDENCE === '1') {
    writeFrames(cases);
    return;
  }
  const path = resolve(MEDIA, 'layout-metrics.json');
  if (!existsSync(path)) return;
  const metrics = JSON.parse(readFileSync(path, 'utf8')) as {
    name: string;
    horizontalOverflow: number;
    verticalOverflow: number;
    clipped: string[];
    unstyled: string[];
    scrollers: { overflow: number }[];
  }[];
  expect(metrics).toHaveLength(cases.length);
  for (const frame of metrics) {
    expect(frame.horizontalOverflow, frame.name).toBeLessThanOrEqual(1);
    expect(frame.verticalOverflow, frame.name).toBeLessThanOrEqual(1);
    expect(frame.clipped, frame.name).toEqual([]);
    expect(frame.unstyled, frame.name).toEqual([]);
    expect(
      frame.scrollers.filter((scroller) => scroller.overflow > 1),
      frame.name,
    ).toEqual([]);
  }
});
