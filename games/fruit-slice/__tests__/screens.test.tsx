// Phase HTML is executable QA evidence: eight-seat TV, both phone modes and spectators.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { game } from '../server/index';
import type { State } from '../server/types';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import controllerCss from '../client/Controller.module.css';
import fountainCss from '../client/Fountain.module.css';
import standingsCss from '../client/Standings.module.css';
import tvCss from '../client/Tv.module.css';
import stageCss from '../../../packages/game-sdk/src/tv/Stage.module.css';
import play from '../fixtures/play.json';
import score from '../fixtures/score.json';
import done from '../fixtures/done.json';

const fixtures = { play, score, done } as unknown as Record<string, State>;
const media = new URL('../../../jobs/P20-fruit-slice/media/', import.meta.url);
const tokens = readFileSync(new URL('../../../design/tokens.css', import.meta.url), 'utf8');
function css(name: string, mapping: Record<string, string>): string {
  return readFileSync(new URL(`../client/${name}.module.css`, import.meta.url), 'utf8')
    .replace(/\.([A-Za-z][\w-]*)/g, (full, key: string) =>
      mapping[key] ? `.${mapping[key]}` : full,
    )
    .replace(/:global\(([^)]+)\)/g, '$1');
}
const styles =
  tokens +
  readFileSync(
    new URL('../../../packages/game-sdk/src/tv/Stage.module.css', import.meta.url),
    'utf8',
  ).replace(/\.([A-Za-z][\w-]*)/g, (full, key: string) =>
    stageCss[key] ? `.${stageCss[key]}` : full,
  ) +
  [
    css('Controller', controllerCss),
    css('Fountain', fountainCss),
    css('Standings', standingsCss),
    css('Tv', tvCss),
  ].join('\n');
function documentHtml(body: string, tv: boolean): string {
  return `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'controller'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fruit Slice phase QA</title><style>${styles}
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}
  body{overflow:hidden;display:flex;flex-direction:column}#chrome{flex:none;padding:var(--pb-space-4);height:64px;font-size:var(--pb-font-body);background:var(--pb-surface)}
  #root{height:calc(100% - 128px);min-height:0;display:flex;flex-direction:column}#footer{height:64px;flex:none;padding:var(--pb-space-4);color:var(--pb-text-muted)}
  [data-surface=tv] #chrome{height:100px;padding:var(--pb-space-6) var(--pb-overscan-x)}
  [data-surface=tv] #root{height:calc(100% - 180px);--pb-stage-top:0px}
  [data-surface=tv] #footer{height:80px;padding:var(--pb-space-4) var(--pb-overscan-x);font-size:var(--pb-font-body)}
  </style><body><div id="chrome">PartyBox · Fruit Slice · ROOM</div><main id="root">${body}</main><footer id="footer">${tv ? 'Stage preview · eight seats' : 'Connected · seat held · ★ host menu'}</footer></body></html>`;
}
describe('phase screens', () => {
  it.each(Object.entries(fixtures))(
    '%s renders every surface and spectator without hidden state or spectator controls',
    (phase, state) => {
      mkdirSync(media, { recursive: true });
      const time = state.began + state.checked;
      const offsetMs = time - Date.now();
      const tv = renderToStaticMarkup(
        <ServerClockProvider offsetMs={offsetMs}>
          <Tv view={{ ...game.tvView(state), vip: null }} />
        </ServerClockProvider>,
      );
      expect(tv).toContain('Ana');
      expect(tv).toContain('Hal');
      expect(tv).toContain('<svg');
      writeFileSync(new URL(`tv-${phase}.html`, media), documentHtml(tv, true));
      for (const phoneOnly of [false, true])
        for (const id of ['p1', 'spectator']) {
          const view = game.controllerView({ ...state, phoneOnly }, id);
          const html = renderToStaticMarkup(
            <ServerClockProvider offsetMs={offsetMs}>
              <PhoneOnlyProvider value={phoneOnly}>
                <Controller
                  view={{ ...view, vip: null }}
                  me={
                    state.players[id] ?? { id, name: 'Spectator', connected: true, avatarId: 'fox' }
                  }
                  send={() => undefined}
                />
              </PhoneOnlyProvider>
            </ServerClockProvider>,
          );
          expect(html).not.toMatch(/Look at the TV|on the TV|"rng"|"cut"/);
          if (id === 'spectator') expect(html).not.toContain('<button');
          if (phase === 'play') expect(html).toContain('<svg');
          if (phase !== 'play' || phoneOnly || id === 'spectator') {
            expect(html).toContain('Ana');
            expect(html).toContain('Hal');
          }
          writeFileSync(
            new URL(`phone-${phoneOnly ? 'only' : 'tv'}-${id}-${phase}.html`, media),
            documentHtml(html, false),
          );
        }
    },
  );
});
