// One isolated headless Chrome, closed in finally. No package or browser dependency is installed.
import { spawn, spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

const folder = resolve('jobs/P07-paper-territory');
const media = join(folder, 'media');
const profile = join(folder, `.browser-profile-${process.pid}`);
const browserCache = join(
  process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
  'ms-playwright',
);
const cachedVersions = (await readdir(browserCache).catch(() => []))
  .filter((name) => name.startsWith('chromium_headless_shell-'))
  .sort()
  .reverse();
const chrome =
  process.env.PB_CHROME ??
  (cachedVersions[0]
    ? join(
        browserCache,
        cachedVersions[0],
        'chrome-headless-shell-win64',
        'chrome-headless-shell.exe',
      )
    : undefined);
if (!chrome)
  throw new Error(
    'Set PB_CHROME to an existing Chromium executable; no browser is installed by this tool.',
  );
if (resolve(profile) !== resolve(folder, `.browser-profile-${process.pid}`))
  throw new Error('Invalid task-local profile');
await rm(profile, { recursive: true, force: true });
await mkdir(profile, { recursive: true });
const child = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
);
let socket;
let id = 0;
const requests = new Map();
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
function call(method, params = {}, sessionId) {
  return new Promise((done, fail) => {
    const seq = ++id;
    const timeout = setTimeout(() => {
      requests.delete(seq);
      fail(new Error(`Timed out: ${method}`));
    }, 15_000);
    requests.set(seq, { done, fail, timeout });
    socket.send(JSON.stringify({ id: seq, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
try {
  let active;
  for (let i = 0; i < 100; i++) {
    try {
      active = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n');
      break;
    } catch {
      await delay(100);
    }
  }
  if (!active) throw new Error('Chrome did not expose its isolated debugging port');
  socket = new WebSocket(`ws://127.0.0.1:${active[0]}${active[1].trim()}`);
  await new Promise((done, fail) => {
    socket.onopen = done;
    socket.onerror = fail;
  });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const request = requests.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    requests.delete(message.id);
    if (message.error) request.fail(new Error(message.error.message));
    else request.done(message.result);
  };
  socket.onclose = () => {
    for (const request of requests.values()) {
      clearTimeout(request.timeout);
      request.fail(new Error('Chrome closed'));
    }
    requests.clear();
  };
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => call(method, params, sessionId);
  await page('Page.enable');
  const records = [];
  const files = (await readdir(media))
    .filter((name) => name.endsWith('.html') && !name.startsWith('contact-'))
    .sort();
  for (const name of files) {
    const tv = name.includes('-tv.');
    const width = tv ? 1920 : 390;
    const height = tv ? 1080 : 844;
    await page('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: !tv,
    });
    await page('Page.navigate', { url: pathToFileURL(join(media, name)).href });
    await delay(100);
    const { result } = await page('Runtime.evaluate', {
      expression: `(() => {
      const bounds = e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
      const visible=[...document.querySelectorAll('main button, main input, main h2, main svg, main li')];
      return {width:innerWidth,height:innerHeight,overflowX:document.documentElement.scrollWidth-innerWidth,overflowY:document.documentElement.scrollHeight-innerHeight,
        outside:visible.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left < -1||r.top < -1||r.right > innerWidth+1||r.bottom > innerHeight+1);}).map(e=>({tag:e.tagName,text:e.textContent?.slice(0,60),...bounds(e)})),
        touch:[...document.querySelectorAll('button,input')].filter(e=>!e.disabled).map(e=>({text:e.getAttribute('aria-label')||e.textContent,...bounds(e)})),
        internalScroll:[...document.querySelectorAll('main *')].filter(e=>e.scrollHeight>e.clientHeight+2&&['auto','scroll'].includes(getComputedStyle(e).overflowY)).map(e=>e.className)};
    })()`,
      returnByValue: true,
    });
    records.push({ file: name, ...result.value });
    const shot = await page('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(join(media, name.replace('.html', '.png')), Buffer.from(shot.data, 'base64'));
    if (records.length % 6 === 0) console.log(`Captured ${records.length}/${files.length} screens`);
  }
  await writeFile(join(media, 'fit-report.json'), JSON.stringify(records, null, 2) + '\n');
  for (const mode of ['tv', 'phone', 'phone-only']) {
    const items = ['ready', 'play', 'score', 'done']
      .map(
        (phase) =>
          `<figure><figcaption>${phase} · ${mode}</figcaption><img src="${phase}-${mode}.png"></figure>`,
      )
      .join('');
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0f1020;color:#f5f6ff;font:24px system-ui;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}figure{margin:0}figcaption{padding:8px}img{display:block;width:100%;height:auto}</style>${items}`;
    const name = `contact-${mode}.html`;
    await writeFile(join(media, name), html);
    const width = mode === 'tv' ? 1600 : 800;
    const height = mode === 'tv' ? 1010 : 1830;
    await page('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page('Page.navigate', { url: pathToFileURL(join(media, name)).href });
    await delay(150);
    const shot = await page('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(join(media, name.replace('.html', '.png')), Buffer.from(shot.data, 'base64'));
  }
  const outside = records.filter(
    (record) =>
      record.outside.length ||
      record.overflowX > 1 ||
      record.overflowY > 1 ||
      record.internalScroll.length,
  );
  console.log(
    JSON.stringify({
      screens: records.length,
      fitFailures: outside,
      smallestTouch: Math.min(
        ...records.flatMap((record) => record.touch.map((box) => Math.min(box.w, box.h))),
      ),
    }),
  );
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await call('Browser.close');
    } catch {
      /* Chrome closes its socket with the process. */
    }
    socket.close();
  }
  if (child.exitCode === null) {
    await delay(500);
    if (child.exitCode === null) child.kill();
  }
  // Only the process started above and its children; never another runner's browser.
  if (child.exitCode === null)
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  await delay(500);
  // Verified task-local absolute target before recursive cleanup on Windows.
  if (resolve(profile) !== resolve(folder, `.browser-profile-${process.pid}`))
    throw new Error('Profile cleanup escaped the job');
  try {
    await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
  } catch (error) {
    if (error.code !== 'EBUSY') throw error;
  }
  const entries = [];
  for (const name of (await readdir(media)).sort()) {
    const bytes = await readFile(join(media, name));
    entries.push(`${createHash('sha256').update(bytes).digest('hex')}  media/${name}`);
  }
  await writeFile(join(folder, 'SHA256SUMS.txt'), entries.join('\n') + '\n');
}
