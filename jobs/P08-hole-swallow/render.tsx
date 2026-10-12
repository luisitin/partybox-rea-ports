// Static phase gallery made from the production components, fixtures, tokens and CSS modules.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../games/hole-io/client/Controller';
import { Tv } from '../../games/hole-io/client/Tv';
import { game } from '../../games/hole-io/server/index';
import { cases } from './cases';

const output = resolve(process.env.PB_P08_CAPTURE_DIR ?? 'jobs/P08-hole-swallow/media');
mkdirSync(output, { recursive: true });
for (const file of ['nunito-latin-wght-normal.woff2', 'NUNITO-LICENSE.txt', 'hydrate.js']) {
  const source = resolve('jobs/P08-hole-swallow/media', file);
  if (source !== resolve(output, file)) copyFileSync(source, resolve(output, file));
}
const css = readFileSync(
  process.env.PB_P08_CSS ?? resolve(dirname(fileURLToPath(import.meta.url)), 'render.css'),
  'utf8',
);
writeFileSync(
  resolve(output, 'styles.css'),
  `@font-face{font-family:'Nunito Variable';font-style:normal;font-weight:200 1000;src:url('nunito-latin-wght-normal.woff2') format('woff2');font-display:block}\n` +
    readFileSync('design/tokens.css', 'utf8') +
    '\n' +
    css +
    '\n' +
    readFileSync(process.env.PB_P08_CLIENT_CSS!, 'utf8'),
);
const files: string[] = [];
const manifest = [];
for (const item of cases()) {
  const original = item.state,
    phase = original.phase.id;
  for (const surface of item.surfaces) {
    const phoneOnly = surface === 'phone-only';
    let state = { ...original, phoneOnly };
    if (surface === 'remote')
      state = {
        ...state,
        players: { ...state.players, p1: { ...state.players.p1!, canSeeTv: false } },
      };
    const id = surface === 'spectator' ? 'spectator' : 'p1';
    const now =
      state.phase.id === 'play' ? state.began + state.world.elapsed : state.phase.startedAt;
    const component =
      surface === 'tv' ? (
        <Tv view={{ ...game.tvView(state), vip: null }} />
      ) : (
        <PhoneOnlyProvider value={phoneOnly}>
          <Controller
            view={{ ...game.controllerView(state, id), vip: null }}
            me={state.players[id] ?? { id, name: 'Spectator', avatarId: 'fox', connected: true }}
            send={() => undefined}
          />
        </PhoneOnlyProvider>
      );
    const html = renderToStaticMarkup(
      <ServerClockProvider offsetMs={now - Date.now()}>{component}</ServerClockProvider>,
    );
    const tv = surface === 'tv';
    const name = `${item.key}-${surface}.html`;
    const me = state.players[id] ?? { id, name: 'Spectator', avatarId: 'fox', connected: true };
    const payload = {
      tv,
      phoneOnly,
      now,
      view: tv ? game.tvView(state) : game.controllerView(state, id),
      me,
    };
    files.push(name);
    manifest.push({
      file: name,
      case: item.key,
      phase,
      surface,
      synthetic: item.synthetic,
      players: Object.keys(state.players).length,
      now,
    });
    writeFileSync(
      resolve(output, name),
      `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'controller'}" data-motion="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hole.io · ${phase} · ${surface}</title><link rel="stylesheet" href="styles.css"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}body{display:flex;flex-direction:column}body>header,body>footer{flex:none;display:flex;align-items:center;justify-content:space-between;padding:var(--pb-space-3) var(--pb-space-4);font-size:var(--pb-font-body);background:var(--pb-surface)}body>header{height:${tv ? 80 : 60}px}body>footer{height:${tv ? 56 : 44}px}main{flex:1;min-height:0;display:flex;flex-direction:column;padding:${tv ? 'var(--pb-space-4) var(--pb-overscan-x)' : '0'};}button{font:inherit}h1{font-size:inherit;margin:0}
</style></head><body><header><h1>PartyBox · Hole.io</h1><span>${tv ? `${Object.keys(state.players).length} players` : surface === 'spectator' ? 'Spectator' : 'Player 1'}</span></header><main id="stage">${html}</main><footer><span>${phase === 'play' ? '90-second city' : 'Final standings'}</span><span>${tv ? 'P08' : 'Connected'}</span></footer><script type="application/json" id="p08-payload">${JSON.stringify(payload).replaceAll('<', '\\u003c')}</script><script src="hydrate.js"></script></body></html>`,
    );
  }
}
writeFileSync(resolve(output, 'index.json'), JSON.stringify(files, null, 2) + '\n');
writeFileSync(resolve(output, 'capture-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Rendered ${files.length} production phase/surface HTML files.`);
