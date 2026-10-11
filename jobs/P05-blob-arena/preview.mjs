// Start the installed Vite (a Vitest dependency) on a fresh loopback port. No package edits.
// Run: node jobs/P05-blob-arena/preview.mjs
// Stop with SIGINT/SIGTERM. The browser is owned and closed by the capture runner.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const directory = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(directory, '../..');
const require = createRequire(import.meta.url);
const fromVitest = createRequire(require.resolve('vitest/package.json'));
const { createServer } = await import(pathToFileURL(fromVitest.resolve('vite')).href);
const server = await createServer({
  configFile: false,
  root,
  logLevel: 'error',
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
      url: `http://127.0.0.1:${address.port}/jobs/P05-blob-arena/interactive.html?phoneonly=1`,
    }),
  );
  await new Promise((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
} finally {
  await server.close();
}
