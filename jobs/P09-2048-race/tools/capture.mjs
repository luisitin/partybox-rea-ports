// One headless Chrome process and one reused page for static SSR evidence.
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const job = fileURLToPath(new URL('../', import.meta.url));
const media = join(job, 'media');
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

function devToolsEndpoint(child) {
  return new Promise((done, reject) => {
    let output = '';
    const timeout = setTimeout(
      () => finish(new Error('Chrome did not expose CDP within 20 seconds')),
      20000,
    );
    function finish(error, endpoint) {
      clearTimeout(timeout);
      child.stderr.off('data', observe);
      child.off('error', failed);
      child.off('exit', exited);
      if (error) reject(error);
      else done(endpoint);
    }
    function observe(chunk) {
      output = `${output}${chunk}`.slice(-32000);
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) finish(null, match[1]);
    }
    function failed(error) {
      finish(error);
    }
    function exited(code) {
      finish(new Error(`Chrome exited before CDP opened (${code}): ${output.slice(-600)}`));
    }
    child.stderr.on('data', observe);
    child.once('error', failed);
    child.once('exit', exited);
  });
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.requests = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      const request = this.requests.get(message.id);
      if (!request) return;
      this.requests.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const request of this.requests.values()) {
        clearTimeout(request.timeout);
        request.reject(new Error('CDP connection closed'));
      }
      this.requests.clear();
    });
  }

  static async open(endpoint) {
    const socket = new WebSocket(endpoint);
    await new Promise((done, reject) => {
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('CDP WebSocket open timed out'));
      }, 10000);
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
          reject(new Error('CDP WebSocket open failed'));
        },
        { once: true },
      );
    });
    return new Cdp(socket);
  }

  send(method, params = {}, sessionId, timeoutMs = 15000) {
    const id = this.nextId++;
    return new Promise((done, reject) => {
      const timeout = setTimeout(() => {
        this.requests.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.requests.set(id, { resolve: done, reject, timeout });
      try {
        this.socket.send(
          JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
        );
      } catch (error) {
        clearTimeout(timeout);
        this.requests.delete(id);
        reject(error);
      }
    });
  }
}

// Read public rendered DOM only; no application state or browser internals are inspected.
function measure() {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const describe = (node) => ({
    tag: node.tagName.toLowerCase(),
    role: node.getAttribute('role'),
    class: typeof node.className === 'string' ? node.className : '',
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
  });
  const box = (rect) => ({
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
    right: Math.round(rect.right * 100) / 100,
    bottom: Math.round(rect.bottom * 100) / 100,
  });
  const visible = (node, style, rect) =>
    !['STYLE', 'SCRIPT', 'META', 'LINK'].includes(node.tagName) &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    rect.width > 0 &&
    rect.height > 0;
  const outside = [];
  const overflow = [];
  const clipping = [];
  const textOverflow = [];
  const textFonts = [];

  for (const node of document.body.querySelectorAll('*')) {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    if (!visible(node, style, rect)) continue;
    if (
      rect.left < -1 ||
      rect.top < -1 ||
      rect.right > viewport.width + 1 ||
      rect.bottom > viewport.height + 1
    ) {
      outside.push({ ...describe(node), rect: box(rect) });
    }
    if (
      (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1) ||
      (node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1)
    ) {
      overflow.push({
        ...describe(node),
        rect: box(rect),
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        intentionalEllipsis: style.textOverflow === 'ellipsis',
      });
    }
    let ancestor = node.parentElement;
    while (ancestor && ancestor !== document.body) {
      const ancestorStyle = getComputedStyle(ancestor);
      const ancestorRect = ancestor.getBoundingClientRect();
      const clipsX = ['hidden', 'clip', 'auto', 'scroll'].includes(ancestorStyle.overflowX);
      const clipsY = ['hidden', 'clip', 'auto', 'scroll'].includes(ancestorStyle.overflowY);
      if (
        (clipsX && (rect.left < ancestorRect.left - 1 || rect.right > ancestorRect.right + 1)) ||
        (clipsY && (rect.top < ancestorRect.top - 1 || rect.bottom > ancestorRect.bottom + 1))
      ) {
        clipping.push({
          ...describe(node),
          rect: box(rect),
          ancestor: describe(ancestor),
          ancestorRect: box(ancestorRect),
        });
        break;
      }
      ancestor = ancestor.parentElement;
    }
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    const node = text.parentElement;
    if (!node || !(text.textContent ?? '').trim()) continue;
    const style = getComputedStyle(node);
    const parentRect = node.getBoundingClientRect();
    if (!visible(node, style, parentRect)) continue;
    const range = document.createRange();
    range.selectNodeContents(text);
    const rect = range.getBoundingClientRect();
    const font = {
      ...describe(node),
      text: text.textContent.trim().slice(0, 120),
      fontPx: parseFloat(style.fontSize),
      rect: box(rect),
    };
    textFonts.push(font);
    if (
      rect.left < parentRect.left - 1 ||
      rect.right > parentRect.right + 1 ||
      rect.top < parentRect.top - 2 ||
      rect.bottom > parentRect.bottom + 2
    ) {
      textOverflow.push({
        ...font,
        parentRect: box(parentRect),
        intentionalEllipsis: style.textOverflow === 'ellipsis',
      });
    }
  }

  const directionTargets = [...document.querySelectorAll('button[aria-label^="Move "]')].map(
    (node) => {
      const rect = node.getBoundingClientRect();
      return {
        label: node.getAttribute('aria-label'),
        disabled: node.disabled,
        rect: box(rect),
        passes44px: rect.width >= 44 && rect.height >= 44,
      };
    },
  );
  return {
    title: document.title,
    surface: document.documentElement.dataset.surface,
    viewport,
    document: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
    },
    frame: box(document.getElementById('game-frame').getBoundingClientRect()),
    outside,
    overflow,
    clipping,
    textOverflow,
    textFonts,
    directionTargets,
    tvTextBelow32px:
      document.documentElement.dataset.surface === 'tv'
        ? textFonts.filter((text) => text.fontPx < 32)
        : [],
  };
}

