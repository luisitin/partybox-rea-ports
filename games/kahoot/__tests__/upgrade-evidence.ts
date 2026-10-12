// Standalone current-upgrade evidence bundles the actual CSS modules emitted by Vitest.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import classic from '../client/Classic.module.css';
import controller from '../client/Controller.module.css';
import television from '../client/Tv.module.css';
import chart from '../client/AnswerChart.module.css';
import next from '../client/NextStep.module.css';
import wagerReveal from '../client/WagerRevealStage.module.css';
import stage from '../../../packages/game-sdk/src/tv/Stage.module.css';
import timer from '../../../packages/game-sdk/src/tv/Timer.module.css';
import board from '../../../packages/game-sdk/src/tv/Scoreboard.module.css';
import text from '../../../packages/game-sdk/src/tv/BigText.module.css';
import screen from '../../../packages/game-sdk/src/controller/Screen.module.css';
import choice from '../../../packages/game-sdk/src/controller/ChoiceGrid.module.css';
import button from '../../../packages/game-sdk/src/controller/PrimaryButton.module.css';
import waiting from '../../../packages/game-sdk/src/controller/WaitingScreen.module.css';
import avatar from '../../../packages/game-sdk/src/ui/Avatar.module.css';
import lead from '../../../packages/game-sdk/src/ui/LeadMark.module.css';
import type { State } from '../server/types';

export type Surface = 'tv' | 'phone-tv' | 'phone-only' | 'remote' | 'spectator';
export interface UpgradeFrame {
  name: string;
  surface: Surface;
  width: number;
  height: number;
  at: number;
  stateHash: string;
  html: string;
}

const ROOT = resolve(import.meta.dirname, '../../..');
export const MEDIA = resolve(ROOT, 'jobs/P01-quiz-rush/media');
const MODULES: [string, Record<string, string>][] = [
  ['games/kahoot/client/Classic.module.css', classic],
  ['games/kahoot/client/Controller.module.css', controller],
  ['games/kahoot/client/Tv.module.css', television],
  ['games/kahoot/client/AnswerChart.module.css', chart],
  ['games/kahoot/client/NextStep.module.css', next],
  ['games/kahoot/client/WagerRevealStage.module.css', wagerReveal],
  ['packages/game-sdk/src/tv/Stage.module.css', stage],
  ['packages/game-sdk/src/tv/Timer.module.css', timer],
  ['packages/game-sdk/src/tv/Scoreboard.module.css', board],
  ['packages/game-sdk/src/tv/BigText.module.css', text],
  ['packages/game-sdk/src/controller/Screen.module.css', screen],
  ['packages/game-sdk/src/controller/ChoiceGrid.module.css', choice],
  ['packages/game-sdk/src/controller/PrimaryButton.module.css', button],
  ['packages/game-sdk/src/controller/WaitingScreen.module.css', waiting],
  ['packages/game-sdk/src/ui/Avatar.module.css', avatar],
  ['packages/game-sdk/src/ui/LeadMark.module.css', lead],
];

export const digest = (data: string | Buffer): string =>
  createHash('sha256').update(data).digest('hex');
