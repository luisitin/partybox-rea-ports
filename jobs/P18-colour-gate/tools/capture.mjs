// Capture the port's static phase renders with one isolated Chromium, always closed.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const media = resolve(dirname(fileURLToPath(import.meta.url)), '../media');
const profile = mkdtempSync(join(tmpdir(), 'r17-colour-gate-'));
const executable =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = spawn(
  executable,
  [
    '--headless',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let socket;
let sequence = 0;
const pending = new Map();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const command = (method, params = {}, sessionId) =>
  new Promise((accept, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 15000);
    pending.set(id, { accept, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

try {
  let port;
  for (let attempts = 0; attempts < 100; attempts++) {
    try {
      port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split('\n');
      break;
    } catch {
      await sleep(100);
    }
  }
  if (!port) throw new Error('Isolated Chromium did not start');
  socket = new WebSocket(`ws://127.0.0.1:${port[0]}${port[1]}`);
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const entry = pending.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.accept(message.result);
  });
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  await command('Page.enable', {}, sessionId);
  const checks = [];
  for (const file of readdirSync(media).filter((name) => name.endsWith('.html'))) {
    const tv = file.includes('tv');
    const width = tv ? 1920 : 390;
    const height = tv ? 1080 : 844;
    await command(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    await command('Page.navigate', { url: pathToFileURL(join(media, file)).href }, sessionId);
    await sleep(180);
    const { result } = await command(
      'Runtime.evaluate',
      {
        expression: `JSON.stringify({ width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,buttons:[...document.querySelectorAll('button')].map(e=>({text:e.innerText,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),headings:[...document.querySelectorAll('h1,h2')].map(e=>({text:e.innerText,font:getComputedStyle(e).fontSize})),bodyFont:getComputedStyle(document.body).fontSize })`,
        returnByValue: true,
      },
      sessionId,
    );
    const check = { file, ...JSON.parse(result.value) };
    checks.push(check);
    const { data } = await command(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false },
      sessionId,
    );
    writeFileSync(join(media, `${basename(file, '.html')}.png`), Buffer.from(data, 'base64'));
    console.log(JSON.stringify(check));
  }
  writeFileSync(join(media, 'layout.json'), `${JSON.stringify(checks, null, 2)}\n`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await command('Browser.close').catch(() => undefined);
    socket.close();
  }
  if (browser.exitCode === null) browser.kill();
  for (const entry of pending.values()) {
    clearTimeout(entry.timeout);
    entry.reject(new Error('Browser closed'));
  }
  await sleep(500);
  const safeRoot = resolve(tmpdir()) + sep;
  if (resolve(profile).startsWith(safeRoot) && basename(profile).startsWith('r17-colour-gate-'))
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}
