import { resolve } from 'node:path';

const here = import.meta.dirname;
const repo = resolve(here, '../../..');
export default {
  root: here,
  esbuild: { jsx: 'automatic' },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: /^@partybox\/game-sdk\/ui$/,
        replacement: resolve(repo, 'packages/game-sdk/src/ui.ts'),
      },
      {
        find: /^@partybox\/game-sdk$/,
        replacement: resolve(repo, 'packages/game-sdk/src/index.ts'),
      },
      { find: /^@partybox\/shared$/, replacement: resolve(repo, 'packages/shared/src/index.ts') },
    ],
  },
  build: {
    target: 'es2022',
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    minify: true,
    lib: {
      entry: resolve(here, 'entry.tsx'),
      name: 'TankInputHarness',
      formats: ['iife'],
      fileName: () => 'harness.iife.js',
      cssFileName: 'harness',
    },
  },
};
