// Replays authored matched moments through the archived ORIGINAL renderer and ours.
// Original source is fetched to OS-temp, hash-checked, and never shipped in game code.
// One owned Chrome, one reused tab, finally closes Chrome and the loopback server.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Cdp, devToolsEndpoint, closeProfileProcesses } from './fidelity-cdp.mjs';
import { originalHtml as buildOriginalHtml, referenceMetadata } from './fidelity-reference.mjs';
import { files, hashes, dependencySources, sameSources } from './provenance.mjs';

const job = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(job, '../..');
const fidelity = join(root, 'games/agar-io/fidelity');
const referencePin = '4e25418ae81043f391557422a5ee19f3f0c2e588';
const originalPath = '2015-05-01/main_out.js';
const originalSha = '19e61e116c9dab1d215bec86e063349a7424caa4e2369e649f268a7664e044e9';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = () => ({
  ...hashes([
    'games/agar-io/manifest.json',
    ...files('games/agar-io/server'),
    ...files('games/agar-io/client'),
    ...files('games/agar-io/content'),
    'jobs/P05-blob-arena/fidelity-scenes.json',
    'jobs/P05-blob-arena/fidelity.tsx',
    'jobs/P05-blob-arena/fidelity.html',
    'jobs/P05-blob-arena/fidelity-reference.mjs',
    'jobs/P05-blob-arena/fidelity-r1.mjs',
    'jobs/P05-blob-arena/fidelity-cdp.mjs',
  ]),
  ...dependencySources(),
});
const startedAt = new Date().toISOString();
const before = source();
const scenes = JSON.parse(await readFile(join(job, 'fidelity-scenes.json'), 'utf8'));
const report = {
  startedAt,
  referencePin,
  originalPath,
  originalSha,
  sources: before,
  method:
    'Authored matched states in the archived May1 original canvas renderer and the actual shipped Arena; settled camera. Not a live original match or a current2026 renderer claim.',
  network:
    'Original normal bootstrap and parser run through a fake WebSocket; CSP connect-src none; no original assets/fonts/skins loaded.',
  scope:
    'Personal arena camera, cell geometry, centered names on every piece, food and grid. HUD/native controls are verified separately in the actual controller.',
  pairs: [],
  passed: false,
  cleanup: null,
};
const referenceDir = await mkdtemp(join(tmpdir(), 'partybox-p05-original-reference-'));
async function originalFile(path) {
  const response = JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        `repos/Tombez/official-agar.io-client-by-matheus-valadares/contents/${path}?ref=${referencePin}`,
      ],
      { encoding: 'utf8', windowsHide: true },
    ),
  );
  const bytes = Buffer.from(response.content, 'base64');
  await writeFile(join(referenceDir, path.split('/').at(-1)), bytes);
  return bytes;
}
const original = await originalFile(originalPath);
if (digest(original) !== originalSha) throw new Error('Pinned original client hash mismatch');
const quad = await originalFile('2015-04-30/quadtree.js');
report.quadtreeSha = digest(quad);
report.instrumentation = referenceMetadata(original, quad);
const originalHtml = (scene) => buildOriginalHtml(scene, original, quad);
const require = createRequire(import.meta.url);
const fromVitest = createRequire(require.resolve('vitest/package.json'));
const { createServer } = await import(pathToFileURL(fromVitest.resolve('vite')).href);
let server, child, cdp, sessionId, profile;
try {
  await mkdir(fidelity, { recursive: true });
  server = await createServer({
    configFile: false,
    root,
    logLevel: 'error',
    plugins: [
      {
        name: 'p05-original-reference-only',
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname !== '/__r1_original') return next();
            const scene = scenes.find((entry) => entry.id === url.searchParams.get('scene'));
            if (!scene) {
              res.statusCode = 404;
              res.end();
              return;
            }
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-store');
            res.end(originalHtml(scene));
          });
        },
      },
    ],
    resolve: {
      alias: [
        {
          find: /^@partybox\/game-sdk\/ui$/,
          replacement: join(root, 'packages/game-sdk/src/ui.ts'),
        },
        {
          find: /^@partybox\/game-sdk$/,
          replacement: join(root, 'packages/game-sdk/src/index.ts'),
        },
        { find: /^@partybox\/shared$/, replacement: join(root, 'packages/shared/src/index.ts') },
      ],
      dedupe: ['react', 'react-dom'],
    },
    esbuild: { jsx: 'automatic' },
    optimizeDeps: { entries: ['jobs/P05-blob-arena/fidelity.tsx'] },
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: true,
      open: false,
      hmr: false,
      cors: false,
      allowedHosts: ['localhost', '127.0.0.1'],
    },
  });
  await server.listen();
  const port = server.httpServer.address().port;
  profile = await mkdtemp(join(tmpdir(), 'partybox-p05-fidelity-'));
  child = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-extensions',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  cdp = await Cdp.open(await devToolsEndpoint(child, profile));
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
  const send = (method, params = {}) => cdp.send(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const navigate = async (url) => {
    await send('Page.navigate', { url });
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (
        await evaluate(
          `location.href===${JSON.stringify(url)}&&document.body?.dataset.ready==='true'`,
        )
      ) {
        await evaluate('document.fonts.ready.then(()=>true)');
        await new Promise((done) => setTimeout(done, 300));
        return;
      }
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error('Matched scene readiness timed out');
  };
  for (const scene of scenes) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: scene.width,
      height: scene.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate(`http://localhost:${port}/__r1_original?scene=${scene.id}`);
    const originalMetrics = await evaluate('window.__originalMetrics');
    const originalPng = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(
      join(fidelity, `original-${scene.id}.png`),
      Buffer.from(originalPng.data, 'base64'),
    );
    await navigate(`http://127.0.0.1:${port}/jobs/P05-blob-arena/fidelity.html?scene=${scene.id}`);
    const ours = await evaluate(
      `(()=>{const svg=document.querySelector('[data-camera="personal"]');const r=svg?.getBoundingClientRect();return {center:svg?.dataset.cameraCenter,zoom:Number(svg?.dataset.cameraZoom),viewBox:svg?.getAttribute('viewBox'),width:r?.width,height:r?.height,names:[...svg.querySelectorAll('[data-name-inside]')].map(n=>n.textContent),font: getComputedStyle(svg).fontFamily};})()`,
    );
    const oursPng = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(join(fidelity, `ours-${scene.id}.png`), Buffer.from(oursPng.data, 'base64'));
    const center = (ours.center ?? '').split(' ').map(Number);
    const cameraMatches =
      Math.abs(center[0] - originalMetrics.x) < 0.01 &&
      Math.abs(center[1] - originalMetrics.y) < 0.01 &&
      Math.abs(ours.zoom - originalMetrics.zoom) < 0.0001 &&
      Math.abs(ours.width - scene.width) < 1 &&
      Math.abs(ours.height - scene.height) < 1;
    report.pairs.push({
      id: scene.id,
      description: scene.description,
      original: originalMetrics,
      ours,
      cameraMatches,
      originalPngSha256: digest(Buffer.from(originalPng.data, 'base64')),
      oursPngSha256: digest(Buffer.from(oursPng.data, 'base64')),
    });
    console.log(JSON.stringify({ stage: 'fidelity', scene: scene.id, cameraMatches }));
  }
  report.afterSources = source();
  report.sourcesStable = sameSources(before, report.afterSources);
  report.passed = report.pairs.every((pair) => pair.cameraMatches) && report.sourcesStable;
  if (!report.passed) throw new Error('Fidelity camera or source guard failed');
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  let closed = false;
  if (cdp) {
    try {
      await cdp.send('Browser.close', {}, undefined, 10000);
      closed = true;
    } catch {}
    cdp.socket.close();
  }
  if (profile) {
    try {
      await closeProfileProcesses(profile);
      report.cleanup = { browserClosed: closed, remainingPids: [], profileRetained: true };
    } catch (error) {
      report.cleanup = { browserClosed: closed, error: error.message };
      process.exitCode = 1;
    }
  }
  if (server) await server.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(join(job, 'r1-fidelity.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(
  JSON.stringify({
    passed: report.passed,
    pairs: report.pairs.length,
    cleanup: report.cleanup,
    error: report.error ?? null,
  }),
);
