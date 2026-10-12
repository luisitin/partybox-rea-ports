// Uses esbuild already installed through tsx; adds no repository dependency.
import { createRequire } from 'node:module';
import { mkdirSync, copyFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(import.meta.resolve('tsx'));
const { build } = require('esbuild');
const outdir = resolve('.git/r2-p08-render');
mkdirSync(outdir, { recursive: true });
await build({
  entryPoints: ['jobs/P08-hole-swallow/render.tsx'],
  outfile: resolve(outdir, 'render.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  external: ['react', 'react-dom/server', 'react/jsx-runtime'],
  loader: { '.module.css': 'local-css', '.css': 'css' },
  logLevel: 'warning',
});
process.env.PB_P08_CSS = resolve(outdir, 'render.css');
await build({
  entryPoints: ['jobs/P08-hole-swallow/hydrate.tsx'],
  outfile: resolve(outdir, 'hydrate.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  minify: true,
  loader: { '.module.css': 'local-css', '.css': 'css' },
  logLevel: 'warning',
});
copyFileSync(resolve(outdir, 'hydrate.js'), resolve('jobs/P08-hole-swallow/media/hydrate.js'));
process.env.PB_P08_CLIENT_CSS = resolve(outdir, 'hydrate.css');
await import(pathToFileURL(resolve(outdir, 'render.mjs')).href);
