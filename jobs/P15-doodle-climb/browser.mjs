// A single isolated Edge instance captures every static phase and always closes in finally.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const media = resolve('jobs/P15-doodle-climb/media');
const profile = mkdtempSync(join(tmpdir(), 'p15-edge-'));
const executable =
  process.env.P15_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = spawn(
  executable,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;
let ownedBrowserPid;
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; !existsSync(portFile) && i < 100; i++) await wait(100);
  if (!existsSync(portFile)) throw new Error('Edge did not expose its isolated debugging endpoint');
  const [port, endpoint] = readFileSync(portFile, 'utf8').trim().split('\n');
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let counter = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler?.reject(new Error(JSON.stringify(message.error)));
    else handler?.resolve(message.result);
  });
  const call = (method, params = {}, sessionId) =>
    new Promise((resolveCall, reject) => {
      const id = ++counter;
      pending.set(id, { resolve: resolveCall, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  // Edge can relaunch itself on Windows; use the actual browser PID, not just the launcher.
  const processes = await call('SystemInfo.getProcessInfo');
  ownedBrowserPid = processes.processInfo.find((process) => process.type === 'browser')?.id;
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params = {}) => call(method, params, sessionId);
  await page('Page.enable');
  const metrics = [];
  for (const file of readdirSync(media).filter((n) => n.endsWith('.html'))) {
    const tv = file.includes('-tv.');
    const width = tv ? 1920 : 390;
    const height = tv ? 1080 : 844;
    await page('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: !tv,
    });
    await page('Page.navigate', { url: pathToFileURL(join(media, file)).href });
    await wait(150);
    const result = await page('Runtime.evaluate', {
      expression: `JSON.stringify({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,buttons:[...document.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label'),x:r.x,y:r.y,width:r.width,height:r.height}}),scenes:[...document.querySelectorAll('[role=img]')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}}),outside:[...document.querySelectorAll('main h2,main p,main li,main button')].filter(e=>{const r=e.getBoundingClientRect();return r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth}).map(e=>e.textContent)})`,
      returnByValue: true,
    });
    const measurement = JSON.parse(result.result.value);
    metrics.push({ file, ...measurement });
    const shot = await page('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(join(media, file.replace('.html', '.png')), Buffer.from(shot.data, 'base64'));
  }
  writeFileSync(
    resolve('jobs/P15-doodle-climb/screen-metrics.json'),
    JSON.stringify(metrics, null, 2) + '\n',
  );
  console.log(
    JSON.stringify(
      metrics.map(({ file, scrollWidth, scrollHeight, outside, scenes }) => ({
        file,
        scrollWidth,
        scrollHeight,
        outside,
        sceneMinHeight: Math.min(...scenes.map((s) => s.height)),
      })),
      null,
      2,
    ),
  );
  if (process.argv.includes('--research')) {
    await page('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await page('Page.navigate', { url: 'https://takosenpai2687.github.io/doodle-jump/' });
    await wait(5000);
    const observations = [];
    const observe = async (action) => {
      const result = await page('Runtime.evaluate', {
        expression: `JSON.stringify({title:document.title,canvas:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height})),text:document.body.innerText.slice(0,500)})`,
        returnByValue: true,
      });
      observations.push({ action, ...JSON.parse(result.result.value) });
    };
    await observe('loaded public recreation, automatic start');
    for (const key of ['ArrowLeft', 'ArrowRight']) {
      await page('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
        code: key,
        windowsVirtualKeyCode: key === 'ArrowLeft' ? 37 : 39,
      });
      await wait(250);
      await page('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code: key,
        windowsVirtualKeyCode: key === 'ArrowLeft' ? 37 : 39,
      });
      await observe(`held ${key} 250ms then released`);
    }
    const shot = await page('Page.captureScreenshot', { format: 'png' });
    const researchShot = join(tmpdir(), 'p15-research-r12.png');
    writeFileSync(researchShot, Buffer.from(shot.data, 'base64'));
    writeFileSync(
      resolve('jobs/P15-doodle-climb/research-play.json'),
      JSON.stringify(
        {
          url: 'https://takosenpai2687.github.io/doodle-jump/',
          nativeOriginal: false,
          observations,
          screenshotNotCommitted: true,
        },
        null,
        2,
      ) + '\n',
    );
    console.log('Research public recreation play:', JSON.stringify(observations));
    console.log('Temporary research screenshot:', researchShot);
  }
  await call('Browser.close');
} finally {
  socket?.close();
  if (ownedBrowserPid || browser.exitCode === null) {
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(ownedBrowserPid ?? browser.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    else browser.kill('SIGTERM');
  }
  // This target is an absolute, mkdtemp-created directory under the system temp directory.
  if (profile.startsWith(join(tmpdir(), 'p15-edge-')))
    rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
