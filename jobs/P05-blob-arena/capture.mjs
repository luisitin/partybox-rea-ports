// One Chromium process, closed in finally. Capture already-rendered components without dependencies.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(directory, '../..');
const profile = join(root, '.git', 'P05-static-profile');
mkdirSync(profile, { recursive: true });
if (existsSync(join(profile, 'DevToolsActivePort')))
  unlinkSync(join(profile, 'DevToolsActivePort'));
const executable =
  process.env.PB_CHROME ??
  join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe');
if (!existsSync(executable)) throw new Error('Set PB_CHROME to an installed Chromium executable.');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, socket;
let serial = 0;
const pending = new Map();
const ask = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timed out: ${method}`));
    }, 20000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const result = await ask('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
try {
  browser = spawn(
    executable,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--disable-background-networking',
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let port;
  for (let i = 0; i < 100; i++) {
    const active = join(profile, 'DevToolsActivePort');
    if (existsSync(active)) {
      port = readFileSync(active, 'utf8').split('\n')[0];
      break;
    }
    await sleep(100);
  }
  if (!port) throw new Error('Chromium did not publish its debug port.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  await ask('Page.enable');
  await ask('Runtime.enable');
  // Attempt live play on the original using this same browser. Never retain its imagery/assets.
  let original;
  try {
    if (process.env.PB_SKIP_ORIGINAL)
      throw new Error('Live attempt already recorded; static capture retry.');
    await ask('Page.navigate', { url: 'https://agar.io/' });
    await sleep(3500);
    original = await evaluate(
      `({title:document.title,text:document.body.innerText.slice(0,2500),controls:[...document.querySelectorAll('button,input')].map(e=>({tag:e.tagName,id:e.id,type:e.type,text:e.innerText,placeholder:e.placeholder})).slice(0,40)})`,
    );
    original.note = 'One headless live-play attempt; no source screenshots/assets retained.';
  } catch (error) {
    original = { error: error.message };
  }
  if (!process.env.PB_SKIP_ORIGINAL)
    writeFileSync(
      join(directory, 'original-access.json'),
      JSON.stringify(original, null, 2) + '\n',
    );
  if (process.env.PB_INTERACTIVE_BASE) {
    const interactions = [];
    await ask('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const phoneOnly of [false, true]) {
      await ask('Page.navigate', {
        url: `${process.env.PB_INTERACTIVE_BASE}/jobs/P05-blob-arena/interactive.html?phoneonly=${Number(phoneOnly)}`,
      });
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate('Boolean(window.__blobReady)')) {
          ready = true;
          break;
        }
        await sleep(100);
      }
      if (!ready) throw new Error('Interactive Controller did not mount');
      for (const delta of [22, 44]) {
        const pad = await evaluate(
          `(()=>{window.__blobClearInputs();const r=document.querySelector('[data-pad-primary="true"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height};})()`,
        );
        await ask('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: pad.x,
          y: pad.y,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        });
        await ask('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: pad.x + delta,
          y: pad.y,
          button: 'left',
          buttons: 1,
        });
        await ask('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: pad.x + delta,
          y: pad.y,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        });
        await sleep(50);
        const inputs = await evaluate('window.__blobInputs');
        const moving = inputs.find((input) => input.type === 'steer' && input.x > 0);
        const last = inputs.at(-1);
        if (!moving || last?.x !== 0 || last?.y !== 0)
          throw new Error('Drag/release did not move and stop');
        if (process.env.PB_FIXED_REACH && moving.x !== delta / 44)
          throw new Error(`Expected ${delta / 44}, received ${moving.x}`);
        interactions.push({ phoneOnly, delta, pad, inputs });
      }
      const controls = await evaluate(
        `(()=>{window.__blobClearInputs();const center=e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};};return {pad:center(document.querySelector('[data-pad-primary="true"]')),split:center(document.querySelector('[aria-describedby="blob-split-reason"]'))};})()`,
      );
      await ask('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
      const finger = { id: 1, x: controls.pad.x + 44, y: controls.pad.y };
      const tap = { id: 2, x: controls.split.x, y: controls.split.y };
      await ask('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ ...finger, x: controls.pad.x }],
      });
      await ask('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [finger] });
      await ask('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger, tap] });
      await ask('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [finger] });
      await ask('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await sleep(50);
      const touchInputs = await evaluate('window.__blobInputs');
      if (
        touchInputs.filter((input) => input.type === 'split').length !== 1 ||
        touchInputs.at(-1)?.x !== 0
      )
        throw new Error(`Two-finger steer/split/cancel failed: ${JSON.stringify(touchInputs)}`);
      interactions.push({
        phoneOnly,
        action: 'two-finger steer, split, cancel',
        inputs: touchInputs,
      });
      await evaluate('window.__blobClearInputs()');
      for (const event of [
        { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
        { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 },
        { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 },
        { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
      ])
        await ask('Input.dispatchKeyEvent', event);
      await sleep(50);
      const keyInputs = await evaluate('window.__blobInputs');
      if (
        keyInputs.filter((input) => input.type === 'split').length !== 1 ||
        keyInputs.at(-1)?.x !== 0
      )
        throw new Error('Keyboard steer/split/release failed');
      interactions.push({ phoneOnly, action: 'keyboard steer, split, release', inputs: keyInputs });
    }
    writeFileSync(
      join(
        directory,
        process.env.PB_FIXED_REACH ? 'interactive-fixed.json' : 'interactive-baseline.json',
      ),
      JSON.stringify(interactions, null, 2) + '\n',
    );
    console.log(`Interactive Controller: ${interactions.length} real drag/release checks passed`);
  }
  const pages = process.env.PB_INTERACTIVE_ONLY
    ? []
    : JSON.parse(readFileSync(join(directory, 'screens.json'), 'utf8'));
  const results = [];
  for (const page of pages) {
    await ask('Emulation.setDeviceMetricsOverride', {
      width: page.width,
      height: page.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await ask('Page.navigate', { url: pathToFileURL(join(directory, 'media', page.name)).href });
    await sleep(150);
    const fit = await evaluate(
      `(()=>{const main=document.querySelector('main').getBoundingClientRect();const selector='button,li,h2,[role="timer"],svg';return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,elements:[...document.querySelectorAll(selector)].map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,text:e.textContent.slice(0,70),x:r.x,y:r.y,width:r.width,height:r.height,font:getComputedStyle(e).fontSize,clipped:r.top<main.top-1||r.bottom>main.bottom+1||r.left<0||r.right>innerWidth};}),main:{top:main.top,bottom:main.bottom}};})()`,
    );
    const png = await ask('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    const scoreOverlaps = await evaluate(
      `(()=>{const range=e=>{const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect();return {left:b.left,right:b.right,text:e.textContent};};return [...document.querySelectorAll('[data-standings="tv"] [data-column="round"]')].flatMap(e=>{const t=e.parentElement.querySelector('[data-column="total"]');if(!t)return [];const a=range(e),b=range(t);return a.right>b.left?[{round:a,total:b}]:[];});})()`,
    );
    writeFileSync(
      join(directory, 'media', page.name.replace('.html', '.png')),
      Buffer.from(png.data, 'base64'),
    );
    results.push({ ...page, ...fit, scoreOverlaps });
    console.log(`${page.name}: ${fit.elements.filter((e) => e.clipped).length} clipped elements`);
    if (scoreOverlaps.length)
      throw new Error(`${page.name}: ${scoreOverlaps.length} overlapping score labels`);
  }
  if (pages.length)
    writeFileSync(join(directory, 'fit.json'), JSON.stringify(results, null, 2) + '\n');
} finally {
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.reject(new Error('Capture finished'));
  }
  pending.clear();
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await ask('Browser.close');
    } catch {}
    socket.close();
  }
  if (browser) {
    if (process.platform === 'win32')
      spawnSync('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    else if (browser.exitCode === null) browser.kill();
  }
}
// Windows can retain a closed child's handle after the CDP socket is gone.
// All files are written and the owned browser is closed before leaving.
process.exit(0);
