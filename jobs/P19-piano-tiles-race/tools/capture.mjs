// Capture our static test artifacts with one isolated Chrome process, always closed in finally.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const media = 'jobs/P19-piano-tiles-race/media';
const profile = mkdtempSync(join(tmpdir(), 'tile-tempo-r18-'));
const candidates =
  process.platform === 'win32'
    ? [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      ]
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executable = process.env.CHROME_PATH ?? candidates.find(existsSync);
if (!executable) throw new Error('Local Chrome unavailable; HTML artifacts remain reviewable.');
const browser = spawn(
  executable,
  [
    '--headless=new',
    '--no-first-run',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-extensions',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let serial = 0;
const pending = new Map();
let socket;
async function connect() {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let n = 0; !existsSync(portFile) && n < 300; n++)
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  if (!existsSync(portFile)) throw new Error('Chrome did not expose its isolated debugging port.');
  const [port, path] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const call = pending.get(message.id);
    if (call) {
      pending.delete(message.id);
      clearTimeout(call.timeout);
      if (message.error) call.reject(new Error(JSON.stringify(message.error)));
      else call.resolve(message.result);
    }
  });
}
function command(method, params = {}, sessionId) {
  return new Promise((resolveCall, reject) => {
    const id = ++serial;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timeout`));
    }, 30_000);
    pending.set(id, { resolve: resolveCall, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
const checks = [];
try {
  await connect();
  await command('Browser.getVersion');
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  await command('Page.enable', {}, sessionId);
  for (const screen of JSON.parse(readFileSync(`${media}/screens.json`, 'utf8'))) {
    await command(
      'Emulation.setDeviceMetricsOverride',
      { width: screen.width, height: screen.height, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    await command(
      'Page.navigate',
      { url: pathToFileURL(resolve(media, screen.file)).href },
      sessionId,
    );
    // A stable ready document is sufficient: these are script-free, network-free static renders.
    for (let n = 0; n < 20; n++) {
      const { result } = await command(
        'Runtime.evaluate',
        {
          expression: `document.readyState === 'complete' && location.href === ${JSON.stringify(pathToFileURL(resolve(media, screen.file)).href)}`,
          returnByValue: true,
        },
        sessionId,
      );
      if (result.value === true) break;
    }
    const { result } = await command(
      'Runtime.evaluate',
      {
        returnByValue: true,
        expression: `(() => {
      const box = document.querySelector('main').getBoundingClientRect();
      const buttons = [...document.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return {w:r.width,h:r.height,bottom:r.bottom}; });
      const children = [...document.querySelector('main').querySelectorAll('h2,p,li,button,b,strong,span')];
      const overflow = children.filter(el => { const r=el.getBoundingClientRect(); return r.top < box.top-1 || r.bottom > box.bottom+1 || r.right > box.right+1 || r.left < box.left-1; }).map(el => el.textContent.slice(0,100));
      return { viewport:[innerWidth,innerHeight], page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight], buttons,overflow };
    })()`,
      },
      sessionId,
    );
    const { data } = await command(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false },
      sessionId,
    );
    writeFileSync(`${media}/${screen.file.replace('.html', '.png')}`, Buffer.from(data, 'base64'));
    checks.push({ file: screen.file, ...result.value });
    console.log(
      `${screen.file}: overflow=${result.value.overflow.length}; buttons=${result.value.buttons.length}`,
    );
  }
  writeFileSync(`${media}/fit.json`, JSON.stringify(checks, null, 2) + '\n');
  const { readdirSync } = await import('node:fs');
  const hashes = readdirSync(media)
    .sort()
    .map(
      (file) =>
        `${createHash('sha256')
          .update(readFileSync(`${media}/${file}`))
          .digest('hex')}  media/${file}`,
    );
  writeFileSync('jobs/P19-piano-tiles-race/SHA256SUMS.txt', hashes.join('\n') + '\n');
  if (checks.some((s) => s.overflow.length || s.buttons.some((b) => b.w < 44 || b.h < 44)))
    process.exitCode = 1;
} finally {
  try {
    if (socket?.readyState === WebSocket.OPEN) await command('Browser.close');
    else browser.kill();
  } catch {
    browser.kill();
  }
  socket?.close();
  if (browser.exitCode === null)
    await new Promise((resolveExit) => {
      browser.once('exit', resolveExit);
      const fallback = setTimeout(() => {
        browser.kill();
        resolveExit();
      }, 3000);
      fallback.unref();
    });
  // Chrome's utility children can briefly retain profile files after its main process exits.
  await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  // Profile came from our own mkdtemp; verify its absolute containment before recursive cleanup.
  if (
    resolve(profile).startsWith(resolve(tmpdir()) + '\\') ||
    resolve(profile).startsWith(resolve(tmpdir()) + '/')
  )
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