export const stateDigest = (state: State): string => digest(JSON.stringify(state));

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scoped(path: string, mapping: Record<string, string>): string {
  let css = readFileSync(resolve(ROOT, path), 'utf8');
  const locals = new Set([...css.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((m) => m[1]!));
  css = css.replace(/:global\(([^)]+)\)/g, '$1').replace(/global\(([a-zA-Z0-9_-]+)\)/g, '$1');
  for (const name of locals) {
    if (mapping[name])
      css = css.replace(
        new RegExp(`\\.${escapeRegex(name)}(?![a-zA-Z0-9_-])`, 'g'),
        `.${mapping[name]}`,
      );
  }
  const frames = new Set([...css.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((m) => m[1]!));
  for (const name of frames) {
    const mapped = mapping[name] ?? `${path.replace(/[^a-zA-Z0-9]/g, '_')}_${name}`;
    css = css.replace(
      new RegExp(`(?<![a-zA-Z0-9_-])${escapeRegex(name)}(?![a-zA-Z0-9_-])`, 'g'),
      mapped,
    );
  }
  return `/* ${path} */\n${css}`;
}

const SHELL = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family);font-size:var(--pb-font-body);line-height:1.4}
h1,h2,h3,p{margin:0}h2{font-size:var(--pb-font-h1);line-height:1.2;font-weight:900}button,input,select,textarea{font:inherit;color:inherit}
.evidence-shell{display:grid;width:100%;height:100%;grid-template-rows:84px minmax(0,1fr) 48px}
[data-surface=tv] .evidence-shell{grid-template-rows:100px minmax(0,1fr) 80px}
.evidence-header,.evidence-footer{display:flex;align-items:center;justify-content:space-between;padding:var(--pb-space-4);background:var(--pb-surface);gap:var(--pb-space-3)}
.evidence-footer{font-size:var(--pb-font-caption);color:var(--pb-text-muted)}
.evidence-main{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;--pb-stage-top:var(--pb-space-5)}
.evidence-code{font-weight:900;color:var(--pb-accent-2)}
.pb-visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
:root[data-motion=off] *,:root[data-motion=off] *::before,:root[data-motion=off] *::after{animation:none!important;transition:none!important}
`;

export function standalone(frame: UpgradeFrame): string {
  // Only modules with used classes are embedded; no remote CSS/font requests are possible.
  const used = new Set(
    [...frame.html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1]!.split(/\s+/)),
  );
  const css = MODULES.filter(([path, map]) =>
    [...readFileSync(resolve(ROOT, path), 'utf8').matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].some(
      (m) => used.has(map[m[1]!] ?? ''),
    ),
  )
    .map(([path, map]) => scoped(path, map))
    .join('\n');
  const tokens = readFileSync(resolve(ROOT, 'design/tokens.css'), 'utf8');
  const surface = frame.surface === 'tv' ? 'tv' : 'phone';
  return `<!doctype html><html lang="en" data-surface="${surface}" data-motion="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kahoot! upgrade · ${frame.name}</title><style>${tokens}\n${css}\n${SHELL}</style></head><body><div class="evidence-shell"><header class="evidence-header"><b>PartyBox</b><span class="evidence-code">KAHOOT</span></header><main class="evidence-main" aria-label="Game stage">${frame.html}</main><footer class="evidence-footer"><span>Kahoot! · ${frame.surface}</span><span>${frame.width} × ${frame.height}</span></footer></div></body></html>`;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(resolve(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx|css|json)$/.test(path)
        ? [path]
        : [];
  });
}

export function writeUpgradeEvidence(
  frames: UpgradeFrame[],
  fixtures: Readonly<Record<string, State>>,
): void {
  mkdirSync(MEDIA, { recursive: true });
  const fixtureDir = resolve(ROOT, 'games/kahoot/fixtures');
  for (const [name, state] of Object.entries(fixtures)) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid evidence fixture name');
    writeFileSync(
      resolve(fixtureDir, `${name}.json`),
      JSON.stringify(state, null, 2) + '\n',
      'utf8',
    );
  }
  for (const frame of frames)
    writeFileSync(resolve(MEDIA, `${frame.name}.html`), standalone(frame), 'utf8');
  writeFileSync(
    resolve(MEDIA, 'capture-manifest.json'),
    JSON.stringify(
      frames.map(({ html: _html, ...frame }) => frame),
      null,
      2,
    ) + '\n',
    'utf8',
  );
  const files = [
    ...sourceFiles('games/kahoot/client'),
    ...sourceFiles('games/kahoot/server'),
    ...sourceFiles('games/kahoot/content'),
    'games/kahoot/__tests__/render-upgrade.test.tsx',
    'games/kahoot/__tests__/upgrade-evidence.ts',
    'design/tokens.css',
    ...MODULES.map(([path]) => path),
    'jobs/P01-quiz-rush/capture.mjs',
  ];
  writeFileSync(
    resolve(MEDIA, 'evidence-source.json'),
    JSON.stringify(
      {
        implementation: 'kahoot-lightning-round-upgrade',
        frames: frames.length,
        sources: Object.fromEntries(
          [...new Set(files)]
            .sort()
            .map((path) => [path, digest(readFileSync(resolve(ROOT, path)))]),
        ),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  const bytes = readdirSync(MEDIA).reduce(
    (sum, file) => sum + statSync(resolve(MEDIA, file)).size,
    0,
  );
  if (bytes >= 10 * 1024 * 1024)
    throw new Error(`HTML evidence budget exceeded before capture: ${bytes}`);
}
