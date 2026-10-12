// Real played states; only animation hooks settle immediately for standalone SSR evidence.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import { questionSchema } from '../content/schema';
import type { QuizMode, State } from '../server/types';
import { MEDIA, SURFACES, evidenceCss, standalone, writeEvidence } from './team-screen-evidence';
import type { EvidenceCase, StateFixture, Surface } from './team-screen-evidence';

vi.mock('../../../packages/game-sdk/src/ui/motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../packages/game-sdk/src/ui/motion')>();
  return {
    ...actual,
    usePrefersReducedMotion: () => true,
    useBeats: (beats: number[]) => beats.length - 1,
    useCountUp: (target: number) => target,
  };
});

const NAMES = [
  'Maximiliano Guadalupe',
  'Alexandria Montgomery',
  'Christopher Alexander',
  'Valentina Rodriguez',
  'Sebastian Washington',
  'Anastasia Wellington',
  'Constantine Benjamin',
  'Penelope Fitzgerald',
];
const MODES: QuizMode[] = ['solo', 'teams', 'tv-vote'];
const MAX_QUESTION = questionSchema.parse({
  id: 'layout-maximum',
  prompt:
    'Which carefully described answer best explains the observable result of this science experiment?'.padEnd(
      110,
      '?',
    ),
  options: [
    'Both objects change their speed together',
    'The light changes direction after contact',
    'The material changes its internal texture',
    'Pressure changes inside the sealed vessel',
  ].map((option) => option.padEnd(42, '.')),
  correct: 2,
  explanation:
    'The evidence shows a change in the material structure instead of changes in light, speed, or internal pressure.'.padEnd(
      120,
      '.',
    ),
  difficulty: 3,
});

function played(mode: QuizMode, teamCount = 4, maximum = false): StateFixture[] {
  const kit = testKit(game, {
    players: testPlayers(8, maximum ? { names: NAMES } : {}),
    seed: 19,
    settings: {
      mode,
      pack: mode === 'teams' ? 'sports' : mode === 'tv-vote' ? 'music' : 'general',
      rounds: 5,
      teamCount,
      seconds: 30,
      talkSeconds: 20,
    },
  });
  let state = kit.start();
  // Explicit layout-only payload fixture, never a fabricated phase. All later transitions are SDK events.
  if (maximum)
    state = {
      ...state,
      deck: state.deck.map((question, index) =>
        index === 0 ? { ...MAX_QUESTION, id: question.id } : question,
      ),
    };
  const saved = new Map<string, State>();
  for (let step = 0; step < 100 && state.phase.id !== 'done'; step++) {
    if (!saved.has(state.phase.id) || state.phase.id === 'podium') saved.set(state.phase.id, state);
    if (state.phase.id === 'reveal' && state.round === state.deck.length)
      saved.set('reveal-last', state);
    if (state.phase.id === 'podium') saved.set(`podium-${state.podiumStep}`, state);
    if (state.phase.id === 'question') {
      const at = state.openedAt;
      for (let seat = 0; seat < 8 && state.phase.id === 'question'; seat++) {
        const id = `p${seat + 1}`;
        const teamIndex = state.teams.findIndex((team) => team.members.includes(id));
        const correct = state.deck[state.round - 1]!.correct;
        const right =
          mode === 'tv-vote'
            ? seat < 4
            : mode === 'teams'
              ? state.round <= [5, 4, 2, 1][teamIndex]!
              : seat < 3 || (seat + state.round) % 3 === 0;
        state = kit.input(
          state,
          id,
          {
            type: 'answer',
            round: state.round,
            choice: right ? correct : (correct + 1 + (seat % 2)) % 4,
          },
          at + 300 + (seat + 1) * 400,
        );
      }
    } else state = kit.timer(state);
  }
  if (state.phase.id !== 'done') throw new Error(`Screen fixture did not terminate: ${mode}`);
  saved.set('done', state);
  return [...saved].map(([name, state]) => ({ name, state }));
}

