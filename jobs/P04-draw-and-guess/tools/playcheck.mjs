// One local headless browser for real phone interaction checks, closed in finally.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vr = createRequire(require.resolve('vitest/package.json'));
const { createServer } = await import(pathToFileURL(vr.resolve('vite')).href);
const server = await createServer({
  configFile: false,
  resolve: {
    alias: {
      '@partybox/shared': resolve('packages/shared/src/index.ts'),
      '@partybox/game-sdk/ui': resolve('packages/game-sdk/src/ui.ts'),
      '@partybox/game-sdk/match': resolve('packages/game-sdk/src/match.ts'),
      '@partybox/game-sdk': resolve('packages/game-sdk/src/index.ts'),
    },
  },
  server: { host: '127.0.0.1', port: 0 },
  appType: 'mpa',
});
await server.listen();
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
  await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await rpc(socket, 'Page.navigate', {
    url: server.resolvedUrls.local[0] + 'jobs/P04-draw-and-guess/tools/live.html',
  });
  const evaluate = async (expression) => {
    const result = await rpc(socket, 'Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  for (let i = 0; i < 100; i++) {
    if (await evaluate('!!document.querySelector("canvas") && !!window.p04')) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  const settle = () =>
    evaluate(
      'new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))',
    );
  const button = async (label) => {
    await evaluate(
      `document.querySelectorAll('button').values().find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`,
    );
    await settle();
  };
  const draw = async () => {
    const rect = await evaluate(
      'JSON.stringify(Object.fromEntries(["x","y","width","height"].map(k => [k,document.querySelector("canvas").getBoundingClientRect()[k]])))',
    );
    const r = JSON.parse(rect),
      x = r.x + 12,
      y = r.y + r.height / 2;
    await rpc(socket, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    for (let i = 1; i <= 100; i++)
      await rpc(socket, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: x + (i % 60) * 4,
        y: y + (i % 6) * 3,
        button: 'none',
        buttons: 1,
      });
    await rpc(socket, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: x + 40,
      y,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
    await settle();
  };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  await settle();
  await evaluate('p04.hold(true)');
  await draw();
  const gesture = await evaluate('p04.info()');
  check(
    gesture.strokes.length === 1 && gesture.revision > 2,
    'Pointer chunks must form one gesture',
  );
  await button('Undo');
  check((await evaluate('p04.info().strokes.length')) === 0, 'One Undo must remove the gesture');
  await draw();
  const beforeClear = await evaluate('p04.info()');
  await button('Clear');
  const armedClear = await evaluate('p04.info()');
  check(
    armedClear.revision === beforeClear.revision &&
      armedClear.strokes.length === beforeClear.strokes.length,
    'First Clear tap must preserve ink and revision',
  );
  await button('Tap again to clear');
  check(
    (await evaluate('p04.info().strokes.length')) === 0,
    'Second Clear tap must clear intentionally',
  );
  await draw();
  check(
    (await evaluate('p04.info().strokes.length')) === 1,
    'Clear followed by drawing must retain the new gesture',
  );
  await evaluate('p04.ack()');
  await settle();
  const restored = await evaluate('p04.info()');
  check(restored.strokes.length === 1, 'Delayed edits must not erase later strokes');
  const pixels = await evaluate(
    'document.querySelector("canvas").getContext("2d").getImageData(0,0,1000,600).data.some((v,i)=>i%4===3&&v>0)',
  );
  check(pixels, 'Acknowledged canvas must paint actual ink');
  await evaluate('p04.hold(false); p04.guesser()');
  await settle();
  const fit = async () =>
    JSON.parse(
      await evaluate(
        'JSON.stringify({height:innerHeight,overflow:[...document.querySelectorAll("h2,p,input,button")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.bottom>innerHeight+1||r.top< -1||r.left< -1)}).map(e=>e.textContent||e.id)})',
      ),
    );
  const normal = await fit();
  check(normal.overflow.length === 0, 'Phone-only guess layout must fit');
  await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 500,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await settle();
  const keyboard = await fit();
  check(keyboard.overflow.length === 0, 'Keyboard-height guess layout must fit');
  await evaluate('p04.solve()');
  await settle();
  check(
    (await evaluate('document.body.textContent')).includes('Correct! +'),
    'Solver must see immediate earned points',
  );
  const solved = await fit();
  check(solved.overflow.length === 0, 'Keyboard-height solved layout must fit');
  const report = {
    checks: [
      'pointer chunk merge',
      'one Undo per gesture',
      'accidental Clear preserves ink',
      'second Clear confirms deletion',
      'delayed Clear/Undo acknowledgements',
      'real canvas paint',
      'phone-only guess fit',
      'keyboard-height guess fit',
      'immediate point receipt',
      'keyboard-height solved fit',
    ],
    firstGestureChunks: gesture.revision,
    finalRevision: restored.revision,
    normal,
    keyboard,
    solved,
  };
  writeFileSync(
    resolve('jobs/P04-draw-and-guess/tools/playcheck-results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
} finally {
  await server.close();
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
