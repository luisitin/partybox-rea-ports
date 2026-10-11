// Game views are real. Only SDK animation hooks settle instantly so static, unhydrated HTML shows the settled stage.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import type { State } from '../server/types';
import { MEDIA, evidenceCss, standalone, writeEvidence } from './screen-evidence';
import type { EvidenceCase, Surface } from './screen-evidence';

vi.mock('../../../packages/game-sdk/src/ui/motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../packages/game-sdk/src/ui/motion')>();
  return {
    ...actual,
    usePrefersReducedMotion: () => true,
    useBeats: (beats: number[]) => beats.length - 1,
    useCountUp: (target: number) => target,
  };
});

const fixturesDir = resolve(import.meta.dirname, '../fixtures');
const fixtures = readdirSync(fixturesDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => ({
    name: name.replace('.json', ''),
    state: JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf8')) as State,
  }));
const question = fixtures.find((fixture) => fixture.name === 'question')!.state;
const podium = fixtures.find((fixture) => fixture.name === 'podium-2')!.state;
const longNames = (state: State): State => ({
  ...state,
  players: Object.fromEntries(
    Object.entries(state.players).map(([id, player], index) => [
      id,
      {
        ...player,
        name: [
          'Maximiliano Guadalupe',
          'Alexandria Montgomery',
          'Christopher Alexander',
          'Valentina Rodriguez',
          'Sebastian Washington',
          'Anastasia Wellington',
          'Constantine Benjamin',
          'Penelope Fitzgerald',
        ][index]!,
      },
    ]),
  ),
});
const maxContent: State = {
  ...longNames(question),
  deck: [
    {
      ...question.deck[0]!,
      prompt:
        'Which of these four carefully described answers best explains the observable result of this science experiment?'.slice(
          0,
          110,
        ),
      options: [
        'A change in the motion of both objects',
        'A change in the direction of the light',
        'A change in the structure of the material',
        'A change in the pressure inside the vessel',
      ],
      explanation:
        'The evidence supports a change in the structure of the material rather than the three other proposed explanations.',
    },
    ...question.deck.slice(1),
  ],
};
fixtures.push({ name: 'question-max-content', state: maxContent });
fixtures.push({
  name: 'podium-all-tied-long-names',
  state: {
    ...longNames(podium),
    podiumStep: 2,
    scores: Object.fromEntries(Object.keys(podium.players).map((id) => [id, 9999])),
  },
});
const cases: EvidenceCase[] = [];

function render(state: State, surface: Surface): string {
  const phoneOnly = surface === 'phone-only';
  const stable: State = {
    ...state,
    phoneOnly,
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [id, { ...player, canSeeTv: true }]),
    ),
  };
  const time = stable.phase.startedAt + 1000;
  const offset = time - Date.now();
  const id = surface === 'spectator' ? 'audience-seat' : 'p1';
  const node =
    surface === 'tv' ? (
      <Tv view={{ ...game.tvView(stable), vip: null }} />
    ) : (
      <PhoneOnlyProvider value={phoneOnly}>
        <Controller
          view={{ ...game.controllerView(stable, id), vip: null }}
          me={stable.players[id] ?? { id, name: 'Audience', avatarId: 'ghost' }}
          send={() => undefined}
        />
      </PhoneOnlyProvider>
    );
  return renderToStaticMarkup(<ServerClockProvider offsetMs={offset}>{node}</ServerClockProvider>);
}

