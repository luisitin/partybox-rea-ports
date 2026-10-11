// Targeted SSR, layout and live-control checks. Exactly one browser, closed on every exit path.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const job = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(job, '../..');
const media = path.join(job, 'media');
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve('vitest/package.json'));
const viteRequire = createRequire(vitestRequire.resolve('vite/package.json'));
const esbuild = require(viteRequire.resolve('esbuild'));
const playwright = require(process.env.PB_PLAYWRIGHT_PATH || 'playwright-core');
const port = Number(process.env.PB_CAPTURE_PORT || 44114);
const origin = `http://127.0.0.1:${port}`;
const tokens = await readFile(path.join(root, 'design/tokens.css'), 'utf8');
const shellCss = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}
.capture-shell{height:100dvh;display:flex;flex-direction:column;overflow:hidden}
.capture-header{height:96px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:var(--pb-space-4);padding:var(--pb-space-4);border-bottom:1px solid var(--pb-border);background:var(--pb-surface);font-size:var(--pb-font-body)}
.capture-header span{font-size:var(--pb-font-caption)}#game-viewport{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.capture-footer{height:16px;flex:none}[data-surface=tv] .capture-header{height:100px;padding:var(--pb-space-5) var(--pb-overscan-x)}
[data-surface=tv] .capture-footer{height:80px}
`;
const html = (body, surface, preview = false) =>
  `<!doctype html><html lang="en" data-surface="${surface}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dino Dash review</title><link rel="stylesheet" href="${preview ? '/preview.css' : 'screens.css'}"></head><body>${body}${preview ? '<script type="module" src="/preview.js"></script>' : ''}</body></html>`;
const routes = new Map();
let browser;
let server;
let buildDir;
const errors = [];

async function chromiumPath() {
  const explicit = process.env.PB_CHROMIUM_PATH;
  const cache = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const candidates = explicit
    ? [explicit]
    : [
        path.join(cache, 'chromium-1243/chrome-win64/chrome.exe'),
        path.join(cache, 'chromium-1243/chrome-win/chrome.exe'),
      ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* Check the next installed layout. */
    }
  }
  throw new Error(`Chromium is unavailable; checked ${candidates.join(', ')}`);
}

