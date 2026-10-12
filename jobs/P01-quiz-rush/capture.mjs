// One browser, one page, sequential captures. No application/server process or browser test suite.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { tmpdir } from 'node:os';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const job = import.meta.dirname;
const media = resolve(job, 'media');
const temp = mkdtempSync(resolve(tmpdir(), 'pb-kahoot-capture-'));
const profile = resolve(temp, 'capture-profile');
let port;
const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!browserPath) throw new Error('Neither the standard Chrome nor Edge executable exists.');
const cases = JSON.parse(readFileSync(resolve(media, 'capture-manifest.json'), 'utf8'));
const fontBytes = readFileSync(resolve(media, 'nunito-latin-wght-normal.woff2'));
const tokenCSS = readFileSync(resolve(media, 'tokens.css'), 'utf8');
const evidenceCSS = readFileSync(resolve(media, 'evidence.css'), 'utf8');
mkdirSync(temp, { recursive: true });

function pause(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

function localJson(url) {
  return new Promise((resolveJson, reject) => {
    const request = http.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk));
      response.on('end', () => {
        try {
          resolveJson(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(2000, () => request.destroy(new Error('DevTools HTTP timeout')));
  });
}

class Devtools {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending?.reject(new Error(JSON.stringify(message.error)));
        else pending?.resolve(message.result);
      } else if (message.method) {
        for (const resolveEvent of this.events.get(message.method) ?? [])
          resolveEvent(message.params);
        this.events.delete(message.method);
      }
    });
  }
  call(method, params = {}, timeoutMs = 30000) {
    return new Promise((resolveCall, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DevTools timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolveCall(result);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  event(method) {
    return new Promise((resolveEvent) =>
      this.events.set(method, [...(this.events.get(method) ?? []), resolveEvent]),
    );
  }
}

function measure() {
  const main = document.querySelector('.evidence-main');
  const mainBounds = main.getBoundingClientRect();
  const stage =
    document.documentElement.dataset.surface === 'tv'
      ? main.querySelector('[class*="_stage_"]')
      : null;
  const stageStyle = stage ? getComputedStyle(stage) : null;
  const bounds = {
    top: mainBounds.top + (stageStyle ? parseFloat(stageStyle.paddingTop) : 0),
    bottom: mainBounds.bottom - (stageStyle ? parseFloat(stageStyle.paddingBottom) : 0),
    left: mainBounds.left + (stageStyle ? parseFloat(stageStyle.paddingLeft) : 0),
    right: mainBounds.right - (stageStyle ? parseFloat(stageStyle.paddingRight) : 0),
  };
  const all = [...main.querySelectorAll('*')];
  const named = (el) =>
    `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${(el.textContent ?? '').slice(0, 70)}`;
  const visible = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    );
  };
  const content = all.filter(
    (el) =>
      el instanceof HTMLElement &&
      visible(el) &&
      (el.matches('h2,h3,p,li,button,[role=status],[role=timer]') ||
        (el.childElementCount === 0 && el.textContent?.trim())),
  );
  const clipped = content
    .filter((el) => {
      const insideStage = stage?.contains(el);
      const limit = insideStage ? bounds : mainBounds;
      let r = el.getBoundingClientRect();
      // The TV's Next hint cancels transparent padding to keep its header stable.
      // Check its visible words; the shell timer is a sibling outside the game Stage.
      if (insideStage && el.matches('button')) {
        const style = getComputedStyle(el);
        if (style.backgroundColor === 'rgba(0, 0, 0, 0)' && parseFloat(style.marginTop) < 0) {
          const range = document.createRange();
          range.selectNodeContents(el);
          r = range.getBoundingClientRect();
        }
      }
      return (
        r.top < limit.top - 1 ||
        r.bottom > limit.bottom + 1 ||
        r.left < limit.left - 1 ||
        r.right > limit.right + 1
      );
    })
    .map(named);
  const scrollers = all
    .filter((el) => el instanceof HTMLElement && /auto|scroll/.test(getComputedStyle(el).overflowY))
    .map((el) => ({ element: named(el), overflow: el.scrollHeight - el.clientHeight }));
  const rules = [];
  const walk = (list) => {
    for (const rule of list) {
      if (rule.selectorText) rules.push(rule.selectorText);
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) walk(sheet.cssRules);
  const localClasses = new Set(
    all.flatMap((el) => [...el.classList]).filter((name) => name.startsWith('_')),
  );
  const unstyled = [...localClasses].filter(
    (name) => !rules.some((rule) => rule.includes(`.${name}`)),
  );
  return {
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    verticalOverflow: document.documentElement.scrollHeight - innerHeight,
    main: {
      x: mainBounds.x,
      y: mainBounds.y,
      width: mainBounds.width,
      height: mainBounds.height,
    },
    safeBounds: bounds,
    scrollers,
    clipped,
    unstyled,
    nameVisibility: [...main.querySelectorAll('[data-player] [class*="_name_"]')]
      .filter(visible)
      .map((el) => ({
        playerId: el.closest('[data-player]').getAttribute('data-player'),
        name: el.textContent.trim(),
        title: el.getAttribute('title'),
        availableWidth: el.clientWidth,
        requiredWidth: el.scrollWidth,
        truncated: el.scrollWidth > el.clientWidth + 1,
      })),
    touchTargets: [...main.querySelectorAll('button')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        label: el.getAttribute('aria-label') ?? el.textContent,
        width: r.width,
        height: r.height,
      };
    }),
    textSizes: content.map((el) => ({
      element: named(el),
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    })),
    nunitoLoaded: [...document.fonts].some(
      (font) => font.family === 'Nunito Variable' && font.status === 'loaded',
    ),
  };
}

