// SSR evidence only: runtime game code does not read files or wall-clock time.
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { format, resolveConfig } from 'prettier';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../../games/2048/client/Controller';
import { Tv } from '../../../games/2048/client/Tv';
import { game } from '../../../games/2048/server';
import type { State } from '../../../games/2048/server/types';

declare global {
  var __partyboxCapturedCss: { url: string; localPath: string; css: string }[] | undefined;
}

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const job = fileURLToPath(new URL('../', import.meta.url));
const media = resolve(job, 'media');
const tokens = await readFile(resolve(repository, 'design/tokens.css'), 'utf8');
const fixtures = resolve(repository, 'games/2048/fixtures');
const outputs: string[] = [];
const formatOptions = await resolveConfig(resolve(repository, '.prettierrc'));

// The direct Node/tsx capture emits classic JSX factory calls.
// Supply that factory in the capture process without changing the game's bundler output.
Object.assign(globalThis, { React });

function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}

function html(surface: 'tv' | 'phone', title: string, content: string, players: number): string {
  const styles = (globalThis.__partyboxCapturedCss ?? [])
    .map((entry) => `/* ${entry.localPath} */\n${entry.css}`)
    .join('\n');
  return `<!doctype html><html lang="en" data-surface="${surface}" data-theme="night" data-motion="off"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<style>${tokens}\n${styles}</style><style>
@font-face{font-family:'Nunito Variable';font-style:normal;font-weight:200 1000;font-display:swap;src:url('./nunito-latin-wght-normal.woff2') format('woff2')}
*,*::before,*::after{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family);font-size:var(--pb-font-body);line-height:1.4}
h1,h2,h3,p{margin:0}h1{font-size:var(--pb-font-h1);line-height:1.15;font-weight:800}h2{font-size:var(--pb-font-h2);line-height:1.2;font-weight:700}
button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer;border:0;background:none;padding:0;touch-action:manipulation}
#capture-root{display:grid;width:100%;height:100%;grid-template-rows:60px calc(var(--pb-font-caption)*1.4 + var(--pb-space-2)) minmax(0,1fr)}
[data-surface=tv] #capture-root{grid-template-rows:calc(var(--pb-overscan-y) + var(--pb-font-h2)*1.4 + var(--pb-space-3)) var(--pb-space-3) minmax(0,1fr) calc(var(--pb-touch) + var(--pb-space-4) + var(--pb-space-2) + var(--pb-space-3))}
#shell-header,#shell-footer{display:flex;align-items:center;justify-content:space-between;padding:var(--pb-space-4);background:var(--pb-surface);gap:var(--pb-space-3)}
[data-surface=tv] #shell-header{padding:var(--pb-overscan-y) var(--pb-overscan-x) var(--pb-space-3);font-size:var(--pb-font-h2)}
#shell-footer{font-size:var(--pb-font-caption);color:var(--pb-text-muted)}[data-surface=phone] #shell-footer{display:none}
#shell-chrome{min-height:0;padding:0 var(--pb-overscan-x) var(--pb-space-3)}
[data-surface=phone] #shell-chrome{display:flex;align-items:center;gap:var(--pb-space-2);padding:var(--pb-space-1) var(--pb-space-4);font-size:var(--pb-font-caption);color:var(--pb-text-muted)}
#shell-chrome i{height:6px;flex:1;border-radius:999px;background:var(--pb-accent-2)}[data-surface=tv] #shell-chrome>*{display:none}
#game-frame{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;--pb-stage-top:var(--pb-space-3)}#game-frame>*{width:100%}
.pb-muted{color:var(--pb-text-muted)}.pb-caption{font-size:var(--pb-font-caption)}
:root[data-motion=off] *,:root[data-motion=off] *::before,:root[data-motion=off] *::after{animation:none!important;transition:none!important}
</style></head><body data-capture="${escape(title)}"><div id="capture-root">
<header id="shell-header"><b>PartyBox</b><span>${players} players</span></header><div id="shell-chrome"><i></i><span>Race</span></div>
<main id="game-frame" aria-label="Game stage">${content}</main><footer id="shell-footer"><span>2048</span><span>${surface}</span></footer>
</div></body></html>`;
}

function clock(state: State, child: ReactNode): ReactNode {
  // Offset the real SDK clock to the fixture's phase so play never renders an expired timer.
  const fixtureNow = state.phase.startedAt + (state.phase.id === 'play' ? 40000 : 1000);
  return <ServerClockProvider offsetMs={fixtureNow - Date.now()}>{child}</ServerClockProvider>;
}

async function capture(name: string, surface: 'tv' | 'phone', state: State, node: ReactNode) {
  const markup = renderToStaticMarkup(clock(state, node));
  await writeFile(
    resolve(media, `${name}.html`),
    await format(html(surface, name, markup, Object.keys(state.players).length), {
      ...formatOptions,
      parser: 'html',
    }),
    'utf8',
  );
  outputs.push(`${name}.html`);
}

await mkdir(media, { recursive: true });
for (const phase of process.argv.includes('--hash-only') ? [] : game.phases) {
  const state = JSON.parse(await readFile(resolve(fixtures, `${phase}.json`), 'utf8')) as State;
  const first = Object.values(state.players)[0];
  if (!first) throw new Error(`Fixture ${phase} has no players`);
  await capture(`${phase}-tv`, 'tv', state, <Tv view={{ ...game.tvView(state), vip: first.id }} />);

  for (const phoneOnly of [false, true]) {
    for (const spectator of [false, true]) {
      const mode = phoneOnly ? 'phone-only' : 'with-tv';
      const role = spectator ? 'spectator' : 'player';
      const id = spectator ? 'capture-spectator' : first.id;
      const view = { ...game.controllerView(state, id), phoneOnly, vip: first.id };
      await capture(
        `${phase}-phone-${mode}-${role}`,
        'phone',
        state,
        <PhoneOnlyProvider value={phoneOnly}>
          <Controller
            view={view}
            me={{ id, name: spectator ? 'Spectator' : first.name, avatarId: first.avatarId }}
            send={() => undefined}
          />
        </PhoneOnlyProvider>,
      );
    }
  }
}

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const filename = resolve(directory, entry.name);
      return entry.isDirectory() ? files(filename) : [filename];
    }),
  );
  return nested.flat().sort();
}

const allMedia = await files(media);
const records = await Promise.all(
  allMedia.map(async (filename) => {
    const data = await readFile(filename);
    const hash = createHash('sha256').update(data).digest('hex');
    return {
      bytes: data.byteLength,
      line: `${hash}  ${relative(job, filename).replaceAll('\\', '/')}`,
    };
  }),
);
const bytes = records.reduce((sum, entry) => sum + entry.bytes, 0);
if (bytes >= 10_000_000) throw new Error(`Media exceeds the 10 MB budget: ${bytes} bytes`);
await writeFile(
  resolve(job, 'SHA256SUMS.txt'),
  `${records.map((entry) => entry.line).join('\n')}\n`,
  'utf8',
);
console.log(
  JSON.stringify(
    {
      rendered: outputs,
      cssModules: globalThis.__partyboxCapturedCss?.length ?? 0,
      mediaFiles: records.length,
      mediaBytes: bytes,
    },
    null,
    2,
  ),
);
