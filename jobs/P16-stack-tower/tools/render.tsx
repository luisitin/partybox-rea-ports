// Standalone HTML evidence uses the actual React views, CSS modules and design tokens.
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import type { State } from '../../../games/stack-tower/server/types';
import { game } from '../../../games/stack-tower/server/index';

let clock = 1000;
Date.now = () => clock;
const { PhoneOnlyProvider } = await import('@partybox/game-sdk/ui');
const { Tv } = await import('../../../games/stack-tower/client/Tv');
const { Controller } = await import('../../../games/stack-tower/client/Controller');
const tokens = readFileSync(new URL('../../../design/tokens.css', import.meta.url), 'utf8');
const css = (globalThis as unknown as { __PB_CAPTURE_CSS: string }).__PB_CAPTURE_CSS;

for (const phase of ['initial', 'play', 'score', 'done']) {
  const state = JSON.parse(
    readFileSync(
      new URL(`../../../games/stack-tower/fixtures/${phase}.json`, import.meta.url),
      'utf8',
    ),
  ) as State;
  clock = state.checked;
  for (const surface of ['tv', 'phone', 'phone-only', 'spectator', 'remote'] as const) {
    const phoneOnly = surface === 'phone-only' || surface === 'spectator';
    const id = surface === 'spectator' ? 'watcher' : surface === 'remote' ? 'p8' : 'p1';
    const s = { ...state, phoneOnly };
    const view = { ...game.controllerView(s, id), vip: null };
    const tv = surface === 'tv';
    const markup = renderToStaticMarkup(
      tv ? (
        <Tv view={{ ...game.tvView(s), vip: null }} />
      ) : (
        <PhoneOnlyProvider value={phoneOnly}>
          <Controller
            view={view}
            me={s.players[id] ?? { id, name: 'Watcher', avatarId: 'fox' }}
            send={() => undefined}
          />
        </PhoneOnlyProvider>
      ),
    );
    const width = tv ? 1920 : 390;
    const height = tv ? 1080 : 844;
    const doc = `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'phone'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Skyline Stack ${phase} ${surface}</title><style>${tokens}\n${css}\n*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:var(--pb-font-family);background:var(--pb-bg);color:var(--pb-text)}#app{height:100%;width:100%;display:flex;flex-direction:column;}body{width:${width}px;height:${height}px;overflow:hidden}</style></head><body><main id="app">${markup}</main></body></html>`;
    writeFileSync(new URL(`../media/${phase}-${surface}.html`, import.meta.url), doc);
  }
}
console.log('20 actual React static screens written.');
