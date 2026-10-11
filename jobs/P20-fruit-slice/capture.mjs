// Single local Chromium, one recycled tab, closed in finally. No browser dependency required.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const media = join(root, 'jobs/P20-fruit-slice/media');
const profile = resolve(root, 'node_modules/.cache/r19-chrome');
if (!profile.startsWith(resolve(root, 'node_modules/.cache') + sep))
  throw new Error('Profile must stay in this workspace cache');
mkdirSync(profile, { recursive: true });
rmSync(join(profile, 'DevToolsActivePort'), { force: true });
const executable =
  process.env.CHROMIUM_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = spawn(
  executable,
  [
    '--headless=new',
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
let send;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!port) throw new Error('Chromium did not publish its local debug port');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', fail, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const events = new Map();
  socket.addEventListener('message', ({ data }) => {
    const value = JSON.parse(data);
    if (value.id) {
      const p = pending.get(value.id);
      pending.delete(value.id);
      if (value.error) p?.reject(new Error(value.error.message));
      else p?.resolve(value.result);
    } else {
      for (const listener of events.get(value.method) ?? []) listener(value.params);
      events.delete(value.method);
    }
  });
  send = (method, params = {}) =>
    new Promise((resolveResult, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve: resolveResult, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const once = (event) => new Promise((done) => events.set(event, [done]));
  await send('Page.enable');
  const report = [];
  for (const file of readdirSync(media).filter((name) => name.endsWith('.html'))) {
    const tv = file.startsWith('tv-');
    const width = tv ? 1920 : 390;
    const height = tv ? 1080 : 844;
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: !tv,
    });
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: pathToFileURL(join(media, file)).href });
    await loaded;
    const measurement = await send('Runtime.evaluate', {
      expression: `JSON.stringify((() => {
      const root = document.getElementById('root');
      const rect = root.getBoundingClientRect();
      const overflow = [...root.querySelectorAll('*')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width && r.height && (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.left < -1 || r.top < -1);
      }).map(e => ({tag:e.tagName, text:e.textContent.slice(0,60)}));
      return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,root:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},overflow};
    })())`,
      returnByValue: true,
    });
    const fit = JSON.parse(measurement.result.value);
    report.push({ file, ...fit });
    const png = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(join(media, file.replace('.html', '.png')), Buffer.from(png.data, 'base64'));
  }
  writeFileSync(join(media, 'fit-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      report.map(({ file, scrollWidth, scrollHeight, overflow }) => ({
        file,
        scrollWidth,
        scrollHeight,
        overflow,
      })),
    ),
  );
} finally {
  if (send && socket?.readyState === WebSocket.OPEN) {
    try {
      await Promise.race([send('Browser.close'), new Promise((r) => setTimeout(r, 2000))]);
    } catch {}
    socket.close();
  }
  if (browser.exitCode === null) {
    await Promise.race([
      new Promise((r) => browser.once('exit', r)),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    if (browser.exitCode === null) browser.kill();
  }
  if (process.platform === 'win32') {
    // Crashpad can outlive a closed browser on Windows; match only this verified private profile.
    const literal = profile.replace(/'/g, "''");
    spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$owned = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like '*--user-data-dir=${literal}*' }; foreach ($p in $owned) { Stop-Process -Id $p.ProcessId -ErrorAction SilentlyContinue }`,
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
  }
}
