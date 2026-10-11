// One temporary headless Chrome, closed in finally. Native CDP requires no added dependencies.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), 'r16-local-chrome-'));
const chrome = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
);
let socket;
let serial = 0;
const pending = new Map();
let sessionId;
const send = (method, params = {}, session = sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 60_000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
  });
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
};

try {
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      endpoint = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split('\n');
      break;
    } catch {
      await sleep(100);
    }
  }
  if (!endpoint) throw new Error('Chrome did not publish its debugger endpoint');
  socket = new WebSocket(`ws://127.0.0.1:${endpoint[0]}${endpoint[1]}`);
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(message.id);
    message.error
      ? request.reject(new Error(JSON.stringify(message.error)))
      : request.resolve(message.result);
  };
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  sessionId = (
    await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)
  ).sessionId;
  await send('Page.enable');

  // Play a public recreation once; the native original is separately documented from independent accounts.
  if (process.argv.includes('--research')) {
    await send('Page.navigate', { url: 'https://zurkon.github.io/playstack/' });
    await sleep(1500);
    const before = await evaluate(
      '({url:location.href,text:document.body.innerText.slice(0,1500),canvas:document.querySelectorAll("canvas").length})',
    );
    const point = await evaluate(
      '(() => { const r=document.querySelector("canvas").getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()',
    );
    for (let i = 0; i < 6; i++) {
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        ...point,
        button: 'left',
        clickCount: 1,
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        ...point,
        button: 'left',
        clickCount: 1,
      });
      await sleep(1100);
    }
    const after = await evaluate('document.body.innerText.slice(0,1500)');
    writeFileSync(
      new URL('../media/playable-observation.json', import.meta.url),
      JSON.stringify({ before, after }, null, 2) + '\n',
    );
    console.log(JSON.stringify({ research: before, after }));
  }

  const report = [];
  for (const phase of ['initial', 'play', 'score', 'done']) {
    for (const surface of ['tv', 'phone', 'phone-only', 'spectator', 'remote']) {
      const tv = surface === 'tv';
      const width = tv ? 1920 : 390;
      const height = tv ? 1080 : 844;
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: !tv,
      });
      const url = pathToFileURL(
        new URL(`../media/${phase}-${surface}.html`, import.meta.url).pathname.replace(
          /^\/(\w:)/,
          '$1',
        ),
      ).href;
      await send('Page.navigate', { url });
      await sleep(70);
      const fit = await evaluate(`(() => {
        const outside = [...document.querySelectorAll('h2,h3,p,button,ol,li')].filter(e => {
          const r=e.getBoundingClientRect(); return r.left < -1 || r.right > ${width}+1 || r.top < -1 || r.bottom > ${height}+1;
        }).map(e=>({tag:e.tagName,text:e.textContent.slice(0,70),rect:e.getBoundingClientRect().toJSON()}));
        const button=document.querySelector('button'); const b=button?.getBoundingClientRect();
        return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,outside,button:b?.toJSON(),minimumTvText:${tv} ? Math.min(...[...document.querySelectorAll('h2,h3,p,strong,span')].map(e=>parseFloat(getComputedStyle(e).fontSize))) : null};
      })()`);
      report.push({ phase, surface, ...fit });
      const screenshot = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      writeFileSync(
        new URL(`../media/${phase}-${surface}.png`, import.meta.url),
        Buffer.from(screenshot.data, 'base64'),
      );
    }
  }
  writeFileSync(
    new URL('../media/layout.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      screens: report.length,
      outside: report.filter((row) => row.outside.length),
      tooSmallTv: report.filter((row) => row.minimumTvText !== null && row.minimumTvText < 32),
    }),
  );
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await send('Browser.close', {}, null);
    } catch {
      /* Chrome may close before the reply. */
    }
    socket.close();
  }
  if (chrome.exitCode === null) chrome.kill();
}
