// P02 only: one isolated headless browser, one active page, sequential screenshots, finally cleanup.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createCDP } from './tools/cdp.mjs';
import { closeBrowserProfile } from './tools/close-browser.mjs';
import { browserEndpoint, verifyClosedProfile } from './capture-browser.mjs';
import { hashMedia } from './hash-media.mjs';

const job = import.meta.dirname;
const media = resolve(job, 'media');

function measure() {
  const main = document.querySelector('.evidence-main');
  if (!main) throw new Error('Evidence shell is missing.');
  const bounds = main.getBoundingClientRect();
  const all = [...main.querySelectorAll('*')];
  const named = (element) =>
    `${element.tagName.toLowerCase()}.${String(element.className).split(' ')[0]} ${(element.textContent ?? '').slice(0, 70)}`;
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    );
  };
  const content = all.filter(
    (element) =>
      element instanceof HTMLElement &&
      visible(element) &&
      (element.matches('h2,h3,p,li,button,[role=status],[role=timer]') ||
        (element.childElementCount === 0 && element.textContent?.trim())),
  );
  const clipped = content
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.top < bounds.top - 1 ||
        rect.bottom > bounds.bottom + 1 ||
        rect.left < bounds.left - 1 ||
        rect.right > bounds.right + 1
      );
    })
    .map(named);
  const scrollers = all
    .filter(
      (element) =>
        element instanceof HTMLElement && /auto|scroll/.test(getComputedStyle(element).overflowY),
    )
    .map((element) => ({
      element: named(element),
      overflow: element.scrollHeight - element.clientHeight,
    }));
  const rules = [];
  const walk = (list) => {
    for (const rule of list) {
      if (rule.selectorText) rules.push(rule.selectorText);
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) walk(sheet.cssRules);
  const classes = new Set(
    all.flatMap((element) => [...element.classList]).filter((name) => name.startsWith('_')),
  );
  return {
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    verticalOverflow: document.documentElement.scrollHeight - innerHeight,
    main: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    scrollers,
    clipped,
    unstyled: [...classes].filter((name) => !rules.some((rule) => rule.includes(`.${name}`))),
    touchTargets: [...main.querySelectorAll('button')].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute('aria-label') ?? element.textContent,
        width: rect.width,
        height: rect.height,
      };
    }),
    textSizes: content.map((element) => ({
      element: named(element),
      fontSize: parseFloat(getComputedStyle(element).fontSize),
    })),
    truncatedNames: [...main.querySelectorAll('[title]')]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.getAttribute('title')),
  };
}

