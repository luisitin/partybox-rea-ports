// Reuse the installed Vite CLI through Vitest's dependency; no package installation.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { format, resolveConfig } from 'prettier';

const here = import.meta.dirname;
const repo = resolve(here, '../../..');
const dist = resolve(here, 'dist');
if (!dist.startsWith(`${here}${sep}`)) throw new Error('Build output is outside this harness.');
const require = createRequire(import.meta.url);
const vitest = require.resolve('vitest/package.json');
const vitePackage = require.resolve('vite/package.json', { paths: [vitest] });
const viteCli = resolve(dirname(vitePackage), 'bin/vite.js');
execFileSync(process.execPath, [viteCli, 'build', '--config', resolve(here, 'vite.config.mjs')], {
  cwd: repo,
  stdio: 'inherit',
  timeout: 120000,
});
const js = readFileSync(resolve(dist, 'harness.iife.js'), 'utf8').replace(
  /<\/script/gi,
  '<\\/script',
);
const css = readdirSync(dist)
  .filter((name) => name.endsWith('.css'))
  .sort()
  .map((name) => readFileSync(resolve(dist, name), 'utf8'))
  .join('\n')
  .replace(/<\/style/gi, '<\\/style');
const html = `<!doctype html>
<html lang="en" data-surface="controller">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; media-src data:" />
    <title>Tank Trouble · offline input harness</title>
    <!-- prettier-ignore -->
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <!-- prettier-ignore -->
    <script>${js}</script>
  </body>
</html>
`;
const output = resolve(here, '../media/input-harness.html');
const config = await resolveConfig(output);
const formattedHtml = await format(html, { ...config, parser: 'html' });
writeFileSync(output, formattedHtml, 'utf8');
console.log(
  `Wrote ${output} (${Buffer.byteLength(formattedHtml)} bytes), with inline IIFE and CSS.`,
);
