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
    'jobs/P05-blob-arena/provenance.mjs',
    'design/tokens.css',
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
    'Authored matched states in the archived May1 original canvas renderer and the actual shipped Arena; actual rendered settled camera and50/100/150ms movement/growth. Not a live original match or a current2026 renderer claim.',
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
    report.stage = `original-${scene.id}`;
    console.log(JSON.stringify({ stage: report.stage }));
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
    report.stage = `ours-${scene.id}`;
    console.log(JSON.stringify({ stage: report.stage }));
    await navigate(`http://127.0.0.1:${port}/jobs/P05-blob-arena/fidelity.html?scene=${scene.id}`);
    const ours = await evaluate(
      `(()=>{const svg=document.querySelector('[data-camera="personal"]');const r=svg.getBoundingClientRect();const world=svg.querySelector('[data-world-layer]');const m=new DOMMatrix(getComputedStyle(world).transform);const name=svg.querySelector('[data-name-inside]');const ownedBaselines=[...svg.querySelectorAll('[data-mine="true"][data-cell-id]')].map(g=>{const n=g.querySelector('[data-name-inside]');const p=new DOMMatrix(getComputedStyle(g).transform);const a=world.getCTM().inverse().multiply(n.getCTM());return{name:n.textContent,x:p.e,baselineY:a.f+n.y.animVal.getItem(0).value*a.d};});return {center:[(r.width/2-m.e)/m.a,(r.height/2-m.f)/m.d].join(' '),zoom:m.a,targetCenter:svg.dataset.cameraCenter,targetZoom:Number(svg.dataset.cameraZoom),matrix:{a:m.a,e:m.e,f:m.f},viewBox:svg.getAttribute('viewBox'),width:r.width,height:r.height,names:[...svg.querySelectorAll('[data-name-inside]')].map(n=>n.textContent),ownedBaselines,font:name?getComputedStyle(name).fontFamily:null};})()`,
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
    const baselines = ours.ownedBaselines.map((pose) => {
      const original = originalMetrics.ownedBodies
        .filter((body) => body.name === pose.name)
        .sort((a, b) => Math.abs(a.labelCenter.x - pose.x) - Math.abs(b.labelCenter.x - pose.x))[0];
      if (!original) throw new Error(`Original static baseline missing for ${pose.name}`);
      const errorPx = Math.abs(pose.baselineY - original.nameBaselineY) * originalMetrics.zoom;
      return { name: pose.name, ours: pose.baselineY, original: original.nameBaselineY, errorPx };
    });
    const baselinesPassed =
      baselines.length === originalMetrics.ownPieces &&
      baselines.length > 0 &&
      baselines.every((baseline) => baseline.errorPx < 0.5);
    report.pairs.push({
      id: scene.id,
      description: scene.description,
      original: originalMetrics,
      ours,
      cameraMatches,
      baselines,
      baselinesPassed,
      originalPngSha256: digest(Buffer.from(originalPng.data, 'base64')),
      oursPngSha256: digest(Buffer.from(oursPng.data, 'base64')),
    });
    console.log(JSON.stringify({ stage: 'fidelity', scene: scene.id, cameraMatches }));
  }
  // One received movement/growth update, sampled through both actual renderers.
  const motionScene = scenes[0];
  report.stage = 'motion-original';
  console.log(JSON.stringify({ stage: report.stage }));
  const nextCells = motionScene.cells.map((cell) =>
    cell.owner === 'p1' ? { ...cell, x: cell.x + 4, mass: cell.mass * 4 } : cell,
  );
  await navigate(`http://localhost:${port}/__r1_original?scene=${motionScene.id}`);
  await evaluate(`window.__referenceMove(${JSON.stringify(nextCells)})`);
  const referenceMotion = [];
  const sampleTimes = [50, 100, 150, 300, 600];
  let previousFrame = 0;
  for (const ms of sampleTimes) {
    const frame = Math.round((ms / 1000) * 60);
    const reference = await evaluate(`window.__referenceFrames(${frame - previousFrame})`);
    const png = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(
      join(fidelity, `original-motion-${String(ms).padStart(3, '0')}.png`),
      Buffer.from(png.data, 'base64'),
    );
    referenceMotion.push({ ...reference, pngSha256: digest(Buffer.from(png.data, 'base64')) });
    previousFrame = frame;
  }
  report.stage = 'motion-ours';
  console.log(JSON.stringify({ stage: report.stage }));
  await navigate(
    `http://127.0.0.1:${port}/jobs/P05-blob-arena/fidelity.html?scene=${motionScene.id}`,
  );
  await evaluate(
    `window.__oursMove(${JSON.stringify(nextCells)});document.getAnimations().forEach(a=>a.pause());true`,
  );
  report.motion = [];
  for (const [index, reference] of referenceMotion.entries()) {
    const ms = sampleTimes[index];
    const ours = await evaluate(
      `(()=>{document.getAnimations().forEach(a=>{a.pause();a.currentTime=${ms};});const svg=document.querySelector('[data-camera="personal"]');const world=svg.querySelector('[data-world-layer]');const m=new DOMMatrix(getComputedStyle(world).transform);const box=svg.getBoundingClientRect();const poses=[...svg.querySelectorAll('[data-mine="true"][data-cell-id]')].map(g=>{const b=g.querySelector('[data-cell-body]');const n=g.querySelector('[data-name-inside]');const p=new DOMMatrix(getComputedStyle(g).transform);const a=world.getCTM().inverse().multiply(n.getCTM());return{id:Number(g.dataset.cellId),name:n.textContent,x:p.e,y:p.f,radius:parseFloat(getComputedStyle(b).r),fontSize:parseFloat(getComputedStyle(n).fontSize),baselineY:a.f+n.y.animVal.getItem(0).value*a.d,font:getComputedStyle(n).fontFamily};});return{x:(box.width/2-m.e)/m.a,y:(box.height/2-m.f)/m.d,zoom:m.a,poses,animations:document.getAnimations().length,matrix:{a:m.a,e:m.e,f:m.f}};})()`,
    );
    const centerErrorPx = Math.hypot(ours.x - reference.x, ours.y - reference.y) * reference.zoom;
    const zoomError = Math.abs(ours.zoom - reference.zoom);
    const png = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(
      join(fidelity, `ours-motion-${String(ms).padStart(3, '0')}.png`),
      Buffer.from(png.data, 'base64'),
    );
    const bodies = ours.poses.map((pose) => {
      const original = reference.ownedBodies.find((body) => body.name === pose.name);
      if (!original) throw new Error(`Original owned body trace missing for ${pose.name}`);
      const centerErrorPx =
        Math.hypot(pose.x - original.labelCenter.x, pose.y - original.labelCenter.y) *
        reference.zoom;
      const radiusErrorPx = Math.abs(pose.radius - original.radius) * reference.zoom;
      const originalFontPx = Number.parseFloat(original.nameFont);
      const fontErrorPx =
        Math.abs(pose.fontSize * (10 / 0.55) - originalFontPx) * reference.worldMatrix.a;
      const baselineErrorPx = Math.abs(pose.baselineY - original.nameBaselineY) * reference.zoom;
      return {
        ours: pose,
        original,
        centerErrorPx,
        radiusErrorPx,
        fontErrorPx,
        baselineErrorPx,
        matched: centerErrorPx < 1 && radiusErrorPx < 2 && fontErrorPx < 1 && baselineErrorPx < 0.5,
      };
    });
    // One-pixel label rounding and up-to-two-pixel original edge wobble are observed
    // canvas raster geometry, not permission for a body to jump to its final target.
    const bodiesPassed =
      bodies.length === reference.ownPieces &&
      reference.ownedBodies.length === reference.ownPieces &&
      bodies.length > 0 &&
      bodies.every((body) => body.matched);
    report.motion.push({
      ms,
      reference,
      ours,
      centerErrorPx,
      zoomError,
      oursPngSha256: digest(Buffer.from(png.data, 'base64')),
      bodies,
      bodiesPassed,
      matched: centerErrorPx < 1 && zoomError < 0.01 && bodiesPassed,
    });
    console.log(JSON.stringify({ stage: 'camera-motion', ms, centerErrorPx, zoomError }));
  }
  report.motionPassed = report.motion.every((sample) => sample.matched);
  report.afterSources = source();
  report.sourcesStable = sameSources(before, report.afterSources);
  report.passed =
    report.pairs.every((pair) => pair.cameraMatches && pair.baselinesPassed) &&
    report.motionPassed &&
    report.sourcesStable;
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
