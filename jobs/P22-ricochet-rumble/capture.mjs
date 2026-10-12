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

// Runs only when requested, in the same owned page after its ordinary screenshots.
async function measureMotion() {
  const tank = [...document.querySelectorAll('.evidence-main svg g')].find(
    (el) =>
      [...el.classList].some((name) => /(?:^|[_-])tank(?:[_-]|$)/.test(name)) &&
      el.getAttribute('data-out') !== 'true',
  );
  if (!tank) return { status: 'unavailable', reason: 'No live Arena tank group found.' };
  const tankTitle = tank.querySelector('title')?.textContent ?? '';
  const number = tankTitle.match(/Tank (\d+):/)?.[1];
  const scene = tank.closest('svg').parentElement;
  const label = [...scene.querySelectorAll('span')].find(
    (el) =>
      [...el.classList].some((name) => /(?:^|[_-])number(?:[_-]|$)/.test(name)) &&
      el.textContent.trim() === number,
  );
  if (!label) return { status: 'unavailable', reason: 'Matching tank number label not found.' };
  const motionAttributes = [...document.querySelectorAll('[data-motion="off"]')].map((el) => ({
    el,
    value: el.getAttribute('data-motion'),
  }));
  const original = {
    transform: tank.getAttribute('transform'),
    cssTransform: tank.style.getPropertyValue('transform'),
    cssTransformPriority: tank.style.getPropertyPriority('transform'),
    left: label.style.getPropertyValue('left'),
    leftPriority: label.style.getPropertyPriority('left'),
  };
  const restoreProperty = (el, property, value, priority) => {
    if (value) el.style.setProperty(property, value, priority);
    else el.style.removeProperty(property);
  };
  try {
    for (const { el } of motionAttributes) el.removeAttribute('data-motion');
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const readPose = () => {
      const style = getComputedStyle(tank);
      const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
      return { x: matrix.e, y: matrix.f, labelLeftPx: parseFloat(getComputedStyle(label).left) };
    };
    const tankStyle = getComputedStyle(tank);
    const labelStyle = getComputedStyle(label);
    const before = readPose();
    const matrix = new DOMMatrix(tankStyle.transform === 'none' ? undefined : tankStyle.transform);
    matrix.e += 5;
    const labelShiftPx = (tank.closest('svg').getBoundingClientRect().width * 5) / 160;
    const expected = {
      x: before.x + 5,
      y: before.y,
      labelLeftPx: before.labelLeftPx + labelShiftPx,
    };
    const mutation = original.cssTransform ? 'inline-css' : 'svg-attribute';
    const start = performance.now();
    if (mutation === 'inline-css') tank.style.setProperty('transform', matrix.toString());
    else
      tank.setAttribute(
        'transform',
        `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`,
      );
    label.style.setProperty('left', `${expected.labelLeftPx}px`);
    const samples = [];
    const sample = (kind) =>
      samples.push({ kind, elapsedMs: performance.now() - start, ...readPose() });
    sample('immediate');
    await new Promise((done) => {
      let frame;
      const tick = () => {
        sample('frame');
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      setTimeout(() => {
        cancelAnimationFrame(frame);
        sample('final');
        done();
      }, 400);
    });
    const between = (value, from, to) =>
      value > Math.min(from, to) + 0.01 && value < Math.max(from, to) - 0.01;
    const intermediateTankPoses = samples.filter((pose) =>
      between(pose.x, before.x, expected.x),
    ).length;
    const intermediateLabelPositions = samples.filter((pose) =>
      between(pose.labelLeftPx, before.labelLeftPx, expected.labelLeftPx),
    ).length;
    const immediate = samples[0];
    const final = samples.at(-1);
    const mid = samples.reduce((nearest, pose) =>
      Math.abs(pose.elapsedMs - 100) < Math.abs(nearest.elapsedMs - 100) ? pose : nearest,
    );
    const immediateEnd =
      Math.abs(immediate.x - expected.x) <= 0.01 &&
      Math.abs(immediate.labelLeftPx - expected.labelLeftPx) <= 0.01;
    return {
      status: 'measured',
      tankTitle,
      tankClass: tank.getAttribute('class'),
      labelClass: label.getAttribute('class'),
      mutation,
      originalTransform: original.transform,
      originalCssTransform: original.cssTransform,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      transition: {
        tank: { property: tankStyle.transitionProperty, duration: tankStyle.transitionDuration },
        label: { property: labelStyle.transitionProperty, duration: labelStyle.transitionDuration },
      },
      shiftWorldUnits: 5,
      before,
      expected,
      immediate,
      mid,
      final,
      samples,
      intermediateTankPoses,
      intermediateLabelPositions,
      tankBehavior: intermediateTankPoses ? 'interpolated' : 'jump',
      labelBehavior: intermediateLabelPositions ? 'interpolated' : 'jump',
      immediateEnd,
      finalReachedEnd:
        Math.abs(final.x - expected.x) <= 0.01 &&
        Math.abs(final.labelLeftPx - expected.labelLeftPx) <= 0.01,
    };
  } finally {
    if (original.transform === null) tank.removeAttribute('transform');
    else tank.setAttribute('transform', original.transform);
    restoreProperty(tank, 'transform', original.cssTransform, original.cssTransformPriority);
    restoreProperty(label, 'left', original.left, original.leftPriority);
    for (const { el, value } of motionAttributes) el.setAttribute('data-motion', value);
  }
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
  if (process.env.PB_MEASURE_MOTION === '1') {
    const probes = [];
    const probeFrame = cases.find((frame) => frame.name === 'play-tv');
    const previousFrame = cases.at(-1);
    try {
      if (!probeFrame) throw new Error('Motion probe needs the existing play-tv fixture.');
      await dev.call('Emulation.setDeviceMetricsOverride', {
        width: probeFrame.width,
        height: probeFrame.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      for (const preference of ['no-preference', 'reduce']) {
        await dev.call('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: preference }],
        });
        await dev.call('Page.setDocumentContent', {
          frameId: frameTree.frame.id,
          html: readFileSync(resolve(media, `${probeFrame.name}.html`), 'utf8'),
        });
        const result = await dev.call('Runtime.evaluate', {
          expression: `(${measureMotion.toString()})()`,
          awaitPromise: true,
          returnByValue: true,
        });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        probes.push({ preference, ...result.result.value });
      }
    } catch (error) {
      probes.push({ status: 'error', reason: error.message });
      console.warn(`Motion diagnostic: ${error.message}`);
    } finally {
      try {
        await dev.call('Emulation.setEmulatedMedia', { features: [] });
        if (previousFrame) {
          await dev.call('Emulation.setDeviceMetricsOverride', {
            width: previousFrame.width,
            height: previousFrame.height,
            deviceScaleFactor: 1,
            mobile: previousFrame.surface !== 'tv',
          });
          await dev.call('Page.setDocumentContent', {
            frameId: frameTree.frame.id,
            html: readFileSync(resolve(media, `${previousFrame.name}.html`), 'utf8'),
          });
        }
      } catch (error) {
        probes.push({ status: 'restore-error', reason: error.message });
      }
    }
    const motionFile = resolve(media, 'motion-results.json');
    let priorRuns = [];
    if (existsSync(motionFile)) {
      try {
        const prior = JSON.parse(readFileSync(motionFile, 'utf8'));
        if (Array.isArray(prior.runs)) priorRuns = prior.runs;
      } catch {}
    }
    const hasTween = probes
      .find((probe) => probe.preference === 'no-preference')
      ?.transition?.tank?.duration?.split(',')
      .some((duration) => parseFloat(duration) > 0);
    writeFileSync(
      motionFile,
      JSON.stringify(
        {
          diagnosticOnly: true,
          runs: [
            ...priorRuns,
            {
              label: process.env.PB_MOTION_LABEL ?? (hasTween ? 'css-tween' : 'original-snapshot'),
              artifact: `${probeFrame?.name ?? 'play-tv'}.html`,
              artifactSha256: probeFrame
                ? createHash('sha256')
                    .update(readFileSync(resolve(media, `${probeFrame.name}.html`)))
                    .digest('hex')
                : null,
              probes,
            },
          ],
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    console.log(`Recorded ${probes.length} motion diagnostics in media/motion-results.json.`);
  }
} catch (error) {
  console.error('Capture failed:', error);
  throw error;
} finally {
  if (dev && socket?.readyState === WebSocket.OPEN) {
    let closeTimeout;
    try {
      await Promise.race([
        dev.call('Browser.close', {}, 1500),
        new Promise((done) => (closeTimeout = setTimeout(done, 2000))),
      ]);
    } catch {
      // The owned process-tree fallback below also covers a closed/unresponsive CDP connection.
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
        `Owned browser PID ${browser.pid} closure is unverified; preserving its profile at ${profile}.`,
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
