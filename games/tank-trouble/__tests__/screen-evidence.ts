// Vitest stubs CSS modules: reconstruct selectors using the exact classes emitted by SSR.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import arena from '../client/Arena.module.css';
import standings from '../client/Standings.module.css';
import tv from '../client/Tv.module.css';
import phone from '../client/Controller.module.css';
import stage from '../../../packages/game-sdk/src/tv/Stage.module.css';
import screen from '../../../packages/game-sdk/src/controller/Screen.module.css';
import waiting from '../../../packages/game-sdk/src/controller/WaitingScreen.module.css';

export type Surface = 'tv' | 'phone-tv' | 'phone-only' | 'spectator';
export interface Frame {
  name: string;
  surface: Surface;
  width: number;
  height: number;
  html: string;
}
const ROOT = resolve(import.meta.dirname, '../../..');
export const JOB = resolve(ROOT, 'jobs/P22-ricochet-rumble');
export const MEDIA = resolve(JOB, 'media');
const MODULES: [string, Record<string, string>][] = [
  ['Arena', arena],
  ['Standings', standings],
  ['Tv', tv],
  ['Controller', phone],
];
const SDK_MODULES: [string, Record<string, string>][] = [
  ['tv/Stage', stage],
  ['controller/Screen', screen],
  ['controller/WaitingScreen', waiting],
];

function scoped(name: string, mapping: Record<string, string>): string {
  const path = `games/tank-trouble/client/${name}.module.css`;
  let css = readFileSync(resolve(ROOT, path), 'utf8');
  css = css.replace(/:global\(([^)]+)\)/g, '$1');
  for (const local of new Set(
    [...css.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((match) => match[1]!),
  )) {
    const emitted = mapping[local];
    if (emitted) css = css.replace(new RegExp(`\\.${local}(?![a-zA-Z0-9_-])`, 'g'), `.${emitted}`);
  }
  return `/* ${path} */\n${css}`;
}

function sdkCss(name: string, mapping: Record<string, string>): string {
  let css = readFileSync(resolve(ROOT, `packages/game-sdk/src/${name}.module.css`), 'utf8');
  for (const local of new Set(
    [...css.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((match) => match[1]!),
  )) {
    const emitted = mapping[local];
    if (emitted) css = css.replace(new RegExp(`\\.${local}(?![a-zA-Z0-9_-])`, 'g'), `.${emitted}`);
  }
  return css.replace(/:global\(([^)]+)\)/g, '$1');
}

const SHELL = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family);font-size:var(--pb-font-body);line-height:1.4}
h1,h2,h3,p{margin:0}button{font:inherit}
.evidence-shell{display:grid;width:100%;height:100%;grid-template-rows:84px minmax(0,1fr) 48px}
[data-surface=tv] .evidence-shell{grid-template-rows:100px minmax(0,1fr) 80px}
.evidence-header,.evidence-footer{display:flex;align-items:center;justify-content:space-between;padding:var(--pb-space-4);background:var(--pb-surface);gap:var(--pb-space-3)}
.evidence-footer{font-size:var(--pb-font-caption);color:var(--pb-text-muted)}
.evidence-main{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}
:root[data-motion=off] *{animation:none!important;transition:none!important}
`;

export function standalone(frame: Frame): string {
  const css =
    readFileSync(resolve(ROOT, 'design/tokens.css'), 'utf8') +
    '\n' +
    MODULES.map(([name, mapping]) => scoped(name, mapping)).join('\n') +
    '\n' +
    SDK_MODULES.map(([name, mapping]) => sdkCss(name, mapping)).join('\n') +
    '\n' +
    SHELL;
  return `<!doctype html><html lang="en" data-surface="${frame.surface === 'tv' ? 'tv' : 'phone'}" data-motion="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tank Trouble · ${frame.name}</title><style>${css}</style></head><body><div class="evidence-shell"><header class="evidence-header"><b>PartyBox</b><span>RUMB</span></header><main class="evidence-main" aria-label="Game stage">${frame.html}</main><footer class="evidence-footer"><span>Tank Trouble · ${frame.surface}</span><span>${frame.width} × ${frame.height}</span></footer></div></body></html>`;
}

export function hashMedia(): void {
  const sums = readdirSync(MEDIA)
    .sort()
    .map(
      (name) =>
        `${createHash('sha256')
          .update(readFileSync(resolve(MEDIA, name)))
          .digest('hex')}  media/${name}`,
    );
  writeFileSync(resolve(JOB, 'SHA256SUMS.txt'), sums.join('\n') + '\n', 'utf8');
}

export function writeFrames(frames: Frame[]): void {
  mkdirSync(MEDIA, { recursive: true });
  for (const frame of frames)
    writeFileSync(resolve(MEDIA, `${frame.name}.html`), standalone(frame), 'utf8');
  writeFileSync(
    resolve(MEDIA, 'capture-manifest.json'),
    JSON.stringify(
      frames.map(({ html: _html, ...rest }) => rest),
      null,
      2,
    ) + '\n',
    'utf8',
  );
  hashMedia();
}
