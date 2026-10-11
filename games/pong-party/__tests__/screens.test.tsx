import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { loadGame } from '@partybox/game-sdk/testing';
import { Controller } from '../client/Controller';
import controllerStyles from '../client/Controller.module.css';
import arenaStyles from '../client/Arena.module.css';
import edgeGuideStyles from '../client/EdgeGuide.module.css';
import { Tv } from '../client/Tv';
import tvStyles from '../client/Tv.module.css';
import stageStyles from '../../../packages/game-sdk/src/tv/Stage.module.css';
import { game } from '../server/index';
import type { State } from '../server/types';

function moduleCss(file: string, names: Record<string, string>): string {
  let css = readFileSync(resolve(file), 'utf8');
  for (const [local, generated] of Object.entries(names))
    css = css.replace(new RegExp(`\\.${local}(?![-_a-zA-Z0-9])`, 'g'), `.${generated}`);
  return css;
}

it('screens: exports every phase through real React SSR at TV and phone viewports', async () => {
  const loaded = await loadGame('pong-party');
  const css = [
    readFileSync(resolve('design/tokens.css'), 'utf8'),
    '*{box-sizing:border-box}html,body,#app{margin:0;width:100%;height:100%;overflow:hidden}body{background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}',
    moduleCss('packages/game-sdk/src/tv/Stage.module.css', stageStyles),
    moduleCss('games/pong-party/client/Tv.module.css', tvStyles),
    moduleCss('games/pong-party/client/Controller.module.css', controllerStyles),
    moduleCss('games/pong-party/client/Arena.module.css', arenaStyles),
    moduleCss('games/pong-party/client/EdgeGuide.module.css', edgeGuideStyles),
  ].join('\n');
  const directory = resolve('jobs/P21-pong-party/media');
  mkdirSync(directory, { recursive: true });
  const report: {
    file: string;
    phase: string;
    width: number;
    height: number;
    surface: string;
    phoneOnly: boolean;
    spectator: boolean;
    bytes: number;
  }[] = [];
  for (const phase of game.phases) {
    const state = loaded.fixtures[phase] as State;
    for (const variant of [
      { name: 'tv', tv: true, phoneOnly: false, spectator: false },
      { name: 'phone-tv', tv: false, phoneOnly: false, spectator: false },
      { name: 'phone-only', tv: false, phoneOnly: true, spectator: false },
      { name: 'spectator-tv', tv: false, phoneOnly: false, spectator: true },
      { name: 'spectator-only', tv: false, phoneOnly: true, spectator: true },
    ]) {
      const width = variant.tv ? 1920 : 390;
      const height = variant.tv ? 1080 : 844;
      const id = variant.spectator ? 'spectator-x' : 'p1';
      const element = variant.tv ? (
        <Tv view={{ ...game.tvView(state), vip: null }} />
      ) : (
        <PhoneOnlyProvider value={variant.phoneOnly}>
          <Controller
            view={{ ...game.controllerView(state, id), vip: null }}
            me={state.players[id] ?? { id, name: 'Spectator', avatarId: 'fox', connected: true }}
            send={() => undefined}
          />
        </PhoneOnlyProvider>
      );
      const markup = renderToStaticMarkup(
        <ServerClockProvider offsetMs={state.began + state.checked - Date.now()}>
          {element}
        </ServerClockProvider>,
      );
      const file = `${phase}-${variant.name}.html`;
      const surface = variant.tv ? 'tv' : 'phone';
      const html = `<!doctype html><html lang="en" data-surface="${surface}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Octo Rally ${phase} ${variant.name}</title><style>${css}</style></head><body><main id="app" data-surface="${surface}">${markup}</main></body></html>\n`;
      if (variant.tv || variant.phoneOnly || variant.spectator || phase !== 'play')
        expect(html).toContain('<svg');
      if (variant.phoneOnly || variant.spectator) expect(markup).not.toContain('on the TV');
      writeFileSync(resolve(directory, file), html, 'utf8');
      report.push({
        file,
        phase,
        width,
        height,
        surface,
        phoneOnly: variant.phoneOnly,
        spectator: variant.spectator,
        bytes: Buffer.byteLength(html),
      });
    }
  }
  expect(report).toHaveLength(15);
  expect(report.reduce((sum, file) => sum + file.bytes, 0)).toBeLessThan(10 * 1024 * 1024);
  writeFileSync(
    resolve('jobs/P21-pong-party/screens.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
});
