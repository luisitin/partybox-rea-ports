// Start the installed Vite (a Vitest dependency) on a fresh loopback port. No package edits.
// Run: node jobs/P05-blob-arena/preview.mjs
// Stop with SIGINT/SIGTERM. The browser is owned and closed by the capture runner.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const directory = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(directory, '../..');
const token = randomUUID();
let stop;
const stopped = new Promise((resolve) => {
  stop = resolve;
});
const require = createRequire(import.meta.url);
const fromVitest = createRequire(require.resolve('vitest/package.json'));
const { createServer } = await import(pathToFileURL(fromVitest.resolve('vite')).href);
const server = await createServer({
  configFile: false,
  root,
  logLevel: 'error',
  plugins: [
    {
      name: 'p05-owned-preview',
      transformIndexHtml(html) {
        return html
          .replace(/<title>[^<]*<\/title>/, '<title>Agar.io mounted controller preview</title>')
          .replace(
            '</head>',
            '<style>#preview-header{height:80px}#root{height:calc(100dvh - 160px)}#preview-footer{height:80px;display:flex;align-items:center;padding:0 var(--pb-space-4);font-size:var(--pb-font-caption);color:var(--pb-text-muted)}</style></head>',
          )
          .replace(
            '</body>',
            '<footer id="preview-footer">Agar.io · local mounted preview</footer></body>',
          );
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== '/__p05_preview' && req.url !== '/__p05_preview/close') return next();
          if (req.headers['x-p05-preview-token'] !== token) {
            res.statusCode = 403;
            res.end('Owner token required');
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          if (req.url === '/__p05_preview' && req.method === 'GET') {
            res.end(
              JSON.stringify({
                job: 'P05',
                root,
                pid: process.pid,
                token,
                phoneShell: { top: 80, bottom: 80 },
              }),
            );
          } else if (req.url === '/__p05_preview/close' && req.method === 'POST') {
            res.end(JSON.stringify({ closing: process.pid }));
            stop();
          } else {
            res.statusCode = 405;
            res.end('{}');
          }
        });
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: /^@partybox\/game-sdk\/ui$/,
        replacement: resolve(root, 'packages/game-sdk/src/ui.ts'),
      },
      {
        find: /^@partybox\/game-sdk$/,
        replacement: resolve(root, 'packages/game-sdk/src/index.ts'),
      },
      { find: /^@partybox\/shared$/, replacement: resolve(root, 'packages/shared/src/index.ts') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { entries: ['jobs/P05-blob-arena/interactive.tsx'] },
  server: {
    host: '127.0.0.1',
    port: 0,
    strictPort: true,
    open: false,
    hmr: false,
    cors: false,
    allowedHosts: ['127.0.0.1'],
    fs: { strict: true, allow: [root] },
  },
});
try {
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string')
    throw new Error('Preview did not acquire a TCP port.');
  console.log(
    JSON.stringify({
      event: 'preview-ready',
      port: address.port,
      pid: process.pid,
      root,
      ...(process.env.PB_PREVIEW_WRAPPED === '1' ? { token } : {}),
      base: `http://127.0.0.1:${address.port}`,
      url: `http://127.0.0.1:${address.port}/jobs/P05-blob-arena/interactive.html?phoneonly=1`,
    }),
  );
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await stopped;
} finally {
  await server.close();
}
