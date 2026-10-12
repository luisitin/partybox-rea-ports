import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import { enterGoal } from '../server/phases/goal';
import type { State } from '../server/types';
import { fixtures } from './fixtures';
import { body, control, copy, timer, T0 } from './helpers';

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
}

describe('actual-components SSR phase and edge evidence', () => {
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