const canonical = MODES.flatMap((mode) => played(mode));
const mainFixtures = canonical.filter(({ name }) =>
  ['talk', 'question', 'reveal', 'score', 'podium', 'done'].includes(name),
);
const worstFixtures = [2, 4].flatMap((count) =>
  played('teams', count, true)
    .filter(({ name }) => ['talk', 'question', 'reveal'].includes(name))
    .map(({ name, state }) => ({ name: `maximum-teams-${count}-${name}`, state })),
);
const cases: EvidenceCase[] = [];

function render(state: State, surface: Surface): string {
  const phoneOnly = surface === 'phone-only';
  const stable = { ...state, phoneOnly };
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
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={stable.phase.startedAt + 1000 - Date.now()}>
      {node}
    </ServerClockProvider>,
  );
}

function frame(name: string, state: State, surface: Surface): EvidenceCase {
  return {
    name: `${name}-${surface}`,
    surface,
    width: surface === 'tv' ? 1920 : 390,
    height: surface === 'tv' ? 1080 : 844,
    html: render(state, surface),
  };
}

function escaped(text: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[&<>"']/g, (character) => entities[character]!);
}

describe.each([
  ...mainFixtures.map(({ name, state }) => ({
    name: `${state.settings.mode}-${name}`,
    state,
  })),
  ...worstFixtures,
])('P02 screen $name', ({ name, state }) => {
  it('renders all four surfaces with headings, content and the correct actionable controls', () => {
    expect(Object.keys(state.players)).toHaveLength(8);
    for (const surface of SURFACES) {
      const screen = frame(name, state, surface);
      const html = screen.html;
      expect(html).toMatch(/<h[23]/);
      expect(html).not.toMatch(/undefined|NaN|Place 0|placeholder|Loading/);
      expect(standalone(screen)).not.toMatch(/:global\(|\bglobal\(/);
      if (surface === 'spectator' || state.phase.id === 'talk')
        expect(html).not.toContain('<button');
      if (surface === 'phone-only' || surface === 'spectator')
        expect(html).not.toMatch(/Look at the TV|on the TV|Find.+TV|One moment/);
      if (state.phase.id === 'talk' || (state.phase.id === 'question' && surface !== 'phone-tv')) {
        const question = state.deck[state.round - 1]!;
        expect(html).toContain(escaped(question.prompt));
        for (const option of question.options) expect(html).toContain(escaped(option));
      }
      if (state.phase.id === 'question' && ['phone-tv', 'phone-only'].includes(surface)) {
        expect(html.match(/<button\b/g) ?? []).toHaveLength(4);
        expect(html.match(/disabled=""/g) ?? []).toHaveLength(0);
      }
      if (state.phase.id === 'talk') expect(html).toMatch(/Discuss|discussion/);
      cases.push(screen);
    }
  });

  it('TV-room answer phones keep four public shapes and private keys stay hidden', () => {
    if (state.phase.id !== 'question') return;
    const html = render(state, 'phone-tv');
    const question = state.deck[state.round - 1]!;
    for (const shape of ['Triangle', 'Diamond', 'Circle', 'Square'])
      expect(html).toContain(`aria-label="${shape}"`);
    expect(html).not.toContain(escaped(question.prompt));
    expect(html).not.toContain(escaped(question.explanation));
    for (const option of question.options) expect(html).not.toContain(`>${escaped(option)}<`);
    expect(game.tvView(state).reveal).toBeNull();
    expect(game.tvView(state).decision).toBeNull();
  });

  it('group receipts report the credited group and its visible rank', () => {
    if (state.settings.mode === 'solo' || state.phase.id !== 'reveal') return;
    const view = game.controllerView(state, 'p1');
    for (const surface of ['phone-tv', 'phone-only'] as const) {
      const html = render(state, surface);
      expect(html).toContain(`${view.team!.name}: +${view.team!.gained} team points`);
      expect(html).toContain(`${view.team!.score} total`);
      if (view.rank > 0) expect(html).toContain(`Team place ${view.rank}`);
      if (state.settings.mode === 'tv-vote') expect(html).toContain('Room chose');
      else expect(html).toContain(`Your answer earned ${view.verdict!.points} points`);
    }
  });
});

it('captures exactly 68 canonical phase/surface pairs and 24 maximum team layouts', () => {
  expect(mainFixtures).toHaveLength(17);
  expect(mainFixtures.filter(({ state }) => state.settings.mode === 'solo')).toHaveLength(5);
  expect(worstFixtures).toHaveLength(6);
  expect(cases).toHaveLength(92);
  expect(new Set(cases.map((screen) => screen.name)).size).toBe(cases.length);
  for (const mode of MODES) {
    const fixtures = canonical.filter(({ state }) => state.settings.mode === mode);
    expect(fixtures.map(({ name }) => name)).toEqual(
      expect.arrayContaining(
        mode === 'solo'
          ? [
              'question',
              'reveal',
              'reveal-last',
              'score',
              'podium-0',
              'podium-1',
              'podium-2',
              'done',
            ]
          : ['talk', 'question', 'reveal', 'reveal-last', 'score', 'podium', 'done'],
      ),
    );
  }
  expect(MAX_QUESTION.prompt).toHaveLength(110);
  expect(MAX_QUESTION.options.every((option) => option.length === 42)).toBe(true);
  expect(MAX_QUESTION.explanation).toHaveLength(120);
});

it('locked real answers disable all four pads on both player phone layouts', () => {
  for (const mode of MODES) {
    const state = mainFixtures.find(
      (fixture) => fixture.state.settings.mode === mode && fixture.name === 'question',
    )!.state;
    const locked = game.reduce(state, {
      type: 'input',
      playerId: 'p1',
      now: state.openedAt + 1000,
      input: { type: 'answer', round: state.round, choice: 0 },
    });
    for (const surface of ['phone-tv', 'phone-only'] as const) {
      const html = render(locked, surface);
      expect(html.match(/<button\b/g) ?? []).toHaveLength(4);
      expect(html.match(/disabled=""/g) ?? []).toHaveLength(4);
      expect(html).toMatch(/Answer locked in|Vote locked in/);
      expect(html).not.toContain(escaped(state.deck[state.round - 1]!.explanation));
    }
  }
});

it('podium stages contain only names whose ranks the real timer has revealed', () => {
  for (const { state } of canonical.filter(({ name }) => name.startsWith('podium-'))) {
    const visible = new Set(game.tvView(state).standings.map((row) => row.id));
    const names =
      state.settings.mode === 'solo'
        ? Object.values(state.players).map((player) => ({ id: player.id, name: player.name }))
        : state.teams;
    for (const surface of ['tv', 'phone-only', 'spectator'] as const) {
      const html = render(state, surface);
      for (const entry of names) {
        if (visible.has(entry.id)) expect(html).toContain(entry.name);
        else expect(html).not.toContain(`>${entry.name}<`);
      }
    }
  }
});

it('reconstructs team CSS and writes only opt-in P02 evidence/current canonical fixtures', () => {
  const css = evidenceCss();
  expect(css).toContain('games/kahoot/client/Teams.module.css');
  expect(css).not.toMatch(/:global\(|\bglobal\(/);
  if (process.env.WRITE_P02_EVIDENCE === '1') writeEvidence(cases, canonical);
});

it('recorded P02 browser measurements cover every captured frame without clipping', () => {
  const path = resolve(MEDIA, 'layout-metrics.json');
  if (!existsSync(path) || process.env.WRITE_P02_EVIDENCE === '1') return;
  const rows = JSON.parse(readFileSync(path, 'utf8')) as {
    name: string;
    horizontalOverflow: number;
    verticalOverflow: number;
    clipped: string[];
    unstyled: string[];
    scrollers: { overflow: number }[];
  }[];
  expect(rows.map((row) => row.name).sort()).toEqual(cases.map((screen) => screen.name).sort());
  for (const row of rows) {
    expect(row.horizontalOverflow, row.name).toBeLessThanOrEqual(1);
    expect(row.verticalOverflow, row.name).toBeLessThanOrEqual(1);
    expect(row.clipped, row.name).toEqual([]);
    expect(row.unstyled, row.name).toEqual([]);
    expect(
      row.scrollers.filter((scroll) => scroll.overflow > 1),
      row.name,
    ).toEqual([]);
  }
});
