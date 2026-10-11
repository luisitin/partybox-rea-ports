// One native Chromium instance, always closed in finally; no browser dependencies.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const folder = resolve('jobs/P10-word-guess-race/media');
const chromePath =
  process.env.P10_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = await mkdtemp(join(tmpdir(), 'p10-r9-'));
const server = createServer(async (request, response) => {
  try {
    const name = decodeURIComponent((request.url ?? '/').slice(1));
    if (!/^[\w-]+\.html$/.test(name)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(await readFile(join(folder, name)));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
let browser;
let socket;
const pending = new Map();
let nextId = 0;
function call(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
try {
  browser = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  console.log('Starting one Chromium browser');
  let ws;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const [debugPort, debugPath] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8'))
        .trim()
        .split('\n');
      ws = `ws://127.0.0.1:${debugPort}/${debugPath.replace(/^\//, '')}`;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  if (!ws) throw new Error('Chrome startup timeout');
  console.log('Chromium debugging connected');
  const debugBase = ws.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.*$/, '');
  const tabs = await (await fetch(`${debugBase}/json/list`)).json();
  socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(JSON.stringify(message.error)));
    else item.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('Chromium closed'));
    }
    pending.clear();
  });
  await call('Page.enable');
  const report = [];
  for (const file of (await readdir(folder)).filter((name) => name.endsWith('.html')).sort()) {
    const tv = file.endsWith('-tv.html');
    const width = tv ? 1920 : 390;
    const height = tv ? 1080 : 844;
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: !tv,
    });
    await call('Page.navigate', { url: `http://127.0.0.1:${port}/${file}` });
    // Local pages have no runtime or external assets; two animation frames settle all layout.
    await call('Runtime.evaluate', {
      expression: 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',
      awaitPromise: true,
    });
    const { result } = await call('Runtime.evaluate', {
      expression: `JSON.stringify((()=>{const nodes=[...document.querySelectorAll('button, h2, [role="timer"], [role="img"], section')];return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,body:document.body.innerText,buttons:[...document.querySelectorAll('button')].map(e=>({text:e.innerText,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),overflow:nodes.filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+.5||r.bottom>innerHeight+.5||r.left<-.5||r.top<-.5}).map(e=>e.outerHTML.slice(0,180)),fontSize:parseFloat(getComputedStyle(document.querySelector('[role="timer"]')??document.body).fontSize)}})())`,
      returnByValue: true,
    });
    const metrics = JSON.parse(result.value);
    report.push({ file, ...metrics });
    const shot = await call('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(join(folder, file.replace('.html', '.png')), Buffer.from(shot.data, 'base64'));
    console.log(
      `${file}: ${metrics.scrollWidth}x${metrics.scrollHeight}, overflow ${metrics.overflow.length}`,
    );
  }
  await writeFile(join(folder, 'layout.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (
    report.some(
      (r) =>
        r.scrollWidth > r.width ||
        r.scrollHeight > r.height ||
        r.overflow.length ||
        r.buttons.some((b) => b.width < 43.9 || b.height < 43.9),
    )
  )
    throw new Error('Screen fit or target size check failed; inspect layout.json and PNGs');
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await call('Browser.close');
    } catch {
      /* Kill only our spawned browser below. */
    }
    socket.close();
  }
  if (browser && browser.exitCode === null) {
    const exited = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
  }
  browser?.stderr?.destroy();
  browser?.unref();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  // The verified absolute target was allocated by mkdtemp under tmpdir for this invocation.
  if (profile.startsWith(join(tmpdir(), 'p10-r9-'))) {
    try {
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      console.error(`Temporary profile retained: ${error.message}`);
    }
  }
}
