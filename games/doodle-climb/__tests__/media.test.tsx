// Actual React server renders for every phase, both room modes and spectators.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { format } from 'prettier';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import controllerCss from '../client/Controller.module.css';
import tvCss from '../client/Tv.module.css';
import climbCss from '../client/Climb.module.css';
import stageCss from '../../../packages/game-sdk/src/tv/Stage.module.css';
import { game } from '../server/index';
import type { State } from '../server/types';

const root = resolve(import.meta.dirname, '../../..');
const media = join(root, 'jobs/P15-doodle-climb/media');
const styles = [
  ['games/doodle-climb/client/Controller.module.css', controllerCss],
  ['games/doodle-climb/client/Tv.module.css', tvCss],
  ['games/doodle-climb/client/Climb.module.css', climbCss],
  ['packages/game-sdk/src/tv/Stage.module.css', stageCss],
] as const;

function css(): string {
  return (
    readFileSync(join(root, 'design/tokens.css'), 'utf8') +
    styles
      .map(([file, mapping]) =>
        readFileSync(join(root, file), 'utf8')
          .replace(/:global\(([^)]+)\)/g, '$1')
          .replace(/\.([a-zA-Z][\w-]*)/g, (_, name: string) => `.${mapping[name] ?? name}`),
      )
      .join('\n')
  );
}

describe('media: all real components', () => {
  for (const phase of game.phases) {
    it(`renders ${phase} for TV, phone, phone-only and spectator`, async () => {
      const fixture = JSON.parse(
        readFileSync(join(root, `games/doodle-climb/fixtures/${phase}.json`), 'utf8'),
      ) as State;
      mkdirSync(media, { recursive: true });
      for (const mode of ['tv', 'phone', 'phone-only', 'spectator'] as const) {
        const phoneOnly = mode === 'phone-only' || mode === 'spectator';
        const state: State = { ...fixture, phoneOnly };
        const id = mode === 'spectator' ? 'spectator' : 'p1';
        const now = state.phase.id === 'play' ? state.began + state.elapsed : state.phase.startedAt;
        const markup = renderToStaticMarkup(
          <ServerClockProvider offsetMs={now - Date.now()}>
            <PhoneOnlyProvider value={phoneOnly}>
              {mode === 'tv' ? (
                <Tv view={{ ...game.tvView(state), vip: null }} />
              ) : (
                <Controller
                  view={{ ...game.controllerView(state, id), vip: null }}
                  me={{ id, name: id, avatarId: 'fox' }}
                  send={() => undefined}
                />
              )}
            </PhoneOnlyProvider>
          </ServerClockProvider>,
        );
        expect(markup).toContain('<svg');
        if (phoneOnly)
          expect(markup).not.toMatch(/Look at the TV|on the TV|Watch the climbs here or on the TV/);
        if (mode === 'spectator') expect(markup).not.toContain('<button');
        if (
          phase === 'play' &&
          mode !== 'tv' &&
          mode !== 'spectator' &&
          state.world.climbers[0]?.died === null
        ) {
          expect(markup).toContain('Hold left');
          expect(markup).toContain('Hold right');
        }
        const surface = mode === 'tv' ? 'tv' : 'controller';
        const header = mode === 'tv' ? 80 : 72;
        const footer = mode === 'tv' ? 70 : 44;
        const html = `<!doctype html><html data-surface="${surface}" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${phase} ${mode}</title><style>${css()}
          *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}
          body{display:grid;grid-template-rows:${header}px minmax(0,1fr) ${footer}px}#root{display:flex;flex-direction:column;min-height:0}aside,footer{display:flex;align-items:center;justify-content:space-between;padding:0 var(--pb-space-5);font-size:var(--pb-font-body)}footer{font-size:var(--pb-font-caption)}
          </style></head><body><aside><b>PARTYBOX</b><span>Doodle Climb</span></aside><main id="root">${markup}</main><footer><span>${mode === 'tv' ? 'Host controls' : 'Connected · Your seat is saved'}</span><span>${phase}</span></footer></body></html>`;
        writeFileSync(
          join(media, `${phase}-${mode}.html`),
          await format(html, { parser: 'html' }),
          'utf8',
        );
      }
    });
  }
});