async function measure(page) {
  return page.evaluate(() => {
    const game = document.getElementById('game-viewport');
    if (!game) throw new Error('Game viewport is missing');
    const viewport = game.getBoundingClientRect();
    const clipped = [];
    const ellipsized = [];
    const outside = (r, clip, x, y) =>
      (x && (r.left < clip.left - 1 || r.right > clip.right + 1)) ||
      (y && (r.top < clip.top - 1 || r.bottom > clip.bottom + 1));
    const walker = document.createTreeWalker(game, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest('svg, [aria-hidden=true]')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      let intentional = false;
      let ancestor = parent;
      while (ancestor && ancestor !== game.parentElement) {
        const css = getComputedStyle(ancestor);
        if (css.textOverflow === 'ellipsis' && ancestor.scrollWidth > ancestor.clientWidth)
          intentional = true;
        ancestor = ancestor.parentElement;
      }
      if (outside(rect, viewport, !intentional, true))
        clipped.push({ text, reason: 'outside game viewport', box: rect.toJSON() });
      ancestor = parent;
      while (ancestor && ancestor !== game) {
        const css = getComputedStyle(ancestor);
        const x = ['hidden', 'clip', 'auto', 'scroll'].includes(css.overflowX);
        const y = ['hidden', 'clip', 'auto', 'scroll'].includes(css.overflowY);
        if (outside(rect, ancestor.getBoundingClientRect(), x && !intentional, y)) {
          clipped.push({ text, reason: 'clipped by ' + ancestor.tagName, box: rect.toJSON() });
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (intentional) ellipsized.push(text);
    }
    const controls = [...game.querySelectorAll('button')].map((button) => {
      const r = button.getBoundingClientRect();
      return {
        label: button.getAttribute('aria-label') || button.textContent.trim(),
        width: r.width,
        height: r.height,
        fits: !outside(r, viewport, true, true),
        touchTarget: r.width >= 44 && r.height >= 44,
      };
    });
    return {
      viewport: viewport.toJSON(),
      scroll: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      },
      gameScroll: {
        width: game.scrollWidth,
        height: game.scrollHeight,
        clientWidth: game.clientWidth,
        clientHeight: game.clientHeight,
      },
      clipped,
      ellipsized: [...new Set(ellipsized)],
      controls,
      pass:
        clipped.length === 0 &&
        controls.every((c) => c.fits && c.touchTarget) &&
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight &&
        game.scrollHeight <= game.clientHeight + 1,
    };
  });
}

async function originalObservation(page) {
  const result = {
    url: 'https://wayou.github.io/t-rex-runner/',
    capturedAt: new Date().toISOString(),
    actions: [],
    note: 'Only numerical observations are saved; no original images, scripts, audio or assets.',
  };
  try {
    await page.goto(result.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => globalThis.Runner?.instance_, undefined, { timeout: 8000 });
    const sample = async (action) => {
      result.actions.push({
        action,
        sample: await page.evaluate(() => {
          const r = globalThis.Runner.instance_;
          return {
            speed: r.currentSpeed,
            distance: r.distanceRan,
            crashed: r.crashed,
            jumping: r.tRex?.jumping,
            ducking: r.tRex?.ducking,
            y: r.tRex?.yPos,
          };
        }),
      });
    };
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await sample('Space starts / jumps');
    await page.waitForTimeout(1000);
    await sample('Automatic run and speed ramp after 1 second');
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(150);
    await sample('ArrowDown held');
    await page.keyboard.up('ArrowDown');
    await sample('ArrowDown released');
    await page.waitForTimeout(2500);
    await sample('Collision/death after no avoidance');
  } catch (error) {
    result.error = error.message;
  }
  await writeFile(
    path.join(media, 'original-play-observation.json'),
    JSON.stringify(result, null, 2) + '\n',
    'utf8',
  );
}

async function liveChecks(page) {
  const checks = [];
  const flush = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  const snapshot = () => page.evaluate(() => window.dinoHarness.snapshot());
  const reset = async () => {
    await page.evaluate(() => window.dinoHarness.reset());
    await flush();
    await page.evaluate(() => window.dinoHarness.clearInputs());
  };
  const run = async (name, work) => {
    try {
      await reset();
      const evidence = await work();
      checks.push({ name, pass: true, evidence });
    } catch (error) {
      checks.push({ name, pass: false, error: error.message });
      errors.push(`${name}: ${error.message}`);
    }
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(origin + '/live', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.dinoHarness));
  await page.getByRole('button', { name: 'Hold to duck under a bird' }).waitFor();
  const duck = page.getByRole('button', { name: 'Hold to duck under a bird' });
  const jump = page.getByRole('button', { name: 'Jump over a rock' });
  const center = async (locator) => {
    const b = await locator.boundingBox();
    assert(b);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  await run('pointer duck press/release', async () => {
    const p = await center(duck);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await flush();
    assert.equal((await snapshot()).state.world.runners[0].duck, true);
    await page.mouse.up();
    await flush();
    const result = await snapshot();
    assert.deepEqual(
      result.inputs.map((i) => i.input),
      [
        { type: 'duck', down: true },
        { type: 'duck', down: false },
      ],
    );
    return result.inputs;
  });
  await run('pointer cancel releases duck', async () => {
    const p = await center(duck);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await duck.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
    await page.mouse.up();
    await flush();
    const result = await snapshot();
    assert.equal(result.state.world.runners[0].duck, false);
    return result.inputs;
  });
  await run('window blur and visibility release duck', async () => {
    await page.keyboard.down('ArrowDown');
    await flush();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.keyboard.up('ArrowDown');
    await flush();
    assert.equal((await snapshot()).state.world.runners[0].duck, false);
    await page.keyboard.down('ArrowDown');
    await flush();
    await page.evaluate(() => {
      const old = Object.getOwnPropertyDescriptor(document, 'hidden');
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      if (old) Object.defineProperty(document, 'hidden', old);
      else delete document.hidden;
    });
    await page.keyboard.up('ArrowDown');
    await flush();
    const result = await snapshot();
    assert.equal(result.state.world.runners[0].duck, false);
    return result.inputs;
  });
  await run(
    'Space jump ignores held-key repeat and pointer click does not double jump',
    async () => {
      await page.keyboard.down('Space');
      await page.keyboard.down('Space');
      await page.keyboard.up('Space');
      await flush();
      assert.equal((await snapshot()).inputs.filter((i) => i.input.type === 'jump').length, 1);
      await page.evaluate(() => window.dinoHarness.clearInputs());
      await jump.click();
      await flush();
      const result = await snapshot();
      assert.equal(result.inputs.filter((i) => i.input.type === 'jump').length, 1);
      return result.inputs;
    },
  );
  const cdp = await page.context().newCDPSession(page);
  await run('two-finger duck release keeps remaining finger held', async () => {
    const p = await center(duck);
    const one = { x: p.x - 10, y: p.y, id: 1 },
      two = { x: p.x + 10, y: p.y, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [one] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [one, two] });
    await flush();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [two] });
    await flush();
    assert.equal((await snapshot()).state.world.runners[0].duck, true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await flush();
    const result = await snapshot();
    assert.equal(result.state.world.runners[0].duck, false);
    assert.equal(result.inputs.length, 2);
    return result.inputs;
  });
  await run('jump and duck multi-touch remain distinct', async () => {
    const d = await center(duck),
      j = await center(jump);
    const one = { ...d, id: 3 },
      two = { ...j, id: 4 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [one] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [one, two] });
    await flush();
    assert.equal((await snapshot()).inputs.filter((i) => i.input.type === 'jump').length, 1);
    assert.equal((await snapshot()).state.world.runners[0].duck, true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await flush();
    const result = await snapshot();
    assert.equal(result.state.world.runners[0].duck, false);
    return result.inputs;
  });
  await run('pause unmount releases duck and resume starts unheld', async () => {
    await page.keyboard.down('ArrowDown');
    await flush();
    await page.evaluate(() => window.dinoHarness.pause());
    await flush();
    assert.equal((await snapshot()).state.world.runners[0].duck, false);
    assert.equal(await page.getByRole('button').count(), 0);
    await page.keyboard.up('ArrowDown');
    await page.evaluate(() => window.dinoHarness.resume());
    await flush();
    const result = await snapshot();
    assert.equal(result.state.world.runners[0].duck, false);
    return result.inputs;
  });
  await run(
    'drop/rejoin preserves authoritative run and full eight-player match terminates',
    async () => {
      await page.keyboard.down('ArrowDown');
      await flush();
      await page.evaluate(() => {
        window.dinoHarness.advance(1000);
        window.dinoHarness.drop();
      });
      await flush();
      const dropped = await snapshot();
      assert.equal(dropped.state.players.p1.connected, false);
      assert.equal(dropped.state.world.runners[0].duck, false);
      await page.keyboard.up('ArrowDown');
      await page.evaluate(() => {
        window.dinoHarness.rejoin();
        for (let n = 1; n <= 8; n++) window.dinoHarness.inputFor('p' + n, { type: 'jump' });
        window.dinoHarness.advance(180000);
      });
      await flush();
      const result = await snapshot();
      assert.equal(result.state.phase.id, 'done');
      assert.equal(Object.keys(result.state.scores).length, 8);
      assert(Object.values(result.state.scores).every(Number.isFinite));
      return {
        droppedAt: dropped.now,
        rejoined: result.state.players.p1.connected,
        phase: result.state.phase.id,
        scores: result.state.scores,
        players: Object.keys(result.state.players).length,
      };
    },
  );
  await cdp.detach();
  await writeFile(
    path.join(media, 'interactions.json'),
    JSON.stringify(checks, null, 2) + '\n',
    'utf8',
  );
  return checks;
}

