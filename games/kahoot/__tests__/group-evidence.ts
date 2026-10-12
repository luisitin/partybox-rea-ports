// Current P02 screenshots share the pinned canonical host layout and actual emitted CSS.
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import groupStyles from '../client/Group.module.css';
import { digest, evidenceCSS, scoped, standalone } from './upgrade-evidence';
import type { UpgradeFrame } from './upgrade-evidence';
import type { State } from '../server/types';

const ROOT = resolve(import.meta.dirname, '../../..');
const JOB = resolve(ROOT, 'jobs/P02-quiz-rush-teams');
export const GROUP_MEDIA = resolve(JOB, 'media');
export async function writeGroupEvidence(
  frames: UpgradeFrame[],
  fixtures: Record<string, State>,
): Promise<void> {
  mkdirSync(GROUP_MEDIA, { recursive: true });
  copyFileSync(resolve(ROOT, 'design/tokens.css'), resolve(GROUP_MEDIA, 'tokens.css'));
  copyFileSync(
    resolve(ROOT, 'jobs/P01-quiz-rush/media/nunito-latin-wght-normal.woff2'),
    resolve(GROUP_MEDIA, 'nunito-latin-wght-normal.woff2'),
  );
  // The pinned CSS printer needs more than one pass on long grid-template calc lists.
  // Stabilize the generated file rather than publishing a file its own check rejects.
  const cssPath = resolve(GROUP_MEDIA, 'evidence.css');
  const options = { ...(await resolveConfig(cssPath)), filepath: cssPath };
  let css = evidenceCSS() + '\n' + scoped('games/kahoot/client/Group.module.css', groupStyles);
  let stable = false;
  for (let pass = 0; pass < 5; pass++) {
    const next = await format(css, options);
    if (next === css) {
      stable = true;
      break;
    }
    css = next;
  }
  if (!stable) throw new Error('Generated evidence CSS formatting did not converge');
  writeFileSync(cssPath, css, 'utf8');
  for (const frame of frames)
    writeFileSync(resolve(GROUP_MEDIA, `${frame.name}.html`), standalone(frame), 'utf8');
  for (const [name, state] of Object.entries(fixtures)) {
    writeFileSync(
      resolve(ROOT, `games/kahoot/fixtures/${name}.json`),
      JSON.stringify(state, null, 2) + '\n',
      'utf8',
    );
  }
  writeFileSync(
    resolve(GROUP_MEDIA, 'capture-manifest.json'),
    JSON.stringify(
      frames.map(({ html: _html, chrome: _chrome, ...frame }) => frame),
      null,
      2,
    ) + '\n',
    'utf8',
  );
  writeFileSync(
    resolve(GROUP_MEDIA, 'phase-fixtures.json'),
    JSON.stringify(fixtures, null, 2) + '\n',
    'utf8',
  );
  const bytes = readdirSync(GROUP_MEDIA).reduce(
    (sum, file) => sum + statSync(resolve(GROUP_MEDIA, file)).size,
    0,
  );
  if (bytes >= 10 * 1024 * 1024) throw new Error(`P02 media exceeds budget: ${bytes}`);
  writeFileSync(
    resolve(JOB, 'SHA256SUMS.txt'),
    readdirSync(GROUP_MEDIA)
      .sort()
      .map((file) => `${digest(readFileSync(resolve(GROUP_MEDIA, file)))}  media/${file}`)
      .join('\n') + '\n',
    'utf8',
  );
}
