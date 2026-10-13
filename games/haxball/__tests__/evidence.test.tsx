import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import { enterGoal } from '../server/phases/goal';
import { BALL_R, H, W } from '../server/types';
import type { State, Team } from '../server/types';
import { fixtures } from './fixtures';
import { body, control, copy, start, timer, T0 } from './helpers';

// Vitest's node CSS stubs do not carry generated selectors. Give each actual
// module a deterministic namespace, then export its actual CSS with that same map.
// No substitute component or hand-recreated stylesheet participates in evidence.
const { cssModules } = await vi.hoisted(async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const files = {
    controller: 'games/haxball/client/Controller.module.css',
    tv: 'games/haxball/client/Tv.module.css',
    match: 'games/haxball/client/MatchStage.module.css',
    pitch: 'games/haxball/client/Pitch.module.css',
    stage: 'packages/game-sdk/src/tv/Stage.module.css',
  };
  const cssModules = Object.fromEntries(
    Object.entries(files).map(([key, file]) => {
      const css = readFileSync(resolve(process.cwd(), file), 'utf8');
      const names = [...new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]!))];
      const mapping = Object.fromEntries(names.map((name) => [name, `hax-${key}-${name}`]));
      return [key, { file, css, mapping }];
    }),
  );
  return { cssModules };
});
vi.mock('../client/Controller.module.css', () => ({ default: cssModules['controller']!.mapping }));
vi.mock('../client/Tv.module.css', () => ({ default: cssModules['tv']!.mapping }));
vi.mock('../client/MatchStage.module.css', () => ({ default: cssModules['match']!.mapping }));
vi.mock('../client/Pitch.module.css', () => ({ default: cssModules['pitch']!.mapping }));
vi.mock('../../../packages/game-sdk/src/tv/Stage.module.css', () => ({
  default: cssModules['stage']!.mapping,
}));

const media = fileURLToPath(new URL('../../../jobs/P24-haxball/media/', import.meta.url));
const fixtureFolder = fileURLToPath(new URL('../fixtures/', import.meta.url));
const samples = fixtures();
const tokens = readFileSync(
  fileURLToPath(new URL('../../../design/tokens.css', import.meta.url)),
  'utf8',
);
const css = Object.values(cssModules)
  .map((module) =>
    module.css
      .replace(/:global\(([^()]*)\)/g, '$1')
      .replace(/\.([A-Za-z_][\w-]*)/g, (whole: string, name: string) =>
        module.mapping[name] ? `.${module.mapping[name]}` : whole,
      ),
  )
  .join('\n');
interface ScreenRecord {
  file: string;
  fixture: string;
  surface: 'tv' | 'controller';
  phoneOnly: boolean;
  viewer: string;
  width: number;
  height: number;
  bytes: number;
}
const records: ScreenRecord[] = [];

// Only boundary positioning is controlled. Goals, pauses, resets and horn exits
// are judged by the real reducer; both mounted surfaces receive its public views.
function goalPosition(state: State, team: Team, distance = 0.5): State {
  const right = (team === 'red') === state.redAttacksRight;
  const scorer = state.discs.find((disc) => disc.team === team)!;
  return {
    ...copy(state),
    ball: body(right ? W + BALL_R - distance : -BALL_R + distance, H / 2, right ? 40 : -40),
    discs: state.discs.map((disc, i) => ({ ...disc, x: 30 + i * 12, y: 15, vx: 0, vy: 0 })),
    lastTouch: scorer.id,
  };
}
function audioFixtures(): Record<string, State> {
  const zero = start();
  const red = timer(goalPosition(zero, 'red'), T0 + 100);
  const paused = game.reduce(red, { type: 'vip', now: red.clock + 100, action: 'pause' });
  const resumed = game.reduce(paused, { type: 'vip', now: paused.clock + 500, action: 'resume' });
  const redPlay = timer(resumed);
  const blue = timer(goalPosition(redPlay, 'blue'), redPlay.clock + 100);
  const bluePlay = timer(blue);
  const redNew = timer(goalPosition(bluePlay, 'red'), bluePlay.clock + 100);
  // Two fixed steps place the crossing exactly at the horn. No goal beat may
  // extend either half, so the public phase is halftime/done at this score rise.
  const firstLate = timer(zero, zero.halfEndsAt - 100);
  const cap = timer(goalPosition(firstLate, 'red', 2.5), firstLate.halfEndsAt);
  const second = timer(timer(zero, zero.halfEndsAt));
  const secondLate = timer(second, second.halfEndsAt - 100);
  const done = timer(goalPosition(secondLate, 'red', 2.5), secondLate.halfEndsAt);
  const delayed = timer(goalPosition(zero, 'red'), T0 + 4000);
  return {
    'audio-zero': zero,
    'audio-red': red,
    'audio-red-paused': paused,
    'audio-red-resumed': resumed,
    'audio-blue': blue,
    'audio-reset': start(8, 2),
    'audio-red-cap': cap,
    'audio-red-done': done,
    'audio-red-delayed': delayed,
    'audio-red-new': redNew,
  };
}
const audioSamples = audioFixtures();

