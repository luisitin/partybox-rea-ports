// Run from the public clone: one isolated browser, never the owner's browser/port.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createCDP } from './cdp.mjs';
import { closeBrowserProfile } from './close-browser.mjs';
import { nativeChecks } from './native-checks.mjs';
import { verifyClosedProfile } from '../capture-browser.mjs';

const folder = dirname(fileURLToPath(import.meta.url));
const repo = resolve(folder, '../../..');
const require = createRequire(import.meta.url);
const vr = createRequire(require.resolve('vitest/package.json'));
const { createServer } = await import(pathToFileURL(vr.resolve('vite')).href);
const server = await createServer({
  root: repo,
  configFile: false,
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'zod'],
  },
  clearScreen: false,
  logLevel: 'warn',
  resolve: {
    alias: {
      '@partybox/shared': resolve(repo, 'packages/shared/src/index.ts'),
      '@partybox/game-sdk/ui': resolve(repo, 'packages/game-sdk/src/ui.ts'),
      '@partybox/game-sdk/match': resolve(repo, 'packages/game-sdk/src/match.ts'),
      '@partybox/game-sdk': resolve(repo, 'packages/game-sdk/src/index.ts'),
    },
  },
  server: { host: '127.0.0.1', port: 0, cors: true },
  appType: 'mpa',
});
server.middlewares.use((request, response, next) => {
  if (request.url !== '/__p02_native_origin') return next();
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end('<!doctype html><html><head></head><body></body></html>');
});
const browser =
  process.env.P02_BROWSER ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);
const { rpc, connect } = createCDP();
const checks = [];
let processHandle;
let profile;
let socket;
let browserSocket;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

