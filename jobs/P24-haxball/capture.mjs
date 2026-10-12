// Optional static QA for P24 only. Usage: node jobs/P24-haxball/capture.mjs
// Uses the installed Chrome, one browser and one page; no downloaded browser or dependency.
import { auditLayout } from './capture-audit.mjs';
import { closePrivateChrome } from './capture-processes.mjs';
import { runInteraction } from './interaction.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const media = join(dirname(fileURLToPath(import.meta.url)), 'media');
const chromePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profilePrefix = 'partybox-p24-capture-';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let stopping = false;
let browser;
let cdp;
let profile;
let exited = false;
let chromeError;
let debuggingUrl;
let privateBrowserClosed = false;

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
      this.cancelPending('Chrome debugging connection closed.');
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
    // Do not retain a Browser.close deadline while Chrome finishes its close handshake.
    this.cancelPending('Chrome debugging connection is closing.');
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }

  cancelPending(reason) {
    for (const waiting of this.pending.values()) {
      clearTimeout(waiting.timeout);
      waiting.reject(new Error(reason));
    }
    this.pending.clear();
  }
}

async function chromeEndpoint() {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (stopping) throw new Error('Capture interrupted.');
    if (chromeError) throw chromeError;
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
    if (stopping) throw new Error('Capture interrupted.');
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
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return document.readyState;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  if (ready.exceptionDetails) throw new Error(JSON.stringify(ready.exceptionDetails));
  // Layout readiness can precede raster paint after a cross-renderer file navigation.
  await sleep(100);
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

async function captureWithRetry(name, sessionId) {
  const attempts = [];
  for (let number = 1; number <= 2; number++) {
    try {
      const page = await captureFile(name, sessionId);
      attempts.push({ number, result: 'captured' });
      return { ...page, attempts };
    } catch (error) {
      attempts.push({ number, result: 'failed', error: String(error) });
      const transient =
        /timed out|timeout|context.*destroyed|Cannot find context|screenshot|did not finish loading/i.test(
          String(error),
        );
      if (stopping || number === 2 || !transient) {
        const failure = error instanceof Error ? error : new Error(String(error));
        failure.attempts = attempts;
        throw failure;
      }
      console.warn(`${name}: retrying transient capture failure: ${String(error)}`);
      await sleep(500);
    }
  }
}

async function stopBrowser() {
  let processes = [];
  console.log('P24 cleanup: reading CDP process membership');
  try {
    if (cdp) ({ processInfo: processes } = await cdp.send('SystemInfo.getProcessInfo'));
    console.log(
      `P24 cleanup: CDP members ${JSON.stringify(processes.map(({ type, id }) => ({ type, id })))}`,
    );
  } catch {
    // The cleanup helper falls back to exact-profile checks if CDP is already unavailable.
  }
  const gracefulClose = async () => {
    console.log('P24 cleanup: closing the private browser');
    try {
      // CDP addresses the actual browser even after its initial launcher process exits.
      if (cdp) await Promise.race([cdp.send('Browser.close'), sleep(3000)]);
    } finally {
      cdp?.close();
    }
  };
  let browserCleanup;
  if (process.platform === 'win32')
    browserCleanup = await closePrivateChrome(profile, gracefulClose, {
      processes,
      launcherPid: browser?.pid,
      endpointUrl: debuggingUrl,
    });
  else {
    try {
      await gracefulClose();
    } catch {
      /* Chrome can close the socket before replying. */
    }
  }
  if (process.platform !== 'win32') {
    for (let attempt = 0; browser && !exited && attempt < 30; attempt++) await sleep(100);
    if (browser?.pid && !exited) browser.kill('SIGKILL');
    for (let attempt = 0; !exited && attempt < 30; attempt++) await sleep(100);
  }
  if (profile) {
    console.log('P24 cleanup: browser verified closed; removing its temporary profile');
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
    try {
      // Windows can retain profile locks until this helper itself exits. Do not retry every
      // locked file and delay the already-verified browser shutdown by several minutes.
      await rm(target, { recursive: true, force: true, maxRetries: 0 });
      return { browser: browserCleanup ?? { launcherExited: exited }, profileRemoved: true };
    } catch (error) {
      if (error.code !== 'EBUSY' || !browserCleanup?.verifiedClosed) throw error;
      const warning = `Private Chrome is verified closed; temporary profile ${basename(target)} remains locked (EBUSY).`;
      console.warn(warning);
      return { browser: browserCleanup, profileRemoved: false, warning };
    }
  }
}

async function main() {
  const interactionOnly = process.env.P24_INTERACTION_ONLY === '1';
  const files = interactionOnly
    ? []
    : (await readdir(media)).filter((name) => name.endsWith('.html')).sort();
  if (!interactionOnly && files.length === 0)
    throw new Error(`No HTML snapshots in ${media}. Generate P24 SSR media first.`);
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
        // Pin Chromium's default WebTouch path, which supports named individual
        // touchEnd releases. The optional synthetic path uses different semantics.
        '--disable-features=SyntheticPointerActions',
        ...(process.env.P24_CPU_CAPTURE === '1'
          ? ['--disable-gpu', '--renderer-process-limit=1']
          : []),
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
    debuggingUrl = await chromeEndpoint();
    cdp = await Cdp.connect(debuggingUrl);
    report.browserVersion = await cdp.send('Browser.getVersion');
    report.touchDispatchFeatureFlag = '--disable-features=SyntheticPointerActions';
    const { targetInfos } = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find((target) => target.type === 'page');
    const { targetId } =
      pageTarget ?? (await cdp.send('Target.createTarget', { url: 'about:blank' }));
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    let consecutiveFailures = 0;
    for (const name of files) {
      if (stopping) throw new Error('Capture interrupted.');
      try {
        const page = await captureWithRetry(name, sessionId);
        consecutiveFailures = 0;
        report.pages.push(page);
        if (
          page.overflow.horizontal ||
          page.overflow.vertical ||
          page.summary.controlIssues ||
          page.summary.offscreen ||
          page.summary.textClipped ||
          page.summary.scrollContainers ||
          page.summary.typographyIssues
        )
          process.exitCode = 1;
        console.log(
          `${name}: ${JSON.stringify({ ...page.summary, overflow: page.overflow, attempts: page.attempts.length })}`,
        );
      } catch (error) {
        report.pages.push({ file: name, error: String(error), attempts: error.attempts ?? [] });
        process.exitCode = 1;
        console.error(`${name}: ${String(error)}`);
        if (++consecutiveFailures >= 2)
          throw new Error(
            'Stopping after two consecutive capture failures; browser cleanup follows.',
          );
      }
    }
    if (stopping) throw new Error('Capture interrupted.');
    report.interaction = await runInteraction(cdp, sessionId, () => stopping);
    if (!report.interaction.passed) process.exitCode = 1;
  } finally {
    try {
      report.cleanup = await stopBrowser();
      privateBrowserClosed = report.cleanup?.browser?.verifiedClosed === true;
    } catch (error) {
      report.cleanup = { browser: { verifiedClosed: false }, error: String(error) };
      throw error;
    } finally {
      await writeFile(
        join(media, interactionOnly ? 'interaction-capture.json' : 'layout.json'),
        `${JSON.stringify(
          {
            ...report,
            interaction: report.interaction
              ? {
                  report: 'interaction.json',
                  passed: report.interaction.passed,
                  checks: report.interaction.checks.length,
                  captures: report.interaction.captures.length,
                }
              : undefined,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
    }
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
  // Vite's optional build can retain worker handles on Windows. All evidence writes and the
  // browser's native exit proof completed before terminating this private CLI and its workers.
  if (privateBrowserClosed) process.stdout.write('', () => process.exit(process.exitCode ?? 0));
}