function render(
  state: State,
  surface: 'tv' | 'controller',
  phoneOnly = false,
  viewer = 'p1',
): string {
  const children =
    surface === 'tv' ? (
      <Tv view={{ ...game.tvView(state), vip: null }} />
    ) : (
      <PhoneOnlyProvider value={phoneOnly}>
        <Controller
          view={{ ...game.controllerView(state, viewer), vip: null }}
          send={() => undefined}
          me={state.players[viewer] ?? { id: viewer, name: '', avatarId: 'fox' }}
        />
      </PhoneOnlyProvider>
    );
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={state.clock - Date.now()}>{children}</ServerClockProvider>,
  );
}
function page(markup: string, surface: 'tv' | 'controller', width: number, height: number): string {
  return `<!doctype html><html lang="en" data-surface="${surface}" data-motion="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Haxball ${surface} evidence</title><style>${tokens}\n${css}\n*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}body{width:${width}px;height:${height}px}main{width:100%;height:100%;min-height:0}</style></head><body><main data-evidence-surface="${surface}">${markup}</main></body></html>\n`;
}
function writePublicInteractions(): void {
  const play = samples['play']!;
  const positioned: State = {
    ...copy(play),
    ball: body(67, 50),
    discs: play.discs.map((disc, i) => ({
      ...disc,
      x: disc.id === 'p1' ? 60 : 15 + i * 14,
      y: disc.id === 'p1' ? 50 : 15,
      vx: 0,
      vy: 0,
    })),
  };
  const armed = control(positioned, 'p1', { kick: true });
  const kicked = control(armed, 'p1', { kick: true }, T0 + 50);
  const released = control(kicked, 'p1', { kick: false }, T0 + 350);
  const me = released.discs.find((disc) => disc.id === 'p1')!;
  const nearAgain = { ...released, ball: body(me.x + 7, me.y) };
  const rearmed = control(nearAgain, 'p1', { kick: true }, T0 + 350);
  const kickedNew = control(rearmed, 'p1', { kick: true }, T0 + 400);
  const accepted = control(play, 'p1', { seq: 90 }, T0 + 10);
  const goal = enterGoal(kicked, { team: 'red', scorerId: 'p1', ownGoal: false }, T0 + 1000);
  const nextPlay = timer(goal);
  const second = timer(samples['halftime']!);
  const states: Record<string, State> = {
    play,
    armed,
    kicked,
    'kick-fired': kicked,
    'kick-fired-new': kickedNew,
    accepted,
    goal,
    'next-play': nextPlay,
    halftime: samples['halftime']!,
    'second-half': second,
    paused: samples['play-paused']!,
    departed: samples['play-left']!,
    spectator: play,
    done: samples['done']!,
    'play-last-goal': samples['play-last-goal']!,
    'play-last-own-long': samples['play-last-own-long']!,
    'halftime-last-own-long': samples['halftime-last-own-long']!,
    'done-last-own-long': samples['done-last-own-long']!,
    ...audioSamples,
  };
  const views = Object.fromEntries(
    Object.entries(states).map(([key, state]) => [
      key,
      { ...game.controllerView(state, key === 'spectator' ? 'spectator' : 'p1'), vip: null },
    ]),
  );
  for (const view of Object.values(views)) {
    expect(JSON.stringify(view)).not.toContain('"intents"');
    expect(JSON.stringify(view)).not.toContain('"until"');
  }
  expect(views['armed']?.kickArmed).toBe(true);
  expect(views['kick-fired']?.lastKickAt).toBe(T0 + 50);
  expect(views['kick-fired-new']?.lastKickAt).toBe(T0 + 400);
  writeFileSync(`${media}/interaction-views.json`, `${JSON.stringify(views, null, 2)}\n`, 'utf8');
  const tvViews = Object.fromEntries(
    Object.entries(states).map(([key, state]) => [key, { ...game.tvView(state), vip: null }]),
  );
  writeFileSync(
    `${media}/interaction-tv-views.json`,
    `${JSON.stringify(tvViews, null, 2)}\n`,
    'utf8',
  );
}

