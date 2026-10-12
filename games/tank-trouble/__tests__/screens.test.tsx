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
if (play) {
  fixtures.push({
    name: 'play-paused',
    state: { ...play, phase: { ...play.phase, paused: { at: play.phase.startedAt } } },
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
  const now = stable.phase.paused?.at ?? stable.phase.startedAt + 1000;
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