let browser;
let socket;
let dev;
let browserClosed = false;
const metrics = [];
try {
  browser = spawn(
    browserPath,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--mute-audio',
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  console.log(
    `Started capture browser PID ${browser.pid}; waiting for its DevToolsActivePort file in ${temp}.`,
  );
  writeFileSync(resolve(temp, 'browser-pid.txt'), String(browser.pid), 'utf8');
  let targets;
  const readinessLimit = Date.now() + 60000;
  while (Date.now() < readinessLimit) {
    try {
      const portFile = resolve(profile, 'DevToolsActivePort');
      if (existsSync(portFile)) {
        port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
        targets = await localJson(`http://127.0.0.1:${port}/json/list`);
        if (Array.isArray(targets)) break;
      }
    } catch {}
    await pause(100);
  }
  const page = Array.isArray(targets) ? targets.find((target) => target.type === 'page') : null;
  if (!page) throw new Error('The browser did not expose a page within sixty seconds.');
  console.log(`DevTools ready on port ${port}.`);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ready, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('DevTools WebSocket startup timeout')),
      10000,
    );
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timeout);
        ready();
      },
      { once: true },
    );
    socket.addEventListener('error', reject, { once: true });
  });
  dev = new Devtools(socket);
  await dev.call('Page.enable');
  await dev.call('Runtime.enable');
  const { frameTree } = await dev.call('Page.getFrameTree');
  console.log('Page and runtime enabled.');
  for (const [index, frame] of cases.entries()) {
    await dev.call('Emulation.setDeviceMetricsOverride', {
      width: frame.width,
      height: frame.height,
      deviceScaleFactor: 1,
      mobile: frame.surface !== 'tv',
    });
    // Every fixture is self-contained. Write its exact HTML into the owned blank page instead
    // of depending on Windows file navigation, which can stall under desktop contention.
    await dev.call('Page.setDocumentContent', {
      frameId: frameTree.frame.id,
      html: readFileSync(resolve(media, `${frame.name}.html`), 'utf8'),
    });
    if (index === 0) console.log(`Loaded inline HTML for ${frame.name}.`);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const state = await dev.call('Runtime.evaluate', {
        expression:
          "document.readyState === 'complete' && !!document.querySelector('.evidence-main')",
        returnByValue: true,
      });
      if (state.result.value) {
        ready = true;
        break;
      }
      await pause(100);
    }
    if (!ready) throw new Error(`Page content not ready: ${frame.name}`);
    // Page.setDocumentContent has no file base URL. Load the committed local font bytes directly;
    // opening the standalone HTML from disk uses the same adjacent OFL font, without a network.
    await dev.call('Runtime.evaluate', {
      expression: `(()=>{const tokens=document.createElement('style');tokens.textContent=${JSON.stringify(tokenCSS)};document.head.append(tokens);const rules=document.createElement('style');rules.textContent=${JSON.stringify(evidenceCSS)};document.head.append(rules);const bytes=Uint8Array.from(atob('${fontBytes.toString('base64')}'),char=>char.charCodeAt(0));const face=new FontFace('Nunito Variable',bytes,{weight:'200 1000',style:'normal'});document.fonts.add(face);return face.load().then(()=>document.fonts.ready).then(()=>true)})()`,
      awaitPromise: true,
    });
    // The real host's layout effect auto-collapses the named strip past two rows before paint.
    // Static SSR has no layout effects, so apply that same measured decision to its two renders.
    await dev.call('Runtime.evaluate', {
      expression: `(()=>{const named=document.querySelector('[data-chips-named]');const faces=document.querySelector('[data-chips-faces]');const list=named?.querySelector('ul');if(list&&new Set([...list.children].map(el=>el.offsetTop)).size>2){named.hidden=true;faces.hidden=false;}return true})()`,
      returnByValue: true,
    });
    const result = await dev.call('Runtime.evaluate', {
      expression: `(${measure.toString()})()`,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    metrics.push({ name: frame.name, baseline: frame.baseline === true, ...result.result.value });
    const shot = await dev.call('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      fromSurface: true,
    });
    writeFileSync(resolve(media, `${frame.name}.png`), Buffer.from(shot.data, 'base64'));
    if ((index + 1) % 9 === 0) console.log(`Captured ${index + 1}/${cases.length} screens.`);
  }
  writeFileSync(
    resolve(media, 'layout-metrics.json'),
    JSON.stringify(metrics, null, 2) + '\n',
    'utf8',
  );
} catch (error) {
  console.error('Capture failed:', error);
  throw error;
} finally {
  if (dev) {
    let closeTimeout;
    try {
      await Promise.race([
        dev.call('Browser.close', {}, 1500),
        new Promise((done) => (closeTimeout = setTimeout(done, 2000))),
      ]);
    } catch {
      // Exact owned process-tree fallback also covers a closed/unresponsive CDP connection.
    } finally {
      clearTimeout(closeTimeout);
    }
  }
  socket?.close();
  if (browser?.pid) {
    const killer = spawn('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    await new Promise((done) => killer.once('exit', done));
    // Windows can retain a terminated GUI process handle before Node receives its exit event.
    // Verify that this exact owned PID is gone/terminated through the native process API.
    const verifier = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$pbOwnedProcess = Get-Process -Id ${browser.pid} -ErrorAction SilentlyContinue; if ($null -eq $pbOwnedProcess -or $pbOwnedProcess.HasExited) { exit 0 } else { exit 1 }`,
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
    browserClosed =
      (await new Promise((done) => {
        const timeout = setTimeout(() => {
          verifier.unref();
          done(null);
        }, 15000);
        verifier.once('exit', (code) => {
          clearTimeout(timeout);
          done(code);
        });
        verifier.once('error', () => {
          clearTimeout(timeout);
          done(null);
        });
      })) === 0;
    browser.unref();
    if (!browserClosed)
      throw new Error(
        `Owned browser PID ${browser.pid} closure is unverified; preserving its profile.`,
      );
    else console.log(`Owned browser PID ${browser.pid} is closed.`);
  }
  // Resolve and check this task's specific temporary directory before recursively removing it.
  if (!profile.startsWith(`${temp}\\`) && !profile.startsWith(`${temp}/`))
    throw new Error('Refusing profile cleanup outside owned capture temp.');
  browserClosed ||= !browser;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!browserClosed) break;
    try {
      rmSync(profile, { recursive: true, force: true });
      break;
    } catch {
      await pause(100);
    }
  }
  const osTemp = resolve(tmpdir());
  if (
    !temp.startsWith(`${osTemp}\\pb-kahoot-capture-`) &&
    !temp.startsWith(`${osTemp}/pb-kahoot-capture-`)
  )
    throw new Error('Refusing cleanup outside owned OS capture temp.');
  if (browserClosed) {
    try {
      rmSync(temp, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Owned temp cleanup deferred: ${error.message}`);
    }
  }
}

