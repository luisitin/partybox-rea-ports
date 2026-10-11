// One disposable headless Chrome, sequential static captures, closed unconditionally.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const chrome = process.env.P14_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!existsSync(chrome)) throw new Error('Set P14_CHROME to an existing Chromium executable.');
const media = resolve('jobs/P14-crossy-streets/media');
const profile = mkdtempSync(join(tmpdir(), 'p14-capture-'));
const child = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    '--renderer-process-limit=1',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
);
let ws;
try {
  const url = await new Promise((accept, reject) => {
    const timer = setTimeout(() => {
      clearInterval(poll);
      reject(new Error('Chromium debugging endpoint timed out'));
    }, 45_000);
    // GUI-subsystem Chromium on Windows may not forward stderr to its parent.
    const poll = setInterval(() => {
      const activePort = join(profile, 'DevToolsActivePort');
      if (!existsSync(activePort)) return;
      const [port, path] = readFileSync(activePort, 'utf8').trim().split(/\r?\n/);
      if (!port || !path) return;
      clearInterval(poll);
      clearTimeout(timer);
      accept(`ws://127.0.0.1:${port}${path}`);
    }, 100);
    let output = '';
    child.once('error', (error) => {
      clearTimeout(timer);
      clearInterval(poll);
      reject(error);
    });
    child.stderr.on('data', (data) => {
      output += String(data);
      const endpoint = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (endpoint) {
        clearTimeout(timer);
        clearInterval(poll);
        accept(endpoint[1]);
      }
    });
  });
  ws = new WebSocket(url);
  await new Promise((accept, reject) => {
    ws.addEventListener('open', accept, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  ws.addEventListener('message', (message) => {
    const data = JSON.parse(message.data);
    if (!data.id) return;
    const promise = pending.get(data.id);
    if (!promise) return;
    pending.delete(data.id);
    clearTimeout(promise.timer);
    if (data.error) promise.reject(new Error(data.error.message));
    else promise.accept(data.result);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((accept, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 60_000);
      pending.set(id, { accept, reject, timer });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetInfos } = await send('Target.getTargets');
  const targetId = targetInfos.find((target) => target.type === 'page')?.targetId;
  if (!targetId) throw new Error('The disposable browser has no page target.');
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params = {}) => send(method, params, sessionId);
  await page('Page.enable');
  const records = [];
  for (const file of readdirSync(media)
    .filter((file) => file.endsWith('.html'))
    .sort()) {
    const tv = file.includes('-tv.');
    const width = tv ? 1920 : 390;
    const height = tv ? 1080 : 844;
    await page('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: !tv,
    });
    const pageUrl = pathToFileURL(resolve(media, file)).href;
    const navigation = await page('Page.navigate', { url: pageUrl });
    if (navigation.errorText) throw new Error(navigation.errorText);
    let loaded = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const { result } = await page('Runtime.evaluate', {
        expression: `document.readyState === 'complete' && location.href === ${JSON.stringify(pageUrl)}`,
        returnByValue: true,
      });
      if (result.value) {
        loaded = true;
        break;
      }
      await new Promise((accept) => setTimeout(accept, 50));
    }
    if (!loaded) throw new Error(`${file} did not load`);
    await page('Runtime.evaluate', {
      expression:
        'document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))',
      awaitPromise: true,
    });
    const { result } = await page('Runtime.evaluate', {
      expression: `JSON.stringify((()=>{const main=document.querySelector('main'),bounds=main.getBoundingClientRect();const elements=[...main.querySelectorAll('h1,h2,p,li,button')];const clipped=elements.filter(el=>{const r=el.getBoundingClientRect();return r.bottom>bounds.bottom+1||r.right>bounds.right+1||r.left<bounds.left-1||r.top<bounds.top-1}).map(el=>el.textContent.trim());const buttons=[...main.querySelectorAll('button')].map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label'),width:r.width,height:r.height}});return {viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],main:[main.clientWidth,main.clientHeight,main.scrollWidth,main.scrollHeight],clipped,buttons}})())`,
      returnByValue: true,
    });
    const metrics = JSON.parse(result.value);
    const { data } = await page('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(resolve(media, file.replace('.html', '.png')), Buffer.from(data, 'base64'));
    const fit =
      metrics.document[0] <= width &&
      metrics.document[1] <= height &&
      metrics.clipped.length === 0 &&
      metrics.buttons.every((button) => button.width >= 44 && button.height >= 44);
    records.push({ file, fit, ...metrics });
    console.log(`${file}: ${fit ? 'FIT' : 'CHECK'} ${JSON.stringify(metrics)}`);
  }
  writeFileSync(
    resolve('jobs/P14-crossy-streets/screen-metrics.json'),
    JSON.stringify(
      {
        command: 'node jobs/P14-crossy-streets/capture.mjs',
        browser: 'one headless Chromium, static files only, finally close',
        records,
      },
      null,
      2,
    ) + '\n',
  );
  if (records.some((record) => !record.fit)) process.exitCode = 1;
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    // Close the complete disposable browser tree even when a capture fails.
    ws.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
    await new Promise((accept) => {
      ws.addEventListener('close', accept, { once: true });
      const timeout = setTimeout(accept, 5000);
      timeout.unref();
    });
  }
  ws?.close();
  if (child.exitCode === null) {
    // Only this script's disposable browser process is eligible for termination.
    child.kill();
    await new Promise((accept) => {
      child.once('exit', accept);
      const timeout = setTimeout(accept, 5000);
      timeout.unref();
    });
  }
}