let browser;
let cdp;
let profile;
try {
  await stat(chromePath);
  await mkdir(media, { recursive: true });
  const htmlFiles = (await readdir(media)).filter((name) => name.endsWith('.html')).sort();
  if (!htmlFiles.length) throw new Error('Render the SSR HTML captures before running capture.mjs');
  profile = await mkdtemp(join(tmpdir(), 'partybox-p09-capture-'));
  browser = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-background-networking',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-component-update',
      '--mute-audio',
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--window-size=1920,1080',
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  cdp = await Cdp.open(await devToolsEndpoint(browser));
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] }, sessionId);
  await cdp.send(
    'Emulation.setEmulatedMedia',
    {
      features: [
        { name: 'prefers-color-scheme', value: 'dark' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    },
    sessionId,
  );

  const layouts = [];
  for (const filename of htmlFiles) {
    const source = await readFile(join(media, filename), 'utf8');
    const phone = /data-surface="phone"/.test(source);
    const width = phone ? 390 : 1920;
    const height = phone ? 844 : 1080;
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: phone,
        screenWidth: width,
        screenHeight: height,
      },
      sessionId,
    );
    const navigation = await cdp.send(
      'Page.navigate',
      { url: pathToFileURL(join(media, filename)).href },
      sessionId,
    );
    if (navigation.errorText) throw new Error(`${filename}: ${navigation.errorText}`);
    // Wait for the correct local document, fonts, and two layout frames without adding a browser.
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const result = await cdp.send(
        'Runtime.evaluate',
        {
          expression: `document.readyState === 'complete' && document.title === ${JSON.stringify(basename(filename, '.html'))}`,
          returnByValue: true,
        },
        sessionId,
      );
      if (result.result.value) {
        ready = true;
        break;
      }
      await delay(100);
    }
    if (!ready) throw new Error(`${filename}: local document did not become ready`);
    const settled = await cdp.send(
      'Runtime.evaluate',
      {
        expression:
          '(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); return true; })()',
        awaitPromise: true,
        returnByValue: true,
      },
      sessionId,
    );
    if (settled.exceptionDetails)
      throw new Error(`${filename}: ${JSON.stringify(settled.exceptionDetails)}`);
    const measured = await cdp.send(
      'Runtime.evaluate',
      {
        expression: `(${measure.toString()})()`,
        returnByValue: true,
      },
      sessionId,
    );
    if (measured.exceptionDetails)
      throw new Error(`${filename}: ${JSON.stringify(measured.exceptionDetails)}`);
    const screenshot = await cdp.send(
      'Page.captureScreenshot',
      {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      },
      sessionId,
    );
    const png = filename.replace(/\.html$/, '.png');
    await writeFile(join(media, png), Buffer.from(screenshot.data, 'base64'));
    const layout = { html: filename, png, ...measured.result.value };
    layouts.push(layout);
    console.log(
      JSON.stringify({
        file: filename,
        outside: layout.outside.length,
        overflow: layout.overflow.length,
        textOverflow: layout.textOverflow.length,
        clipped: layout.clipping.length,
        smallTvText: layout.tvTextBelow32px.length,
      }),
    );
  }
  await writeFile(
    join(media, 'layout.json'),
    `${JSON.stringify({ chromePath, captures: layouts }, null, 2)}\n`,
    'utf8',
  );
  const mediaFiles = await readdir(media);
  const sizes = await Promise.all(mediaFiles.map((name) => stat(join(media, name))));
  const bytes = sizes
    .filter((entry) => entry.isFile())
    .reduce((total, entry) => total + entry.size, 0);
  if (bytes >= 10 * 1024 * 1024) throw new Error(`Media exceeds the 10 MB budget: ${bytes} bytes`);
  console.log(
    JSON.stringify({ captures: layouts.length, mediaBytes: bytes, report: 'media/layout.json' }),
  );
} finally {
  // Cleanup covers failures during launch, connection, navigation, layout inspection, or capture.
  if (cdp) {
    try {
      await cdp.send('Browser.close', {}, undefined, 2000);
    } catch {
      /* close can end CDP before replying */
    }
    cdp.socket.close();
  }
  if (browser && browser.exitCode === null && browser.signalCode === null) {
    await Promise.race([new Promise((done) => browser.once('exit', done)), delay(1500)]);
    if (browser.exitCode === null && browser.signalCode === null && browser.pid) {
      try {
        // Kill only the process tree this script launched if graceful CDP close failed.
        execFileSync('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
          timeout: 4000,
        });
      } catch {
        browser.kill('SIGKILL');
      }
    }
  }
  if (profile) {
    const absolute = resolve(profile);
    if (
      dirname(absolute) !== resolve(tmpdir()) ||
      !basename(absolute).startsWith('partybox-p09-capture-')
    ) {
      throw new Error(`Refusing cleanup outside the generated capture profile: ${absolute}`);
    }
    await rm(absolute, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(
      () => undefined,
    );
  }
}