async function inventory(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory())
      result.push(...(await inventory(path.join(directory, entry.name), relative + '/')));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}

try {
  await mkdir(media, { recursive: true });
  buildDir = await mkdtemp(path.join(root, 'node_modules', '.dino-capture-'));
  const common = {
    absWorkingDir: root,
    bundle: true,
    write: false,
    minify: true,
    target: 'es2022',
    logLevel: 'warning',
    tsconfig: path.join(root, 'tsconfig.json'),
  };
  const nodeBuild = await esbuild.build({
    ...common,
    entryPoints: [path.join(job, 'render-entry.tsx')],
    outfile: path.join(buildDir, 'render.mjs'),
    platform: 'node',
    format: 'esm',
    external: ['react', 'react-dom', 'react-dom/*'],
  });
  const nodeJs = nodeBuild.outputFiles.find((file) => file.path.endsWith('.mjs'));
  assert(nodeJs);
  await writeFile(nodeJs.path, nodeJs.contents);
  const renderer = await import(pathToFileURL(nodeJs.path).href);
  const style =
    tokens +
    '\n' +
    shellCss +
    '\n' +
    (nodeBuild.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? '');
  await writeFile(path.join(media, 'screens.css'), style, 'utf8');
  routes.set('/screens.css', { type: 'text/css', body: style });
  const fixtures = {};
  for (const filename of (await readdir(path.join(root, 'games/dino-dash/fixtures')))
    .filter((name) => name.endsWith('.json'))
    .sort())
    fixtures[filename.slice(0, -5)] = JSON.parse(
      await readFile(path.join(root, 'games/dino-dash/fixtures', filename), 'utf8'),
    );
  const cases = renderer.captureCases(fixtures);
  for (const spec of cases) {
    const document = html(renderer.renderCapture(spec), spec.surface);
    await writeFile(path.join(media, spec.name + '.html'), document, 'utf8');
    routes.set('/' + spec.name + '.html', { type: 'text/html', body: document });
  }
  const previewBuild = await esbuild.build({
    ...common,
    entryPoints: [path.join(job, 'preview-entry.tsx')],
    outfile: path.join(buildDir, 'preview.js'),
    platform: 'browser',
    format: 'esm',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  routes.set('/preview.js', {
    type: 'text/javascript',
    body: previewBuild.outputFiles.find((file) => file.path.endsWith('.js'))?.text ?? '',
  });
  routes.set('/preview.css', {
    type: 'text/css',
    body:
      tokens +
      '\n' +
      shellCss +
      '\n' +
      (previewBuild.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? ''),
  });
  routes.set('/live', {
    type: 'text/html',
    body: html('<div id="preview-root"></div>', 'phone', true),
  });
  server = createServer((request, response) => {
    const route = routes.get((request.url || '/').split('?')[0]);
    response.writeHead(route ? 200 : 404, { 'content-type': route?.type || 'text/plain' });
    response.end(route?.body || 'Not found');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  browser = await playwright.chromium.launch({
    executablePath: await chromiumPath(),
    headless: true,
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  if (process.env.PB_SKIP_ORIGINAL_PLAY !== '1') await originalObservation(page);
  page.on('pageerror', (error) => errors.push('Browser exception: ' + error.message));
  const reports = [];
  for (const spec of cases) {
    await page.setViewportSize(
      spec.surface === 'tv' ? { width: 1920, height: 1080 } : { width: 390, height: 844 },
    );
    await page.emulateMedia({ reducedMotion: spec.reduced ? 'reduce' : 'no-preference' });
    await page.goto(origin + '/' + spec.name + '.html', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(media, spec.name + '.png'), fullPage: false });
    const fit = await measure(page);
    reports.push({
      name: spec.name,
      surface: spec.surface,
      phase: spec.state.phase.id,
      phoneOnly: spec.phoneOnly,
      spectator: spec.viewer === 'spectator',
      reduced: spec.reduced,
      ...fit,
    });
    if (!fit.pass) errors.push(spec.name + ': viewport/content/control fit failed');
    process.stdout.write(
      `${spec.name}: ${fit.pass ? 'PASS' : 'FAIL'} (${fit.clipped.length} clipped text, ${fit.controls.length} controls)\n`,
    );
  }
  await writeFile(
    path.join(media, 'screen-fit.json'),
    JSON.stringify(reports, null, 2) + '\n',
    'utf8',
  );
  const interactions = await liveChecks(page);
  process.stdout.write(
    `Live controls: ${interactions.filter((check) => check.pass).length}/${interactions.length} passed\n`,
  );
} catch (error) {
  errors.push(error.stack || error.message);
} finally {
  if (browser)
    await browser.close().catch((error) => errors.push('Browser close: ' + error.message));
  if (server) await new Promise((resolve) => server.close(resolve));
  if (buildDir) {
    const resolved = await realpath(buildDir);
    const allowed = await realpath(path.join(root, 'node_modules'));
    assert(
      resolved.startsWith(allowed + path.sep) &&
        path.basename(resolved).startsWith('.dino-capture-'),
    );
    await rm(resolved, { recursive: true, force: true });
  }
}

const files = await inventory(media);
let totalBytes = 0;
const sums = [];
for (const file of files) {
  const absolute = path.join(media, file);
  totalBytes += (await stat(absolute)).size;
  sums.push(
    createHash('sha256')
      .update(await readFile(absolute))
      .digest('hex') +
      '  media/' +
      file,
  );
}
await writeFile(path.join(job, 'SHA256SUMS.txt'), sums.join('\n') + '\n', 'utf8');
process.stdout.write(
  `Media: ${files.length} files, ${totalBytes} bytes; SHA256SUMS.txt refreshed\n`,
);
if (totalBytes > 10 * 1024 * 1024) errors.push('Job media exceeds 10 MB');
if (errors.length) {
  process.stderr.write(errors.join('\n') + '\n');
  process.exitCode = 1;
}