try {
  await server.listen();
  if (!browser) throw new Error('No browser binary; set P02_BROWSER to Chrome or Edge');
  profile = mkdtempSync(join(tmpdir(), 'p02-r2-'));
  processHandle = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--disable-background-networking',
      '--disable-sync',
      '--mute-audio',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
  );
  const endpoint = await browserEndpoint(processHandle, profile);
  browserSocket = await connect(endpoint);
  const { targetId } = await rpc(browserSocket, 'Target.createTarget', { url: 'about:blank' });
  const base = endpoint.slice(0, endpoint.indexOf('/devtools/')).replace('ws:', 'http:');
  const targets = await (
    await fetch(`${base}/json/list`, { signal: AbortSignal.timeout(15_000) })
  ).json();
  const target = targets.find((entry) => entry.id === targetId);
  if (!target) throw new Error('Isolated target not found');
  socket = await connect(target.webSocketDebuggerUrl);
  await rpc(socket, 'Page.enable');
  await rpc(socket, 'Runtime.enable');
  await rpc(browserSocket, 'Target.activateTarget', { targetId });
  async function viewport(surface) {
    await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
      width: surface === 'tv' ? 1920 : 390,
      height: surface === 'tv' ? 1080 : 844,
      deviceScaleFactor: 1,
      mobile: surface !== 'tv',
    });
  }
  await viewport('phone');
  const address = server.httpServer.address();
  // Establish a real local origin so the SDK sessionStorage draft behaves as it does in the host.
  await rpc(socket, 'Page.navigate', { url: `http://127.0.0.1:${address.port}/__p02_native_origin` });
  const url = `http://127.0.0.1:${address.port}/jobs/P02-quiz-rush-teams/tools/live.html`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Native harness HTML failed: ${response.status}`);
  const html = (await response.text()).replace('<head>', `<head><base href="${url}">`);
  const { frameTree } = await rpc(socket, 'Page.getFrameTree');
  // Exact Vite-served HTML in the active target avoids Windows' intermittent navigation stall.
  await rpc(socket, 'Page.setDocumentContent', { frameId: frameTree.frame.id, html });
  async function evaluate(expression) {
    const result = await rpc(socket, 'Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
      );
    return result.result?.value;
  }
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    ready = await evaluate('Boolean(window.p02 && document.querySelector("#root h2"))');
    if (ready) break;
    await wait(100);
  }
  if (!ready) throw new Error('Native game did not mount within 10 seconds');
  const settle = () =>
    evaluate(
      'new Promise(resolve => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 180))',
    );
  async function tap(selector, index = 0) {
    const point = await evaluate(`(() => {
      const element=document.querySelectorAll(${JSON.stringify(selector)})[${index}];
      if(!element)throw new Error('Missing native tap target');
      const r=element.getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2};
    })()`);
    await rpc(socket, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...point,
      button: 'left',
      clickCount: 1,
    });
    await rpc(socket, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...point,
      button: 'left',
      clickCount: 1,
    });
  }
  function check(condition, label, detail) {
    if (!condition)
      throw new Error(
        `Native assertion failed: ${label}${detail ? `\n${JSON.stringify(detail, null, 2)}` : ''}`,
      );
    checks.push({ number: checks.length + 1, label, ...(detail === undefined ? {} : { detail }) });
  }
  const screenshot = async () =>
    (await rpc(socket, 'Page.captureScreenshot', { format: 'png' })).data;
  await settle();
  const { layouts, images } = await nativeChecks({
    evaluate,
    settle,
    tap,
    viewport,
    screenshot,
    check,
  });
  const report = {
    ok: true,
    capturedAt: new Date().toISOString(),
    assertions: checks.length,
    checks,
    layouts,
    screenshots: images.map(([name]) => name),
    harness:
      'Real SDK providers, Controller, Tv, reducer; one isolated browser; 8 long-name players',
  };
  // No new success evidence is written until every assertion has passed.
  const media = resolve(folder, '../media');
  mkdirSync(media, { recursive: true });
  for (const [name, data] of images) writeFileSync(join(media, name), Buffer.from(data, 'base64'));
  writeFileSync(join(media, 'native-results.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(
    `P02 native checks: ${checks.length} assertions passed; ${layouts.length} phase/surface measurements.`,
  );
} catch (error) {
  console.error(error.stack ?? error);
  process.exitCode = 1;
} finally {
  if (browserSocket) {
    await Promise.race([rpc(browserSocket, 'Browser.close').catch(() => undefined), wait(3000)]);
  }
  socket?.close();
  browserSocket?.close();
  if (profile) closeBrowserProfile(profile);
  if (processHandle?.pid && processHandle.exitCode === null) {
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(processHandle.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 5000,
      });
    else processHandle.kill('SIGKILL');
  }
  await Promise.race([server.close(), wait(5000)]);
  if (profile && !verifyClosedProfile(profile)) {
    console.error(`Could not confirm the owned native browser is closed: ${profile}`);
    process.exitCode = 1;
  }
  // The resolved absolute path is checked before deleting our own temporary profile.
  if (
    profile &&
    dirname(resolve(profile)) === resolve(tmpdir()) &&
    basename(profile).startsWith('p02-r2-')
  ) {
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      /* Windows can retain a closed profile lock briefly. */
    }
  }
}

function browserEndpoint(child, browserProfile) {
  return new Promise((resolveEndpoint, reject) => {
    let finished = false;
    let stderr = '';
    const finish = (error, endpoint) => {
      if (finished) return;
      finished = true;
      clearInterval(probe);
      clearTimeout(deadline);
      child.removeListener('error', onError);
      if (error) reject(error);
      else resolveEndpoint(endpoint);
    };
    const onError = (error) => finish(error);
    const probe = setInterval(() => {
      try {
        const [port, path] = readFileSync(join(browserProfile, 'DevToolsActivePort'), 'utf8')
          .trim()
          .split(/\r?\n/);
        finish(undefined, `ws://127.0.0.1:${port}${path}`);
      } catch {
        /* Endpoint not written yet. */
      }
    }, 100);
    const deadline = setTimeout(
      () => finish(new Error('Browser did not start within 15 seconds')),
      15_000,
    );
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr);
      if (match) finish(undefined, match[1]);
    });
    child.on('error', onError);
  });
}
