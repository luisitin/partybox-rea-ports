// Test-only CSS reconstruction: Vitest stubs modules, so map source selectors to the exact names SSR emitted.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tvStyles from '../client/Tv.module.css';
import phoneStyles from '../client/Controller.module.css';
import partStyles from '../client/QuestionParts.module.css';
import stageStyles from '../../../packages/game-sdk/src/tv/Stage.module.css';
import timerStyles from '../../../packages/game-sdk/src/tv/Timer.module.css';
import boardStyles from '../../../packages/game-sdk/src/tv/Scoreboard.module.css';
import screenStyles from '../../../packages/game-sdk/src/controller/Screen.module.css';
import buttonStyles from '../../../packages/game-sdk/src/controller/PrimaryButton.module.css';
import avatarStyles from '../../../packages/game-sdk/src/ui/Avatar.module.css';

export type Surface = 'tv' | 'phone-tv' | 'phone-only' | 'spectator';
export interface EvidenceCase {
  name: string;
  surface: Surface;
  width: number;
  height: number;
  html: string;
}

const ROOT = resolve(import.meta.dirname, '../../..');
export const JOB = resolve(ROOT, 'jobs/P01-quiz-rush');
export const MEDIA = resolve(JOB, 'media');
const modules: [string, Record<string, string>][] = [
  ['games/quiz-rush/client/Tv.module.css', tvStyles],
  ['games/quiz-rush/client/Controller.module.css', phoneStyles],
  ['games/quiz-rush/client/QuestionParts.module.css', partStyles],
  ['packages/game-sdk/src/tv/Stage.module.css', stageStyles],
  ['packages/game-sdk/src/tv/Timer.module.css', timerStyles],
  ['packages/game-sdk/src/tv/Scoreboard.module.css', boardStyles],
  ['packages/game-sdk/src/controller/Screen.module.css', screenStyles],
  ['packages/game-sdk/src/controller/PrimaryButton.module.css', buttonStyles],
  ['packages/game-sdk/src/ui/Avatar.module.css', avatarStyles],
];

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scopedCss(path: string, mapping: Record<string, string>): string {
  let css = readFileSync(resolve(ROOT, path), 'utf8');
  const locals = [...css.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((m) => m[1]!);
  css = css.replace(/:global\(([^)]+)\)/g, '$1').replace(/global\(([a-zA-Z0-9_-]+)\)/g, '$1');
  for (const local of new Set(locals)) {
    const mapped = mapping[local];
    if (mapped)
      css = css.replace(new RegExp(`\\.${escapeRegex(local)}(?![a-zA-Z0-9_-])`, 'g'), `.${mapped}`);
  }
  const frames = [...css.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((m) => m[1]!);
  for (const frame of new Set(frames)) {
    const scoped = mapping[frame] ?? `${path.replace(/[^a-zA-Z0-9]/g, '_')}_${frame}`;
    css = css.replace(
      new RegExp(`(?<![a-zA-Z0-9_-])${escapeRegex(frame)}(?![a-zA-Z0-9_-])`, 'g'),
      scoped,
    );
  }
  return `/* ${path} */\n${css}`;
}

export function evidenceCss(): string {
  return (
    readFileSync(resolve(ROOT, 'design/tokens.css'), 'utf8') +
    '\n' +
    modules.map(([path, map]) => scopedCss(path, map)).join('\n')
  ).replace(/[ \t]+(?=\r?$)/gm, '');
}

// The application shell is not in this extracted repository. Reserve the real header/footer dimensions.
const SHELL_CSS = `
* {box-sizing:border-box} html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family);font-size:var(--pb-font-body);line-height:1.4}
h1,h2,h3,p{margin:0} h2{font-size:var(--pb-font-h1);line-height:1.2;font-weight:900} button{font:inherit}
.evidence-shell{display:grid;width:100%;height:100%;grid-template-rows:84px minmax(0,1fr) 48px}
[data-surface=tv] .evidence-shell{grid-template-rows:100px minmax(0,1fr) 80px}
.evidence-header,.evidence-footer{display:flex;align-items:center;justify-content:space-between;padding:var(--pb-space-4);background:var(--pb-surface);gap:var(--pb-space-3)}
.evidence-header{border-bottom:2px solid var(--pb-accent-2)}
.evidence-footer{font-size:var(--pb-font-caption);color:var(--pb-text-muted)}
.evidence-main{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;--pb-stage-top:var(--pb-space-5)}
.evidence-code{font-weight:900;color:var(--pb-accent-2)}
:root[data-motion=off] *, :root[data-motion=off] *::before, :root[data-motion=off] *::after{animation:none!important;transition:none!important}
`;

export function standalone(screen: EvidenceCase): string {
  const surface = screen.surface === 'tv' ? 'tv' : 'phone';
  return `<!doctype html><html lang="en" data-surface="${surface}" data-motion="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quiz Rush · ${screen.name}</title><style>${evidenceCss()}\n${SHELL_CSS}</style></head><body><div class="evidence-shell"><header class="evidence-header"><b>PartyBox</b><span class="evidence-code">QUIZ</span></header><main class="evidence-main" aria-label="Game stage">${screen.html}</main><footer class="evidence-footer"><span>Quiz Rush · ${screen.surface}</span><span>${screen.width} × ${screen.height}</span></footer></div></body></html>`;
}

export function writeEvidence(cases: EvidenceCase[]): void {
  mkdirSync(MEDIA, { recursive: true });
  for (const screen of cases)
    writeFileSync(resolve(MEDIA, `${screen.name}.html`), standalone(screen), 'utf8');
  writeFileSync(
    resolve(MEDIA, 'capture-manifest.json'),
    JSON.stringify(
      cases.map(({ html: _html, ...entry }) => entry),
      null,
      2,
    ) + '\n',
    'utf8',
  );
  const lines = readdirSync(MEDIA)
    .sort()
    .map(
      (file) =>
        `${createHash('sha256')
          .update(readFileSync(resolve(MEDIA, file)))
          .digest('hex')}  media/${file}`,
    );
  writeFileSync(resolve(JOB, 'SHA256SUMS.txt'), lines.join('\n') + '\n', 'utf8');
}
