// Optional static QA for P03 only. Usage: node jobs/P03-trivia-lightning/capture.mjs
// Uses the installed Chrome, one browser and one page; no downloaded browser or dependency.
import { auditLayout } from './capture-audit.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const media = join(dirname(fileURLToPath(import.meta.url)), 'media');
const chromePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profilePrefix = 'partybox-p03-capture-';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let stopping = false;
let browser;
let cdp;
let profile;
let exited = false;
let chromeError;

function interrupt() {
  stopping = true;
  cdp?.close();
}
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const waiting = this.pending.get(message.id);
        if (!waiting) return;
        this.pending.delete(message.id);
        clearTimeout(waiting.timeout);
        if (message.error) waiting.reject(new Error(JSON.stringify(message.error)));
        else waiting.resolve(message.result);
      }
    });
    socket.addEventListener('close', () => {
      for (const waiting of this.pending.values()) {
        clearTimeout(waiting.timeout);
        waiting.reject(new Error('Chrome debugging connection closed.'));
      }
      this.pending.clear();
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((done, reject) => {
      const timeout = setTimeout(() => reject(new Error('Chrome connection timed out.')), 10_000);
      socket.addEventListener(
        'open',
        () => {
          clearTimeout(timeout);
          done();
        },
        { once: true },
      );
      socket.addEventListener(
        'error',
        () => {
          clearTimeout(timeout);
          reject(new Error('Could not connect to Chrome.'));
        },
        { once: true },
      );
    });
    return new Cdp(socket);
  }

  send(method, params = {}, sessionId) {
    if (this.socket.readyState !== WebSocket.OPEN)
      return Promise.reject(new Error('Chrome is not connected.'));
    const id = ++this.nextId;
    return new Promise((done, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome command timed out: ${method}`));
      }, 20_000);
      this.pending.set(id, { resolve: done, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }
}

async function chromeEndpoint() {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (stopping) throw new Error('Capture interrupted.');
    if (chromeError) throw chromeError;
    if (exited) throw new Error('Chrome exited before opening its debugging port.');
    try {
      const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8'))
        .trim()
        .split('\n');
      const response = await fetch(`http://127.0.0.1:${Number(port)}/json/version`, {
        signal: AbortSignal.timeout(1000),
      });
      const endpoint = await response.json();
      if (endpoint.webSocketDebuggerUrl) return endpoint.webSocketDebuggerUrl;
    } catch {
      // Chrome writes DevToolsActivePort only after the private browser profile is ready.
    }
    await sleep(100);
  }
  throw new Error('Chrome did not open a debugging port within 30 seconds.');
}

async function captureFile(name, sessionId) {
  const phone = !/^tv(?:[-_.]|$)/i.test(name);
  const width = phone ? 390 : 1920;
  const height = phone ? 844 : 1080;
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    },
    sessionId,
  );
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: phone }, sessionId);
  await cdp.send(
    'Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
    sessionId,
  );
  const url = pathToFileURL(join(media, name)).href;
  const navigation = await cdp.send('Page.navigate', { url }, sessionId);
  if (navigation.errorText) throw new Error(navigation.errorText);
  let loaded = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (stopping || exited) throw new Error('Capture interrupted.');
    try {
      const status = await cdp.send(
        'Runtime.evaluate',
        {
          expression: `document.readyState === 'complete' && location.href === ${JSON.stringify(url)}`,
          returnByValue: true,
        },
        sessionId,
      );
      if (status.exceptionDetails) throw new Error(JSON.stringify(status.exceptionDetails));
      loaded = status.result.value === true;
      if (loaded) break;
    } catch (error) {
      if (!/context.*destroyed|Cannot find context/i.test(String(error))) throw error;
    }
    await sleep(100);
  }
  if (!loaded) throw new Error(`Page did not finish loading: ${name}`);
  const ready = await cdp.send(
    'Runtime.evaluate',
    {
      expression: `(async () => {
        await document.fonts.ready;
        return document.readyState;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  if (ready.exceptionDetails) throw new Error(JSON.stringify(ready.exceptionDetails));
  const audit = await cdp.send(
    'Runtime.evaluate',
    { expression: `(${auditLayout.toString()})(${phone})`, returnByValue: true },
    sessionId,
  );
  if (audit.exceptionDetails) throw new Error(JSON.stringify(audit.exceptionDetails));
  const screenshot = await cdp.send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false },
    sessionId,
  );
  await writeFile(
    join(media, name.replace(/\.html$/i, '.png')),
    Buffer.from(screenshot.data, 'base64'),
  );
  return { file: name, ...audit.result.value };
}

async function stopBrowser() {
  if (cdp && !exited) {
    try {
      await Promise.race([cdp.send('Browser.close'), sleep(3000)]);
    } catch {
      // Browser.close often closes the debugging connection before returning its response.
    }
  }
  cdp?.close();
  for (let attempt = 0; browser && !exited && attempt < 30; attempt++) await sleep(100);
  if (browser?.pid && !exited) {
    if (process.platform === 'win32') {
      await new Promise((done) => {
        const killer = spawn('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        killer.once('error', done);
        killer.once('exit', done);
      });
    } else browser.kill('SIGKILL');
    for (let attempt = 0; !exited && attempt < 30; attempt++) await sleep(100);
  }
  if (profile) {
    const tempRoot = resolve(tmpdir());
    const target = resolve(profile);
    const local = relative(tempRoot, target);
    if (
      !local ||
      isAbsolute(local) ||
      local.startsWith('..') ||
      !basename(target).startsWith(profilePrefix)
    )
      throw new Error(`Refusing cleanup outside the private capture profile: ${target}`);
    await rm(target, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
}

async function main() {
  const files = (await readdir(media)).filter((name) => name.endsWith('.html')).sort();
  if (files.length === 0)
    throw new Error(`No HTML snapshots in ${media}. Generate P03 SSR media first.`);
  const report = { capturedAt: new Date().toISOString(), browser: chromePath, pages: [] };
  profile = await mkdtemp(join(tmpdir(), profilePrefix));
  try {
    browser = spawn(
      chromePath,
      [
        '--headless',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-component-update',
        'about:blank',
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
    browser.once('error', (error) => {
      chromeError = error;
    });
    browser.once('exit', () => {
      exited = true;
    });
    cdp = await Cdp.connect(await chromeEndpoint());
    const { targetInfos } = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find((target) => target.type === 'page');
    const { targetId } =
      pageTarget ?? (await cdp.send('Target.createTarget', { url: 'about:blank' }));
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    for (const name of files) {
      if (stopping) throw new Error('Capture interrupted.');
      try {
        const page = await captureFile(name, sessionId);
        report.pages.push(page);
        console.log(`${name}: ${JSON.stringify({ ...page.summary, overflow: page.overflow })}`);
      } catch (error) {
        report.pages.push({ file: name, error: String(error) });
        process.exitCode = 1;
        console.error(`${name}: ${String(error)}`);
      }
    }
    await writeFile(join(media, 'layout.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } finally {
    await stopBrowser();
  }
}

try {
  await main();
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', interrupt);
}