describe.each(fixtures)('screen fixture: $name', ({ name, state }) => {
  it('renders all four eight-player surfaces with headings and no unfilled content', () => {
    expect(Object.keys(state.players)).toHaveLength(8);
    for (const surface of ['tv', 'phone-tv', 'phone-only', 'spectator'] as const) {
      const html = render(state, surface);
      expect(html).toMatch(/<h[23]/);
      expect(html).not.toMatch(/undefined|NaN|Place 0|placeholder|Loading/);
      const frame = {
        name: `${name}-${surface}`,
        surface,
        width: surface === 'tv' ? 1920 : 390,
        height: surface === 'tv' ? 1080 : 844,
        html,
      };
      expect(standalone(frame)).not.toMatch(/:global\(|\bglobal\(/);
      cases.push(frame);
    }
  });

  it('phone-only and audience screens carry the stage and never send anyone to a TV', () => {
    for (const surface of ['phone-only', 'spectator'] as const) {
      const html = render(state, surface);
      expect(html).not.toMatch(/Look at the TV|on the TV|Find.+TV|One moment/);
      if (surface === 'spectator') expect(html).not.toContain('<button');
      if (state.phase.id === 'question') {
        expect(html).toContain(state.deck[state.round - 1]!.prompt);
        for (const option of state.deck[state.round - 1]!.options) expect(html).toContain(option);
      }
      if (state.phase.id === 'score' || state.phase.id === 'done')
        for (const p of Object.values(state.players)) expect(html).toContain(p.name);
    }
  });

  it('TV-room answer phones show exactly four shapes and never disclose the prompt, options or answer key', () => {
    const html = render(state, 'phone-tv');
    if (state.phase.id === 'question') {
      expect(html.match(/<button/g) ?? []).toHaveLength(4);
      for (const shape of ['Triangle', 'Diamond', 'Circle', 'Square'])
        expect(html).toContain(`aria-label="${shape}"`);
      expect(html).not.toContain(state.deck[state.round - 1]!.prompt);
      for (const option of state.deck[state.round - 1]!.options)
        expect(html).not.toContain(`>${option}<`);
      expect(html).not.toContain('✓ Correct');
    }
    if (state.phase.id === 'reveal') expect(html).toMatch(/Correct!|Not this time|Too slow/);
  });

  it('podium markup names only already revealed ranks, on both stages', () => {
    if (state.phase.id !== 'podium') return;
    const revealed = new Set(game.tvView(state).standings.map((r) => r.id));
    for (const surface of ['tv', 'phone-only', 'spectator'] as const) {
      const html = render(state, surface);
      for (const p of Object.values(state.players)) {
        if (revealed.has(p.id)) expect(html).toContain(p.name);
        else expect(html).not.toMatch(new RegExp(`>${p.name}<`));
      }
    }
  });
});

describe.each([
  {
    name: 'active seat',
    left: false,
    connected: true,
    disabled: false,
    status: 'Tap the matching shape',
  },
  {
    name: 'permanently left seat',
    left: true,
    connected: false,
    disabled: true,
    status: 'Watching the quiz',
  },
  {
    name: 'reconnected left seat',
    left: true,
    connected: true,
    disabled: true,
    status: 'Watching the quiz',
  },
  {
    name: 'temporarily disconnected seat',
    left: false,
    connected: false,
    disabled: true,
    status: 'Disconnected. Waiting to reconnect.',
  },
])('$name', ({ left, connected, disabled, status }) => {
  it('allows answers only for a connected active seat, on both phone layouts', () => {
    const state: State = {
      ...question,
      left: left ? ['p1'] : [],
      players: { ...question.players, p1: { ...question.players.p1!, connected } },
    };
    for (const surface of ['phone-tv', 'phone-only'] as const) {
      const html = render(state, surface);
      const pads = html.match(/<button\b[^>]*>/g) ?? [];
      expect(pads).toHaveLength(4);
      expect(pads.filter((pad) => /\bdisabled=""/.test(pad))).toHaveLength(disabled ? 4 : 0);
      expect(html).toContain(status);
      expect(html).not.toContain('Send again');
    }
  });
});

it('reconstructs every used CSS module instead of pretending the source class names are emitted', () => {
  const css = evidenceCss();
  expect(css).toContain('games/quiz-rush/client/Controller.module.css');
  expect(css).toContain('packages/game-sdk/src/tv/Scoreboard.module.css');
  expect(css).not.toContain(':global(');
  expect(css).not.toContain('global(');
});

it('writes standalone phase evidence only when requested', () => {
  expect(cases).toHaveLength(fixtures.length * 4);
  if (process.env.PB_WRITE_EVIDENCE === '1') writeEvidence(cases);
});

it('recorded headless-browser measurements fit every fixture without scrolling or clipped game content', () => {
  const path = resolve(MEDIA, 'layout-metrics.json');
  if (!existsSync(path) || process.env.PB_WRITE_EVIDENCE === '1') return; // New emission is checked after its browser capture.
  const metrics = JSON.parse(readFileSync(path, 'utf8')) as {
    name: string;
    horizontalOverflow: number;
    verticalOverflow: number;
    scrollers: { overflow: number }[];
    clipped: string[];
    unstyled: string[];
  }[];
  expect(metrics).toHaveLength(fixtures.length * 4);
  for (const frame of metrics) {
    expect(frame.horizontalOverflow, frame.name).toBeLessThanOrEqual(1);
    expect(frame.verticalOverflow, frame.name).toBeLessThanOrEqual(1);
    expect(
      frame.scrollers.filter((s) => s.overflow > 1),
      frame.name,
    ).toEqual([]);
    expect(frame.clipped, frame.name).toEqual([]);
    expect(frame.unstyled, frame.name).toEqual([]);
  }
});
