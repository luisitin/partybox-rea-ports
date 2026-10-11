// Local static captures with one installed Edge process, always closed in finally; no package deps.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const executable = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!executable)
  throw new Error('Installed Edge not found; SSR HTML remains the capture fallback.');
const profile = resolve(`.git/helix-capture-${process.pid}`);
mkdirSync(profile, { recursive: true });
const oldPort = resolve(profile, 'DevToolsActivePort');
if (existsSync(oldPort)) unlinkSync(oldPort);
const child = spawn(
  executable,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let socket;
try {
  const portFile = resolve(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !existsSync(portFile); i++)
    await new Promise((r) => setTimeout(r, 100));
  const [port, endpoint] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((yes, no) => {
    const timer = setTimeout(() => no(new Error('CDP connection timeout')), 10000);
    socket.onopen = () => {
      clearTimeout(timer);
      yes();
    };
    socket.onerror = (e) => {
      clearTimeout(timer);
      no(e);
    };
  });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(JSON.stringify(m.error)));
      else p.resolve(m.result);
    }
  };
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params = {}) => call(method, params, sessionId);
  await page('Page.enable');
  const media = resolve('jobs/P17-helix-drop/media');
  const rows = [];
  for (const file of readdirSync(media)
    .filter((f) => f.endsWith('.html'))
    .sort()) {
    const tv = file.endsWith('-tv.html');
    const width = tv ? 1920 : 390,
      height = tv ? 1080 : 844;
    await page('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: !tv,
    });
    await page('Page.navigate', { url: pathToFileURL(resolve(media, file)).href });
    for (let i = 0; i < 50; i++) {
      const ready = await page('Runtime.evaluate', {
        expression: "document.readyState === 'complete' && !!document.querySelector('#view svg')",
        returnByValue: true,
      });
      if (ready.result.value) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const result = await page('Runtime.evaluate', {
      expression: `(() => { const view=document.querySelector('#view'); const buttons=[...document.querySelectorAll('button')]; const rect=view.getBoundingClientRect(); return { width:innerWidth,height:innerHeight,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,viewHeight:view.clientHeight,viewScrollHeight:view.scrollHeight,buttons:buttons.map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,bottom:r.bottom,label:b.getAttribute('aria-label')}}),maxBottom:Math.max(...[...document.querySelectorAll('#view h1,#view h2,#view li,#view button')].map(e=>e.getBoundingClientRect().bottom)),viewBottom:rect.bottom,timerFont:document.querySelector('[role=timer]')?getComputedStyle(document.querySelector('[role=timer]')).fontSize:null}; })()`,
      returnByValue: true,
    });
    const metrics = result.result.value;
    const fit =
      metrics.bodyWidth <= width &&
      metrics.bodyHeight <= height &&
      metrics.viewScrollHeight <= metrics.viewHeight &&
      metrics.maxBottom <= metrics.viewBottom &&
      metrics.buttons.every((b) => b.width >= 44 && b.height >= 44);
    rows.push({ file, fit, ...metrics });
    const { data } = await page('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(resolve(media, file.replace('.html', '.png')), Buffer.from(data, 'base64'));
    console.log(`${file}: ${fit ? 'fit' : 'OVERFLOW'}`);
  }
  await call('Target.closeTarget', { targetId });
  writeFileSync('jobs/P17-helix-drop/LAYOUT.json', JSON.stringify(rows, null, 2) + '\n');
  if (rows.some((r) => !r.fit)) process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
  if (socket) socket.close();
  // Edge can relaunch after its initial PID exits. Match only this unique profile.
  const quotedProfile = profile.replaceAll("'", "''");
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `$profilePath = '${quotedProfile}'; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'msedge.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profilePath) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
}
