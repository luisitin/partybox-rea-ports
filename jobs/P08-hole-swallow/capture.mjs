// One headless Chrome for this game's static artifacts only. It is always closed in finally.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const candidates = process.env.CHROME_PATH
  ? [process.env.CHROME_PATH]
  : [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
    ];
const executable = candidates.find(existsSync);
if (!executable) throw new Error('Chrome not found; set CHROME_PATH to an installed browser.');
const profile = resolve(`.git/r2-p08-chrome-${process.pid}`);
mkdirSync(profile, { recursive: true });
const media = resolve(process.env.PB_P08_CAPTURE_DIR ?? 'jobs/P08-hole-swallow/media');
const files = JSON.parse(readFileSync(resolve(media, 'index.json'), 'utf8'));
const allowed = new Set([...files, 'styles.css', 'hydrate.js', 'nunito-latin-wght-normal.woff2']);
const server = createServer((req, res) => {
  const name = req.url?.slice(1);
  if (!allowed.has(name)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader(
    'Content-Type',
    name.endsWith('.css')
      ? 'text/css'
      : name.endsWith('.woff2')
        ? 'font/woff2'
        : name.endsWith('.js')
          ? 'text/javascript'
          : 'text/html',
  );
  res.end(readFileSync(resolve(media, name)));
});
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = spawn(
  executable,
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
writeFileSync(resolve(profile, 'runner-browser-pid.txt'), String(browser.pid));
const exited = new Promise((res) => browser.once('exit', res));
let socket;
try {
  const portFile = resolve(profile, 'DevToolsActivePort');
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    if (existsSync(portFile)) port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
    if (!port) await delay(100);
  }
  if (!port) throw new Error('Chrome did not start a debugging endpoint.');
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(10_000) })
  ).json();
  const target = targets.find((t) => t.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    const timeout = setTimeout(() => rej(new Error('Capture connection timed out')), 10000);
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timeout);
        res();
      },
      { once: true },
    );
    socket.addEventListener(
      'error',
      (error) => {
        clearTimeout(timeout);
        rej(error);
      },
      { once: true },
    );
  });
  const pending = new Map();
  socket.addEventListener('close', () => {
    for (const p of pending.values()) p.reject(new Error('Capture connection closed'));
    pending.clear();
  });
  let serial = 0;
  socket.addEventListener('message', (event) => {
    const value = JSON.parse(event.data);
    if (!value.id) return;
    const p = pending.get(value.id);
    if (!p) return;
    pending.delete(value.id);
    value.error ? p.reject(new Error(JSON.stringify(value.error))) : p.resolve(value.result);
  });
  const command = (method, params = {}) =>
    new Promise((resolveCommand, reject) => {
      const id = ++serial;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Capture command timed out: ${method}`));
      }, 15_000);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolveCommand(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  await command('Page.enable');
  const checks = [];
  for (const file of files) {
    const tv = file.endsWith('-tv.html') && !file.endsWith('-phone-tv.html');
    const width = tv ? 1920 : 390,
      height = tv ? 1080 : 844;
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: !tv,
    });
    console.log(`Capturing ${file}`);
    await command('Page.navigate', { url: `${baseUrl}/${file}` });
    for (let i = 0; i < 50; i++) {
      const ready = await command('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      });
      if (ready.result.value === 'complete') break;
      await delay(50);
    }
    await command('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(()=>true)',
      awaitPromise: true,
    });
    await command('Runtime.evaluate', {
      expression:
        'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(window.p08Ready))))',
      awaitPromise: true,
      returnByValue: true,
    });
    const measurement = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `JSON.stringify((()=>{const stage=document.querySelector('#stage').getBoundingClientRect(),visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;return {width:innerWidth,height:innerHeight,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,ready:window.p08Ready,cityCameras:document.querySelectorAll('[data-camera]').length,svgNodes:document.querySelectorAll('#stage svg *').length,overflow:Array.from(document.querySelectorAll('#stage *')).filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg'&&e.clientHeight>0&&e.scrollHeight>e.clientHeight+2&&getComputedStyle(e).overflowY!=='hidden'&&getComputedStyle(e).overflowY!=='clip').map(e=>({tag:e.tagName,class:e.className,height:e.clientHeight,scroll:e.scrollHeight})),outside:Array.from(document.querySelectorAll('#stage button,#stage h2,#stage h3,#stage li')).filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.bottom>stage.bottom+2||r.top<stage.top-2||r.left<stage.left-2||r.right>stage.right+2}).map(e=>({tag:e.tagName,text:e.textContent.slice(0,60)})),tooSmall:${tv ? "Array.from(document.querySelectorAll('#stage h2,#stage h3,#stage li,#stage span,#stage p,#stage b,#stage strong')).filter(visible).filter(e=>e.childElementCount===0&&e.textContent.trim()&&parseFloat(getComputedStyle(e).fontSize)<32).map(e=>({text:e.textContent.slice(0,60),size:getComputedStyle(e).fontSize}))" : '[]'},timers:Array.from(document.querySelectorAll('#stage [role=timer]')).map(e=>({text:e.textContent,size:getComputedStyle(e).fontSize})),uiUndefined:Array.from(document.querySelectorAll('#stage [class]')).filter(e=>e.getAttribute('class').includes('undefined')).length};})())`,
    });
    const check = { file, ...JSON.parse(measurement.result.value) };
    checks.push(check);
    const screenshot = await command('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(
      resolve(media, file.replace('.html', '.png')),
      Buffer.from(screenshot.data, 'base64'),
    );
    console.log(
      `${file}: ${check.width}x${check.height}, overflow=${check.overflow.length}, outside=${check.outside.length}`,
    );
  }
  writeFileSync(resolve(media, 'fit.json'), JSON.stringify(checks, null, 2) + '\n');
} finally {
  server.closeAllConnections();
  server.close();
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (browser.exitCode === null && browser.signalCode === null) {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 5000,
      });
    } else browser.kill();
    await Promise.race([exited, delay(3000)]);
  }
}
