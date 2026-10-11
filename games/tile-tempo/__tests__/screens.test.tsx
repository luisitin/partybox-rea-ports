// Preserve every phase as styled static HTML; the job capture tool measures these exact renders.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import phoneStyles from '../client/Controller.module.css';
import tvStyles from '../client/Tv.module.css';
import stageStyles from '../../../packages/game-sdk/src/tv/Stage.module.css';
import avatarStyles from '../../../packages/game-sdk/src/ui/Avatar.module.css';
import { game } from '../server/index';
import type { State } from '../server/types';
import ready from '../fixtures/ready.json';
import play from '../fixtures/play.json';
import score from '../fixtures/score.json';
import done from '../fixtures/done.json';

const fixtures = { ready, play, score, done } as unknown as Record<string, State>;
const media = 'jobs/P19-piano-tiles-race/media';
function moduleCss(path: string, classes: Record<string, string>): string {
  return readFileSync(path, 'utf8')
    .replace(/:global\(([^)]+)\)/g, '$1')
    .replace(/\.([a-zA-Z][\w-]*)/g, (whole, name: string) =>
      classes[name] ? `.${classes[name]}` : whole,
    );
}
const css =
  readFileSync('design/tokens.css', 'utf8') +
  '\n' +
  [
    moduleCss('games/tile-tempo/client/Controller.module.css', phoneStyles),
    moduleCss('games/tile-tempo/client/Tv.module.css', tvStyles),
    moduleCss('packages/game-sdk/src/tv/Stage.module.css', stageStyles),
    moduleCss('packages/game-sdk/src/ui/Avatar.module.css', avatarStyles),
  ].join('\n');
const frameCss = `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}
.chrome{height:60px;padding:16px;font-size:18px;display:flex;justify-content:space-between}
main{height:calc(100% - 104px);min-height:0}.bottom{height:44px;padding:12px;text-align:center}
[data-surface='tv'] .chrome{height:100px;padding:32px 96px;font-size:36px}
[data-surface='tv'] main{height:calc(100% - 176px)}
[data-surface='tv'] .bottom{height:76px;padding:20px;font-size:32px}`;
const records: { file: string; width: number; height: number }[] = [];
mkdirSync(media, { recursive: true });

describe.each(Object.entries(fixtures))('static screens: %s', (phase, fixture) => {
  it.each(['tv', 'phone', 'phone-only', 'spectator'] as const)('renders %s', (surface) => {
    const phoneOnly = surface === 'phone-only' || surface === 'spectator';
    const state = { ...fixture, phoneOnly };
    const id = surface === 'spectator' ? 'spectator' : 'p1';
    const tv = surface === 'tv';
    const view = { ...game.controllerView(state, id), vip: null };
    const displayNow = fixture.phase.startedAt + (phase === 'play' ? fixture.elapsed : 0);
    const html = renderToStaticMarkup(
      <ServerClockProvider offsetMs={displayNow - Date.now()}>
        {tv ? (
          <Tv view={{ ...game.tvView(state), vip: null }} />
        ) : (
          <PhoneOnlyProvider value={phoneOnly}>
            <Controller
              view={view}
              me={state.players[id] ?? { id, name: '', avatarId: 'fox' }}
              send={() => undefined}
            />
          </PhoneOnlyProvider>
        )}
      </ServerClockProvider>,
    );
    expect(html).toContain('<h2');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    if (surface === 'spectator') expect(html).not.toContain('<button');
    if (phoneOnly) {
      expect(html).not.toMatch(/Look at the TV|on the TV|One moment/);
      for (const player of Object.values(state.players)) expect(html).toContain(player.name);
    }
    if (!tv && surface !== 'spectator' && phase === 'play') {
      expect((html.match(/<button/g) ?? []).length).toBe(4);
      expect(html).toContain('Note tile, column');
    }
    const name = `${phase}-${surface}.html`;
    writeFileSync(
      `${media}/${name}`,
      `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'controller'}" data-motion="off"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tile Tempo ${phase} ${surface}</title><style>${css}\n${frameCss}</style><body><header class="chrome"><b>PartyBox</b><span>ABCD · ${tv ? '8 players' : 'Player 1'}</span></header><main>${html}</main><footer class="bottom">${tv ? 'Host controls' : 'Room controls'}</footer></body></html>\n`,
    );
    records.push({ file: name, width: tv ? 1920 : 390, height: tv ? 1080 : 844 });
  });
});
it('writes the capture inventory', () => {
  expect(records).toHaveLength(16);
  writeFileSync(`${media}/screens.json`, `${JSON.stringify(records, null, 2)}\n`);
});