describe('actual-components SSR phase and edge evidence', () => {
  it('retains reducer-scored last-goal identity through play, halftime and done without extending the half', () => {
    const ordinary = samples['play-last-goal']!;
    const ownLong = samples['play-last-own-long']!;
    expect(ordinary.phase.id).toBe('play');
    expect(ordinary.goals).toEqual({ red: 1, blue: 0 });
    expect(ordinary.lastGoal?.ownGoal).toBe(false);
    expect(ordinary.halfEndsAt).toBe(samples['play']!.halfEndsAt);
    const ordinaryScorer = game
      .tvView(ordinary)
      .discs.find((disc) => disc.id === ordinary.lastGoal!.scorerId)!;
    const ordinaryMarkup = render(ordinary, 'tv');
    const ordinaryCredit =
      ordinaryMarkup.match(
        /<(?:p|h2)\b[^>]*data-hax-goal-credit="true"[^>]*>[\s\S]*?<\/(?:p|h2)>/,
      )?.[0] ?? '';
    expect(ordinaryCredit).toContain('Last goal:');
    expect(ordinaryCredit).toContain(ordinaryScorer.name);
    expect(ownLong.phase.id).toBe('play');
    expect(ownLong.halfEndsAt).toBe(samples['play']!.halfEndsAt);
    expect(ownLong.lastGoal?.scorerId).toBe('p1');
    expect(ownLong.lastGoal?.ownGoal).toBe(true);
    for (const key of ['play-last-own-long', 'halftime-last-own-long', 'done-last-own-long']) {
      const state = samples[key]!;
      const view = game.controllerView(state, 'p1');
      expect(view.lastGoal, key).toEqual(game.controllerView(ownLong, 'p1').lastGoal);
      expect(view.discs.find((disc) => disc.id === 'p1')?.name, key).toBe('W'.repeat(64));
      expect(state.goals, key).toEqual(ownLong.goals);
      const scorer = view.discs.find((disc) => disc.id === view.lastGoal!.scorerId)!;
      const jersey = `${scorer.team === 'red' ? 'R' : 'B'}${scorer.number}`;
      const markups = [render(state, 'tv')];
      for (const phoneOnly of [false, true])
        for (const viewer of ['p1', 'spectator']) {
          const markup = render(state, 'controller', phoneOnly, viewer);
          if (state.phase.id === 'play' && !phoneOnly && viewer === 'p1') {
            // The TV owns retained credit in this mode; keep the active phone's
            // score and controls available without another field or text row.
            expect((markup.match(/data-hax-control=/g) ?? []).length, key).toBe(9);
            expect(markup, key).not.toContain('data-haxball-pitch="true"');
            expect(markup, key).not.toContain('data-hax-goal-credit="true"');
          } else markups.push(markup);
        }
      for (const markup of markups) {
        const credit =
          markup.match(
            /<(?:p|h2)\b[^>]*data-hax-goal-credit="true"[^>]*>[\s\S]*?<\/(?:p|h2)>/,
          )?.[0] ?? '';
        expect(credit.replace(/<[^>]*>/g, ''), key).toContain(`Last goal: Own goal by ${jersey}`);
        expect(credit, key).toMatch(/aria-label="[^"]*Own goal by [^"]*W{64}[^"]*"/);
      }
    }
    expect(samples['halftime-last-own-long']!.phase.id).toBe('halftime');
    expect(samples['halftime-last-own-long']!.phase.startedAt).toBe(ownLong.halfEndsAt);
    expect(samples['done-last-own-long']!.phase.id).toBe('done');
    expect(samples['done-last-own-long']!.clock - samples['play']!.clock).toBe(188_000);
  });

  it('projects real red/blue goals and horn/delayed score rises without private input or kick cues', () => {
    const scores = {
      'audio-zero': [0, 0],
      'audio-red': [1, 0],
      'audio-red-paused': [1, 0],
      'audio-red-resumed': [1, 0],
      'audio-blue': [1, 1],
      'audio-reset': [0, 0],
      'audio-red-cap': [1, 0],
      'audio-red-done': [1, 0],
      'audio-red-delayed': [1, 0],
      'audio-red-new': [2, 1],
    };
    for (const [key, state] of Object.entries(audioSamples)) {
      const tv = game.tvView(state);
      const controller = game.controllerView(state, 'p1');
      expect([tv.goals.red, tv.goals.blue], key).toEqual(scores[key as keyof typeof scores]);
      expect(controller.goals, key).toEqual(tv.goals);
      expect(controller.lastKickAt, key).toBeNull();
      for (const view of [tv, controller]) {
        expect(JSON.stringify(view), key).not.toMatch(/"(?:intents|until|lastTouch)"/);
      }
      expect(render(state, 'tv'), key).toContain('data-haxball-pitch="true"');
    }
    expect(audioSamples['audio-red']!.phase.id).toBe('goal');
    expect(audioSamples['audio-blue']!.phase.id).toBe('goal');
    expect(audioSamples['audio-red-paused']!.phase.paused).toBeTruthy();
    expect(audioSamples['audio-red-resumed']!.phase.paused).toBeFalsy();
    expect(audioSamples['audio-red-cap']!.phase.id).toBe('halftime');
    expect(audioSamples['audio-red-cap']!.phase.startedAt).toBe(
      audioSamples['audio-zero']!.halfEndsAt,
    );
    expect(audioSamples['audio-red-done']!.phase.id).toBe('done');
    expect(audioSamples['audio-red-done']!.phase.startedAt).toBe(
      audioSamples['audio-red-done']!.halfEndsAt,
    );
    expect(audioSamples['audio-red-delayed']!.phase.id).toBe('play');
    expect(audioSamples['audio-red-delayed']!.clock).toBe(T0 + 4000);
  });

  it.each(Object.keys(samples))(
    'renders%s for1920×1080 TV and390×844 active/spectator phones with actual CSS/token maps',
    (name) => {
      const state = samples[name]!;
      const tv = render(state, 'tv');
      expect(tv).toContain('data-haxball-pitch="true"');
      expect(tv).toContain('data-haxball-stage="true"');
      expect(tv).toContain('hax-tv-stage');
      expect(tv).not.toContain('undefined');
      const screens: {
        file: string;
        markup: string;
        surface: 'tv' | 'controller';
        phoneOnly: boolean;
        viewer: string;
      }[] = [
        { file: `tv-${name}.html`, markup: tv, surface: 'tv', phoneOnly: false, viewer: 'tv' },
      ];
      for (const phoneOnly of [false, true])
        for (const viewer of ['p1', 'spectator']) {
          const markup = render(state, 'controller', phoneOnly, viewer);
          const active =
            state.phase.id === 'play' &&
            !state.phase.paused &&
            viewer === 'p1' &&
            !state.left.includes(viewer);
          expect((markup.match(/data-hax-control=/g) ?? []).length).toBe(active ? 9 : 0);
          expect(markup).toContain('hax-controller-screen');
          expect(markup).not.toContain('undefined');
          if (phoneOnly || !active) expect(markup).toContain('data-haxball-pitch="true"');
          if (phoneOnly) expect(markup).not.toMatch(/(?:look at|find.*on|watch.*on) the TV/i);
          if (viewer === 'spectator') expect(markup).toContain('Watching Haxball');
          if (state.left.includes(viewer)) expect(markup).toContain('you left the match');
          screens.push({
            file: `phone-${name}-${phoneOnly ? 'only' : 'tv'}-${viewer}.html`,
            markup,
            surface: 'controller',
            phoneOnly,
            viewer,
          });
        }
      if (process.env['PB_WRITE_EVIDENCE'] === '1') {
        mkdirSync(media, { recursive: true });
        mkdirSync(fixtureFolder, { recursive: true });
        writeFileSync(
          `${fixtureFolder}/${name}.json`,
          `${JSON.stringify(state, null, 2)}\n`,
          'utf8',
        );
        for (const screen of screens) {
          const width = screen.surface === 'tv' ? 1920 : 390;
          const height = screen.surface === 'tv' ? 1080 : 844;
          const html = page(screen.markup, screen.surface, width, height);
          writeFileSync(`${media}/${screen.file}`, html, 'utf8');
          records.push({
            file: screen.file,
            fixture: name,
            surface: screen.surface,
            phoneOnly: screen.phoneOnly,
            viewer: screen.viewer,
            width,
            height,
            bytes: Buffer.byteLength(html),
          });
        }
        writePublicInteractions();
        writeFileSync(
          `${media}/screens.json`,
          `${JSON.stringify(
            {
              method:
                'react-dom/server; actual components, actual module CSS with matching namespaces, design/tokens.css; frozen server-time offset',
              cssSources: Object.values(cssModules).map((module) => module.file),
              screens: records,
            },
            null,
            2,
          )}\n`,
          'utf8',
        );
      }
    },
  );
});
