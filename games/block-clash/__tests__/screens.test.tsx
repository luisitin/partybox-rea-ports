// Every fixture is rendered as a complete, offline page for manual layout review.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { game } from '../server/index';
import type { State } from '../server/types';
import { Tv } from '../client/Tv';
import { Controller } from '../client/Controller';
import tvCss from '../client/Tv.module.css';
import phoneCss from '../client/Controller.module.css';
import boardCss from '../client/Board.module.css';

const root = resolve(import.meta.dirname, '../../..');
const media = resolve(root, 'jobs/P11-tetris-clash/media');
const localCss = [
  ['Tv', tvCss],
  ['Controller', phoneCss],
  ['Board', boardCss],
] as const;
function style(): string {
  return (
    readFileSync(resolve(root, 'design/tokens.css'), 'utf8').replace(/[ \t]+$/gm, '') +
    localCss
      .map(([name, names]) =>
        readFileSync(resolve(root, `games/block-clash/client/${name}.module.css`), 'utf8').replace(
          /\.([a-zA-Z][a-zA-Z0-9]*)/g,
          (match, key: string) => (names[key] ? `.${names[key]}` : match),
        ),
      )
      .join('\n')
  );
}
function page(content: string, surface: string): string {
  return `<!doctype html><html lang="en" data-surface="${surface}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Block Clash phase capture</title><style>${style()}
*{box-sizing:border-box}body{margin:0;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}#app{height:100dvh;overflow:hidden}#app>div{height:100%;min-height:0}html[data-surface=tv] #app>div{display:flex;flex-direction:column;padding:var(--pb-overscan-y) var(--pb-overscan-x)}
</style></head><body><main id="app">${content}</main></body></html>`;
}

describe('phase screens', () => {
  it.each(game.phases)('renders %s for TV, both phone modes and spectator', (phase) => {
    const state = JSON.parse(
      readFileSync(resolve(root, `games/block-clash/fixtures/${phase}.json`), 'utf8'),
    ) as State;
    mkdirSync(media, { recursive: true });
    const tv = renderToStaticMarkup(
      <ServerClockProvider offsetMs={state.checked - Date.now()}>
        <Tv view={{ ...game.tvView(state), vip: null }} />
      </ServerClockProvider>,
    );
    if (phase === 'play') expect(tv).toContain('<svg');
    for (const p of Object.values(state.players)) expect(tv).toContain(p.name);
    writeFileSync(resolve(media, `${phase}-tv.html`), page(tv, 'tv'));
    for (const phoneOnly of [false, true]) {
      for (const id of ['p1', 'spectator']) {
        const s = { ...state, phoneOnly };
        const view = { ...game.controllerView(s, id), vip: null };
        const content = renderToStaticMarkup(
          <ServerClockProvider offsetMs={state.checked - Date.now()}>
            <PhoneOnlyProvider value={phoneOnly}>
              <Controller
                view={view}
                me={s.players[id] ?? { id, name: 'Guest', connected: true, avatarId: 'fox' }}
                send={() => undefined}
              />
            </PhoneOnlyProvider>
          </ServerClockProvider>,
        );
        if (phoneOnly) expect(content).not.toMatch(/look at the tv|on the tv/i);
        if (id === 'spectator') expect(content).not.toMatch(/<button|<select/);
        if (phase === 'play' && id === 'p1') {
          expect(content).toContain('Move left');
          expect(content).toContain('Choose rival');
          expect(content).toContain('Outline = landing');
        }
        writeFileSync(
          resolve(media, `${phase}-${id}-${phoneOnly ? 'phone-only' : 'with-tv'}.html`),
          page(content, 'phone'),
        );
      }
    }
  });
});
