// One headless browser, one reused page, always closed in finally. No browser dependency needed.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const media = resolve('jobs/P12-flappy-lanes/media');
const captureTemp = resolve(tmpdir());
const profile = mkdtempSync(join(captureTemp, 'partybox-flappy-r13-'));
const browserPath =
  process.env.FLAPPY_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-background-mode',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let websocket;
let closed = false;
browser.on('exit', () => {
  closed = true;
});
const pending = new Map();
const listeners = new Map();
let nextId = 0;
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const command = (method, params = {}, sessionId) =>
  new Promise((done, reject) => {
    const id = ++nextId;
    pending.set(id, { done, reject });
    websocket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
const nextEvent = (method) =>
  new Promise((done) => {
    listeners.set(method, done);
  });
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100 && !existsSync(portFile); attempt++) {
    if (closed) throw new Error('Browser stopped before debugger startup');
    await pause(100);
  }
  const [port, endpoint] = readFileSync(portFile, 'utf8').trim().split('\n');
  websocket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((done, reject) => {
    websocket.onopen = done;
    websocket.onerror = reject;
  });
  websocket.onmessage = (event) => {
    const packet = JSON.parse(event.data);
    if (packet.id) {
      const waiter = pending.get(packet.id);
      pending.delete(packet.id);
      if (packet.error) waiter?.reject(new Error(packet.error.message));
      else waiter?.done(packet.result);
    } else if (listeners.has(packet.method)) {
      listeners.get(packet.method)(packet.params);
      listeners.delete(packet.method);
    }
  };
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  await command('Page.enable', {}, sessionId);
  const files = JSON.parse(readFileSync(join(media, 'index.json'), 'utf8'));
  const report = [];
  for (const file of files) {
    const tv = file.endsWith('-tv.html');
    const width = tv ? 1920 : 390;
    const height = tv ? 1080 : 844;
    await command(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile: !tv },
      sessionId,
    );
    const load = nextEvent('Page.loadEventFired');
    await command('Page.navigate', { url: pathToFileURL(join(media, file)).href }, sessionId);
    await load;
    const fit = await command(
      'Runtime.evaluate',
      {
        returnByValue: true,
        expression: `JSON.stringify({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,buttons:[...document.querySelectorAll('button')].map(e=>({text:e.innerText,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),outside:[...document.querySelectorAll('h1,h2,li,button,svg,section')].filter(e=>{const r=e.getBoundingClientRect();return r.left< -0.5||r.right>innerWidth+0.5||r.top< -0.5||r.bottom>innerHeight+0.5}).map(e=>e.tagName+':'+(e.innerText||e.getAttribute('aria-label')||'').slice(0,50)),timerSizes:[...document.querySelectorAll('[role=timer] strong')].map(e=>getComputedStyle(e).fontSize)})`,
      },
      sessionId,
    );
    const metrics = JSON.parse(fit.result.value);
    const shot = await command(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false },
      sessionId,
    );
    writeFileSync(join(media, file.replace('.html', '.png')), Buffer.from(shot.data, 'base64'));
    report.push({ file, ...metrics });
    console.log(
      `${file}: ${metrics.scrollWidth}×${metrics.scrollHeight}, outside ${metrics.outside.length}`,
    );
  }
  writeFileSync(join(media, 'fit.json'), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  // Close the exact process tree while its launcher still exists, including crash reporters.
  if (browser.pid)
    spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  websocket?.close();
  for (let attempt = 0; attempt < 30 && !closed; attempt++) await pause(100);
  if (!closed) browser.kill();
  if (dirname(profile) !== captureTemp || !basename(profile).startsWith('partybox-flappy-r13-'))
    throw new Error('Refusing unexpected profile cleanup');
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'EBUSY') throw error;
    console.warn(`Browser closed; Windows retained temporary profile: ${profile}`);
  }
}
process.exit(0);