async function capture() {
  const frames = JSON.parse(readFileSync(resolve(media, 'capture-manifest.json'), 'utf8'));
  if (!Array.isArray(frames) || frames.length < 68)
    throw new Error('Emit all canonical P02 HTML first.');
  const names = new Set();
  for (const frame of frames) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frame.name) || names.has(frame.name))
      throw new Error('Capture names must be unique safe filenames.');
    names.add(frame.name);
    if (![1920, 390].includes(frame.width) || ![1080, 844].includes(frame.height))
      throw new Error(`Unexpected P02 viewport: ${frame.name}`);
  }
  const browserPath =
    process.env.P02_BROWSER ??
    [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ].find(existsSync);
  if (!browserPath || !existsSync(browserPath))
    throw new Error('P02 capture needs a local Chrome or Edge executable.');
  const profile = mkdtempSync(join(tmpdir(), 'p02-rea-capture-'));
  const { rpc, connect } = createCDP();
  let processHandle;
  let browserSocket;
  let socket;
  const metrics = [];
  try {
    processHandle = spawn(
      browserPath,
      [
        '--headless=new',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=0',
        '--remote-debugging-address=127.0.0.1',
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    const endpoint = await browserEndpoint(processHandle, profile);
    browserSocket = await connect(endpoint);
    const { targetId } = await rpc(browserSocket, 'Target.createTarget', { url: 'about:blank' });
    const base = endpoint.slice(0, endpoint.indexOf('/devtools/')).replace('ws:', 'http:');
    const response = await fetch(`${base}/json/list`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`DevTools target lookup failed: ${response.status}`);
    const targets = await response.json();
    const target = targets.find((entry) => entry.id === targetId);
    if (!target) throw new Error('The owned capture page was not published.');
    socket = await connect(target.webSocketDebuggerUrl);
    await rpc(browserSocket, 'Target.activateTarget', { targetId });
    await rpc(socket, 'Page.enable');
    await rpc(socket, 'Runtime.enable');
    const { frameTree } = await rpc(socket, 'Page.getFrameTree');
    for (const [index, frame] of frames.entries()) {
      await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
        width: frame.width,
        height: frame.height,
        deviceScaleFactor: 1,
        mobile: frame.surface !== 'tv',
      });
      // Use exact standalone HTML in the owned active blank page; Windows file navigation can stall.
      await rpc(socket, 'Page.setDocumentContent', {
        frameId: frameTree.frame.id,
        html: readFileSync(resolve(media, `${frame.name}.html`), 'utf8'),
      });
      await rpc(socket, 'Runtime.evaluate', {
        expression: 'document.fonts.ready.then(()=>true)',
        awaitPromise: true,
      });
      await rpc(socket, 'Runtime.evaluate', {
        expression:
          'new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done(true))))',
        awaitPromise: true,
      });
      const result = await rpc(socket, 'Runtime.evaluate', {
        expression: `(${measure.toString()})()`,
        returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      metrics.push({ name: frame.name, ...result.result.value });
      const png = resolve(media, `${frame.name}.png`);
      // All 92 HTML frames are retained; added modes get TV/phone-only review PNGs.
      if (
        !frame.name.startsWith('solo-') &&
        (frame.surface === 'tv' || frame.surface === 'phone-only')
      ) {
        const shot = await rpc(socket, 'Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
          fromSurface: true,
          optimizeForSpeed: false,
        });
        writeFileSync(png, Buffer.from(shot.data, 'base64'));
      } else if (existsSync(png)) unlinkSync(png); // One validated manifest filename, never a directory.
      if ((index + 1) % 8 === 0 || index + 1 === frames.length)
        console.log(`P02 captured ${index + 1}/${frames.length}.`);
    }
    writeFileSync(
      resolve(media, 'layout-metrics.json'),
      JSON.stringify(metrics, null, 2) + '\n',
      'utf8',
    );
  } finally {
    if (browserSocket?.readyState === WebSocket.OPEN) {
      try {
        await Promise.race([
          rpc(browserSocket, 'Browser.close'),
          new Promise((done) => setTimeout(done, 3000)),
        ]);
      } catch {
        /* Browser shutdown can race its reply. */
      }
    }
    socket?.close();
    browserSocket?.close();
    await closeBrowserProfile(profile);
    if (processHandle?.pid && processHandle.exitCode === null) {
      if (process.platform === 'win32')
        spawnSync('taskkill.exe', ['/PID', String(processHandle.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
          timeout: 6000,
        });
      else processHandle.kill('SIGKILL');
    }
    if (!(await verifyClosedProfile(profile)))
      throw new Error(`Could not confirm the owned capture browser is closed: ${profile}`);
    // Keep the unique OS profile; no recursive deletion of computed filesystem paths.
    console.log('P02 owned capture browser closed.');
  }
  const budget = hashMedia(job);
  const failed = metrics.filter(
    (row) =>
      row.horizontalOverflow > 1 ||
      row.verticalOverflow > 1 ||
      row.clipped.length ||
      row.unstyled.length ||
      row.scrollers.some((item) => item.overflow > 1),
  );
  console.log(
    JSON.stringify(
      {
        screens: metrics.length,
        ...budget,
        failed: failed.map(
          ({ name, horizontalOverflow, verticalOverflow, clipped, unstyled, scrollers }) => ({
            name,
            horizontalOverflow,
            verticalOverflow,
            clipped,
            unstyled,
            scrollers,
          }),
        ),
      },
      null,
      2,
    ),
  );
  if (failed.length) process.exitCode = 1;
}

if (process.env.WRITE_P02_EVIDENCE === '1') await capture();
else
  console.log('P02 capture disabled; set WRITE_P02_EVIDENCE=1 after emitting its standalone HTML.');
