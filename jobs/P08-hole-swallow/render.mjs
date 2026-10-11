// Uses esbuild already installed through tsx; adds no repository dependency.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(import.meta.resolve('tsx'));
const { build } = require('esbuild');
const outdir = resolve('.git/r7-render');
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
await import(pathToFileURL(resolve(outdir, 'render.mjs')).href);
