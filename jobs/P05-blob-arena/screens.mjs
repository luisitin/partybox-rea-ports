// SSR the real components and their scoped CSS at the two required surfaces.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { game } from '../../games/agar-io/server/index.ts';
import { Tv } from '../../games/agar-io/client/Tv.tsx';
import { Controller } from '../../games/agar-io/client/Controller.tsx';

const media = new URL('./media/', import.meta.url);
mkdirSync(media, { recursive: true });
const tokens = readFileSync(new URL('../../design/tokens.css', import.meta.url), 'utf8');
const css = [...globalThis.blobCaptureCss.values()].join('\n');
const pages = [];
for (const phase of ['play', 'score', 'done']) {
  const fixture = JSON.parse(
    readFileSync(new URL(`../../games/agar-io/fixtures/${phase}.json`, import.meta.url), 'utf8'),
  );
  const shift = Date.now() - (fixture.began + fixture.world.time);
  const state = {
    ...fixture,
    began: fixture.began + shift,
    endsAt: fixture.endsAt + shift,
    phase: {
      ...fixture.phase,
      startedAt: fixture.phase.startedAt + shift,
      deadline: fixture.phase.deadline === null ? null : fixture.phase.deadline + shift,
    },
    players: Object.fromEntries(
      Object.entries(fixture.players).map(([id, p]) => [id, { ...p, canSeeTv: true }]),
    ),
  };
  for (const surface of ['tv', 'phone', 'phone-only']) {
    const isTv = surface === 'tv';
    const s = surface === 'phone-only' ? { ...state, phoneOnly: true } : state;
    const view = { ...(isTv ? game.tvView(s) : game.controllerView(s, 'p1')), vip: null };
    const component = isTv
      ? createElement(Tv, { view })
      : createElement(
          PhoneOnlyProvider,
          { value: surface === 'phone-only' },
          createElement(Controller, { view, me: state.players.p1, send: () => undefined }),
        );
    const html = renderToStaticMarkup(component);
    const width = isTv ? 1920 : 390,
      height = isTv ? 1080 : 844;
    const shell = isTv ? 'TV · Blob Arena' : 'PB · ABCD · Ana';
    const header = isTv ? 108 : 80,
      footer = isTv ? 64 : 0;
    const document = `<!doctype html><html lang="en" data-surface="${isTv ? 'tv' : 'phone'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${phase} ${surface}</title><style>${tokens}\n${css}\n*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}.capture-header{height:${header}px;display:flex;align-items:center;padding:0 var(--pb-space-5);font-weight:900;font-size:var(--pb-font-body);border-bottom:1px solid var(--pb-surface-2)}main{height:calc(100% - ${header + footer}px);display:flex;flex-direction:column;min-height:0;width:100%}.capture-footer{height:${footer}px}</style></head><body><header class="capture-header">${shell}</header><main>${html}</main>${isTv ? '<footer class="capture-footer"></footer>' : ''}</body></html>`;
    const name = `${phase}-${surface}.html`;
    writeFileSync(new URL(name, media), document);
    pages.push({ name, width, height, surface, phase });
  }
}
writeFileSync(new URL('./screens.json', import.meta.url), JSON.stringify(pages, null, 2) + '\n');
console.log(`Rendered ${pages.length} real-component screens.`);
process.exit(0);
