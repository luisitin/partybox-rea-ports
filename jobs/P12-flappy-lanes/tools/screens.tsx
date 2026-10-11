// All-phase static screen artifacts from real components and fixtures, with their real styles.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../../games/flappy-lanes/client/Controller';
import { Tv } from '../../../games/flappy-lanes/client/Tv';
import { game } from '../../../games/flappy-lanes/server/index';
import type { State } from '../../../games/flappy-lanes/server/types';

declare global {
  var __flappyCss: string[];
}
const media = 'jobs/P12-flappy-lanes/media';
mkdirSync(media, { recursive: true });
const tokens = readFileSync('design/tokens.css', 'utf8');
const reset =
  '*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:var(--pb-font-family);color:var(--pb-text);background:var(--pb-bg)}.frame{display:flex;flex-direction:column;height:100%;min-height:0}.chrome{flex:none;padding:var(--pb-space-3);font-size:var(--pb-font-caption);color:var(--pb-text-muted)}main{flex:1;min-height:0;display:flex;flex-direction:column}';
const files: string[] = [];
for (const phase of ['play', 'score', 'done']) {
  const fixture = JSON.parse(
    readFileSync(`games/flappy-lanes/fixtures/${phase}.json`, 'utf8'),
  ) as State;
  const now = Date.now();
  const s: State = {
    ...fixture,
    began: now - fixture.world.checked,
    endsAt: now - fixture.world.checked + 45_000,
    phase: {
      ...fixture.phase,
      startedAt: now,
      deadline: fixture.phase.deadline === null ? null : now + 8000,
    },
  };
  for (const surface of ['tv', 'phone', 'phone-only', 'spectator'] as const) {
    const tv = surface === 'tv';
    const local = surface === 'phone-only' || surface === 'spectator';
    const state = local ? { ...s, phoneOnly: true as const } : s;
    const id = surface === 'spectator' ? 'audience' : 'p1';
    const markup = tv
      ? renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />)
      : renderToStaticMarkup(
          <PhoneOnlyProvider value={local}>
            <Controller
              view={{ ...game.controllerView(state, id), vip: null }}
              send={() => undefined}
              me={state.players[id] ?? { id, name: 'Audience', avatarId: 'fox', connected: true }}
            />
          </PhoneOnlyProvider>,
        );
    const css = `${tokens}\n${globalThis.__flappyCss.join('\n')}\n${reset}`;
    const name = `${phase}-${surface}.html`;
    const html = `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'controller'}" data-motion="off"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Flappy Lanes · ${phase} · ${surface}</title><style>${css}</style><body><div class="frame"><header class="chrome">PARTYBOX · FLAPPY LANES · ${tv ? 'Shared stage' : 'Your phone'}</header><main>${markup}</main><footer class="chrome">${tv ? 'r13-local · 1920 × 1080 · deterministic preview' : 'Connected · seat held on refresh'}</footer></div></body></html>`;
    writeFileSync(`${media}/${name}`, html);
    files.push(name);
  }
}
writeFileSync(`${media}/index.json`, `${JSON.stringify(files, null, 2)}\n`);
console.log(`Rendered ${files.length} real component previews.`);
process.exit(0);
