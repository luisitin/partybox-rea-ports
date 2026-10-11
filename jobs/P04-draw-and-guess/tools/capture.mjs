// One local headless browser, closed in finally. Captures and measures standalone SSR evidence.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const browser = process.env.P04_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'p04-r2-'));
const dir = resolve('jobs/P04-draw-and-guess/media');
const processHandle = spawn(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
);
let socket;
let browserSocket;
let nextId = 0;
const pending = new Map();
function rpc(ws, method, params = {}) {
  const id = ++nextId;
  return new Promise((resolveCall, reject) => {
    pending.set(id, { resolve: resolveCall, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolveOpen, reject) => {
    ws.addEventListener('open', resolveOpen, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item?.reject(new Error(message.error.message));
    else item?.resolve(message.result);
  });
  ws.addEventListener('close', () => {
    for (const item of pending.values()) item.reject(new Error('Browser connection closed'));
    pending.clear();
  });
  return ws;
}
try {
  const endpoint = await new Promise((resolveEndpoint, reject) => {
    // Windows launchers may hand off to a child that does not inherit stderr.
    const probe = setInterval(() => {
      try {
        const [port, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8')
          .trim()
          .split(/\r?\n/);
        clearInterval(probe);
        clearTimeout(deadline);
        resolveEndpoint(`ws://127.0.0.1:${port}${path}`);
      } catch {
        /* The browser has not written its endpoint yet. */
      }
    }, 100);
    const deadline = setTimeout(() => {
      clearInterval(probe);
      reject(new Error('Browser did not start'));
    }, 15000);
    let stderr = '';
    processHandle.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr);
      if (match) {
        clearInterval(probe);
        clearTimeout(deadline);
        resolveEndpoint(match[1]);
      }
    });
    processHandle.on('error', reject);
  });
  browserSocket = await connect(endpoint);
  const { targetId } = await rpc(browserSocket, 'Target.createTarget', { url: 'about:blank' });
  const base = endpoint.slice(0, endpoint.indexOf('/devtools/'));
  const targets = await (await fetch(base.replace('ws:', 'http:') + '/json/list')).json();
  socket = await connect(targets.find((t) => t.id === targetId).webSocketDebuggerUrl);
  await rpc(socket, 'Page.enable');
  const reports = [];
  for (const name of readdirSync(dir)
    .filter((s) => s.endsWith('.html'))
    .sort()) {
    const tv = name.endsWith('-tv.html');
    const width = tv ? 1920 : 390;
    const height = tv ? 1080 : name.includes('-keyboard') ? 500 : 844;
    await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: !tv,
    });
    await rpc(socket, 'Page.navigate', { url: pathToFileURL(join(dir, name)).href });
    for (let i = 0; i < 40; i++) {
      const ready = await rpc(socket, 'Runtime.evaluate', {
        expression: 'document.readyState === "complete"',
        returnByValue: true,
      });
      if (ready.result.value) break;
      await new Promise((done) => setTimeout(done, 50));
    }
    await rpc(socket, 'Runtime.evaluate', {
      expression: 'document.fonts.ready',
      awaitPromise: true,
    });
    await rpc(socket, 'Runtime.evaluate', {
      expression: 'new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))',
      awaitPromise: true,
    });
    const geometry = await rpc(socket, 'Runtime.evaluate', {
      expression: `JSON.stringify({title:document.title,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,truncatedNames:[...document.querySelectorAll('[title]')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.title),buttons:[...document.querySelectorAll('button,input')].map(e=>({label:e.textContent||e.getAttribute('aria-label')||e.id,...Object.fromEntries(['x','y','width','height'].map(k=>[k,e.getBoundingClientRect()[k]]))})),overflow:[...document.querySelectorAll('h1,h2,p,li,button,input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.bottom>innerHeight+1||r.left< -1||r.top< -1)}).map(e=>e.textContent||e.id)})`,
      returnByValue: true,
    });
    reports.push({ file: name, ...JSON.parse(geometry.result.value) });
    const screenshot = await rpc(socket, 'Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(join(dir, name.replace('.html', '.png')), Buffer.from(screenshot.data, 'base64'));
    console.log(`CAPTURE ${name}: ${reports.at(-1).overflow.length} viewport overflows`);
  }
  writeFileSync(
    resolve('jobs/P04-draw-and-guess/tools/layout-results.json'),
    JSON.stringify(reports, null, 2) + '\n',
  );
} finally {
  if (browserSocket?.readyState === WebSocket.OPEN) {
    try {
      await rpc(browserSocket, 'Browser.close');
    } catch {
      /* Closing can race the reply. */
    }
  }
  socket?.close();
  browserSocket?.close();
  if (processHandle.exitCode === null) {
    spawnSync('taskkill.exe', ['/PID', String(processHandle.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  }
}
