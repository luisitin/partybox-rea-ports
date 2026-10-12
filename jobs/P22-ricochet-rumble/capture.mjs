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
const temp = mkdtempSync(resolve(tmpdir(), 'pb-tank-trouble-capture-'));
const profile = resolve(temp, 'capture-profile');
let port;
const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!browserPath) throw new Error('Neither the standard Chrome nor Edge executable exists.');
const cases = JSON.parse(readFileSync(resolve(media, 'capture-manifest.json'), 'utf8'));
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
  call(method, params = {}) {
    return new Promise((resolveCall, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DevTools timed out: ${method}`));
      }, 30000);
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
  const bounds = main.getBoundingClientRect();
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
      const r = el.getBoundingClientRect();
      return (
        r.top < bounds.top - 1 ||
        r.bottom > bounds.bottom + 1 ||
        r.left < bounds.left - 1 ||
        r.right > bounds.right + 1
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
  // Computed RGB colours are in sRGB. Composite transparency and element opacity over
  // ancestor surfaces before applying the WCAG luminance formula; this is diagnostic only.
  const rgb = (value) => {
    if (value === 'transparent') return [0, 0, 0, 0];
    const match = value.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null;
    const parts = match[1].trim().split(/[\s,/]+/);
    const channels = parts
      .slice(0, 3)
      .map((part) => (part.endsWith('%') ? (parseFloat(part) * 255) / 100 : parseFloat(part)));
    const alpha = parts[3] ? parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1) : 1;
    return channels.length === 3 && [...channels, alpha].every(Number.isFinite)
      ? [...channels, alpha]
      : null;
  };
  const over = (front, back) => {
    const alpha = front[3] + back[3] * (1 - front[3]);
    return alpha === 0
      ? [0, 0, 0, 0]
      : [
          ...front
            .slice(0, 3)
            .map(
              (channel, index) =>
                (channel * front[3] + back[index] * back[3] * (1 - front[3])) / alpha,
            ),
          alpha,
        ];
  };
  const luminance = (colour) => {
    const linear = colour.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const buttonContrast = (el, style) => {
    let text = rgb(style.color);
    let background = [0, 0, 0, 0];
    let hasBackgroundImage = false;
    for (let node = el; node && text; node = node.parentElement) {
      const surface = getComputedStyle(node);
      const colour = rgb(surface.backgroundColor);
      hasBackgroundImage ||=
        surface.backgroundImage !== 'none' && (text[3] < 1 || background[3] < 1);
      if (!colour) {
        text = null;
        break;
      }
      text = over(text, colour);
      background = over(background, colour);
      const opacity = parseFloat(surface.opacity);
      text[3] *= opacity;
      background[3] *= opacity;
    }
    if (!text)
      return {
        contrastRatio: null,
        minimumNormalTextContrast: 4.5,
        passesNormalTextContrast: null,
        contrastBasis: 'unparsed computed colour',
      };
    text = over(text, [255, 255, 255, 1]);
    background = over(background, [255, 255, 255, 1]);
    const foregroundLuminance = luminance(text);
    const backgroundLuminance = luminance(background);
    const ratio =
      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
    const colourText = (colour) =>
      `rgb(${colour
        .slice(0, 3)
        .map((channel) => Number(channel.toFixed(2)))
        .join(', ')})`;
    return {
      effectiveTextColor: colourText(text),
      effectiveBackgroundColor: colourText(background),
      contrastRatio: Number(ratio.toFixed(3)),
      minimumNormalTextContrast: 4.5,
      passesNormalTextContrast: ratio >= 4.5,
      contrastBasis: hasBackgroundImage
        ? 'solid colours; background images omitted'
        : 'solid colours',
    };
  };
  return {
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    verticalOverflow: document.documentElement.scrollHeight - innerHeight,
    main: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    scrollers,
    clipped,
    unstyled,
    touchTargets: [...main.querySelectorAll('button')].map((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const disabled = el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true';
      return {
        label: el.getAttribute('aria-label') ?? el.textContent,
        width: r.width,
        height: r.height,
        enabled: !disabled,
        disabled,
        textColor: style.color,
        backgroundColor: style.backgroundColor,
        opacity: parseFloat(style.opacity),
        ...buttonContrast(el, style),
      };
    }),
    textSizes: content.map((el) => ({
      element: named(el),
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    })),
  };
}

let browser;
let socket;
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
  const dev = new Devtools(socket);
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
    await dev.call('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(()=>true)',
      awaitPromise: true,
    });
    const result = await dev.call('Runtime.evaluate', {
      expression: `(${measure.toString()})()`,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    metrics.push({ name: frame.name, ...result.result.value });
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
        }, 5000);
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
      console.warn(
        `Owned browser PID ${browser.pid} has not reported exit; preserving its profile.`,
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
    !temp.startsWith(`${osTemp}\\pb-tank-trouble-capture-`) &&
    !temp.startsWith(`${osTemp}/pb-tank-trouble-capture-`)
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
    m.horizontalOverflow > 1 ||
    m.verticalOverflow > 1 ||
    m.clipped.length ||
    m.unstyled.length ||
    m.scrollers.some((s) => s.overflow > 1),
);
console.log(
  JSON.stringify(
    {
      screens: metrics.length,
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
