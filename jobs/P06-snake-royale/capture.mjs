// One isolated headless browser, always closed; offline phase captures and measurable fit.
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareLiveControls, runLiveControls } from './experiments/controls/live-controls.mjs';

const dir = resolve('jobs/P06-snake-royale/media');
const profile = resolve(`reports/r2-snake-browser-${process.pid}`);
mkdirSync(profile, { recursive: true });
const activeFile = resolve(profile, 'DevToolsActivePort');
if (existsSync(activeFile)) unlinkSync(activeFile);
const executable = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find(existsSync);
if (!executable) throw new Error('No installed Chromium browser');
const child = spawn(
  executable,
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-extensions',
    '--disable-component-update',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;
let seq = 0;
const pending = new Map();
const call = (method, params = {}) =>
  new Promise((resolveCall, reject) => {
    const id = ++seq;
    const timeout = setTimeout(
      () => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      },
      method === 'Browser.close' ? 2000 : 30000,
    );
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolveCall(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
try {
  for (let i = 0; i < 300 && !existsSync(activeFile) && child.exitCode === null; i++)
    await pause(100);
  if (!existsSync(activeFile))
    throw new Error(`Isolated Chromium failed to start (${child.exitCode})`);
  const port = readFileSync(activeFile, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((t) => t.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, reject) => {
    socket.onopen = r;
    socket.onerror = reject;
  });
  socket.onmessage = ({ data }) => {
    const value = JSON.parse(data);
    if (!value.id) return;
    const item = pending.get(value.id);
    pending.delete(value.id);
    if (value.error) item?.reject(new Error(JSON.stringify(value.error)));
    else item?.resolve(value.result);
  };
  socket.onclose = () => {
    for (const p of pending.values()) p.reject(new Error('Browser closed'));
    pending.clear();
  };
  await call('Page.enable');
  await call('Runtime.enable');
  const original = process.argv.includes('--original');
  if (original) {
    await call('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await call('Page.navigate', { url: 'https://slither.io/' });
    await pause(5000);
    const onboarding = await call('Runtime.evaluate', {
      expression: `JSON.stringify({title:document.title,text:document.body.innerText.slice(0,1500)})`,
      returnByValue: true,
    });
    const click = await call('Runtime.evaluate', {
      expression: `(()=>{const nick=document.getElementById('nick');if(nick)nick.value='REA Research';const play=[...document.querySelectorAll('button,[role=button],div')].find(e=>e.textContent?.trim()==='Play'&&e.children.length===0);if(play){play.click();return true;}return false;})()`,
      returnByValue: true,
    });
    await pause(5000);
    await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1000, y: 360 });
    await call('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 1000,
      y: 360,
      button: 'left',
      clickCount: 1,
    });
    await pause(1000);
    await call('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 1000,
      y: 360,
      button: 'left',
      clickCount: 1,
    });
    const after = await call('Runtime.evaluate', {
      expression: `JSON.stringify({text:document.body.innerText.slice(0,1500),canvases:document.querySelectorAll('canvas').length})`,
      returnByValue: true,
    });
    writeFileSync(
      resolve('reports/r6-original-attempt.json'),
      JSON.stringify(
        {
          onboarding: onboarding.result.value,
          clickedPlay: click.result.value,
          after: after.result.value,
        },
        null,
        2,
      ),
    );
    const screenshot = await call('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(
      resolve('reports/r6-original-attempt.png'),
      Buffer.from(screenshot.data, 'base64'),
    );
    console.log('Original product attempt recorded in reports only.');
  }
  const fits = [];
  for (const name of original
    ? []
    : readdirSync(dir).filter((n) => n.endsWith('.html') && !n.includes('contact'))) {
    const tv = name.endsWith('-tv.html');
    const width = tv ? 1920 : 390,
      height = tv ? 1080 : 844;
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const { frameTree } = await call('Page.getFrameTree');
    await call('Page.setDocumentContent', {
      frameId: frameTree.frame.id,
      html: readFileSync(resolve(dir, name), 'utf8'),
    });
    await pause(150);
    const check = await call('Runtime.evaluate', {
      expression: `JSON.stringify({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,overflow:[...document.querySelectorAll('#root *')].filter(e=>e.children.length===0&&e.getBoundingClientRect().width>0).filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+.5||r.bottom>innerHeight+.5||r.left<-.5||r.top<-.5}).map(e=>e.textContent.slice(0,60))})`,
      returnByValue: true,
    });
    const fit = JSON.parse(check.result.value);
    fits.push({ file: name, ...fit });
    const capture = await call('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(resolve(dir, name.replace('.html', '.png')), Buffer.from(capture.data, 'base64'));
  }
  if (!original) {
    writeFileSync(resolve(dir, 'fit.json'), JSON.stringify(fits, null, 2) + '\n');
    if (
      fits.some(
        (fit) =>
          fit.scrollWidth !== fit.width || fit.scrollHeight !== fit.height || fit.overflow.length,
      )
    )
      throw new Error('A captured phase overflows its viewport');
    await runLiveControls(call, await prepareLiveControls());
  }
  console.log(JSON.stringify(fits));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await call('Browser.close');
    } catch {}
    socket.close();
  }
  if (child.exitCode === null) child.kill();
  if (process.platform === 'win32')
    spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$taskProfile='${profile.replaceAll("'", "''")}'; Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($taskProfile) } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }`,
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
}