const files = readdirSync(media).sort();
const bytes = files.reduce((sum, file) => sum + statSync(resolve(media, file)).size, 0);
if (bytes >= 10 * 1024 * 1024) throw new Error(`Evidence budget exceeded: ${bytes} bytes.`);
writeFileSync(
  resolve(job, 'SHA256SUMS.txt'),
  files
    .map(
      (file) =>
        `${createHash('sha256')
          .update(readFileSync(resolve(media, file)))
          .digest('hex')}  media/${file}`,
    )
    .join('\n') + '\n',
  'utf8',
);
const failed = metrics.filter(
  (m) =>
    !m.baseline &&
    (m.horizontalOverflow > 1 ||
      m.verticalOverflow > 1 ||
      m.clipped.length ||
      m.unstyled.length ||
      !m.nunitoLoaded ||
      m.scrollers.some((s) => s.overflow > 1)),
);
console.log(
  JSON.stringify(
    {
      screens: metrics.length,
      currentScreens: metrics.filter((m) => !m.baseline).length,
      baseline: metrics
        .filter((m) => m.baseline)
        .map((m) => ({ name: m.name, clipped: m.clipped })),
      bytes,
      failed: failed.map((m) => ({
        name: m.name,
        clipped: m.clipped,
        unstyled: m.unstyled,
        scrollers: m.scrollers,
      })),
    },
    null,
    2,
  ),
);
if (failed.length) process.exitCode = 1;
