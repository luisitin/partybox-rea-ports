// esbuild is already an installed dependency of tsx; no install/runtime dependency.
import { createRequire } from 'node:module';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { game } from '../../../games/2048/server/index.ts';

const require = createRequire(import.meta.url);
const tsxRequire = createRequire(require.resolve('tsx'));
const { build } = tsxRequire('esbuild');
const job = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  entryPoints: [resolve(job, 'tools/interactive-entry.tsx')],
  bundle: true,
  write: false,
  outfile: 'interactive.js',
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const js = result.outputFiles.find((file) => file.path.endsWith('.js')).text;
const css = result.outputFiles.find((file) => file.path.endsWith('.css')).text;
const source = JSON.parse(
  await readFile(resolve('games/2048/fidelity/original-states.json'), 'utf8'),
).states[0];
const state = game.init({
  players: ['p1', 'p2'].map((id) => ({
    id,
    name: id === 'p1' ? 'You' : 'Peer',
    avatarId: 'fox',
    connected: true,
  })),
  settings: {},
  seed: 913,
  now: 0,
});
for (const id of ['p1', 'p2'])
  state.racers[id] = {
    ...state.racers[id],
    board: source.board,
    score: source.score,
    moves: source.moves,
  };
let html = await readFile(resolve(job, 'media/start-fidelity.html'), 'utf8');
html = html.replace('data-motion="off"', 'data-motion="on"');
html = html.replace(
  /<main id="game-frame"[\s\S]*?<\/main>/,
  '<main id="game-frame" aria-label="Game stage"></main>',
);
html = html.replace(
  '</head>',
  `<base href="${pathToFileURL(resolve(job, 'media') + '/').href}"><style>${css}</style></head>`,
);
html = html.replace(
  '</body>',
  `<script id="capture-state" type="application/json">${JSON.stringify(state).replaceAll('<', '\\u003c')}</script><script>${js.replaceAll('</script', '<\\/script')}</script></body>`,
);
const temporary = resolve(tmpdir(), 'r1-local-p09-interactive.html');
const temporaryScript = resolve(tmpdir(), 'r1-local-p09-interactive.js');
await writeFile(temporaryScript, js, 'utf8');
// External local script avoids HTML script-tokenizer collisions in bundled shaders.
html = html.replace(
  /<script>([\s\S]*?)<\/script>/,
  `<script src="${pathToFileURL(temporaryScript).href}"></script>`,
);
await writeFile(temporary, html, 'utf8');
// This harness includes server fixtures; it is a temporary test room, not public game media.
await rm(resolve(job, 'media/interactive.html'), { force: true });
console.log(
  JSON.stringify({
    interactiveBytes: Buffer.byteLength(html),
    purpose: 'Own-game live reducer/controller animation and input probes only',
  }),
);
