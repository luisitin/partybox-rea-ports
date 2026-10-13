// Imported by capture.mjs: reuse its existing CDP browser/page, never start another Chrome.
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { auditLayout } from './capture-audit.mjs';
import { runScenarios } from './interaction-scenarios.mjs';

const job = dirname(fileURLToPath(import.meta.url));
const repo = resolve(job, '../..');
const media = join(job, 'media');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Vite 8 bundles with its installed Rolldown/Oxc; no additional build dependency is installed. */
export async function buildInteractionBundle() {
  const require = createRequire(join(repo, 'package.json'));
  const vitestRequire = createRequire(require.resolve('vitest'));
  const vite = await import(pathToFileURL(vitestRequire.resolve('vite')).href);
  const result = await vite.build({
    root: repo,
    configFile: false,
    mode: 'production',
    resolve: {
      alias: [
        {
          find: /^@partybox\/game-sdk\/ui$/,
          replacement: join(repo, 'packages/game-sdk/src/ui.ts'),
        },
        {
          find: /^@partybox\/game-sdk$/,
          replacement: join(repo, 'packages/game-sdk/src/index.ts'),
        },
      ],
    },
    oxc: { jsx: { runtime: 'automatic' } },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
    build: {
      write: false,
      outDir: join(media, 'interaction-build'),
      emptyOutDir: false,
      minify: true,
      target: 'chrome120',
      cssCodeSplit: false,
      lib: {
        entry: join(job, 'interaction.tsx'),
        formats: ['iife'],
        name: 'P24InteractionHarness',
        fileName: 'interaction',
      },
    },
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output);
  const script = output.find(
    (file) => file.type === 'chunk' && file.fileName.endsWith('.js'),
  )?.code;
  const source = output.find(
    (file) => file.type === 'asset' && file.fileName.endsWith('.css'),
  )?.source;
  const css =
    typeof source === 'string' ? source : source ? Buffer.from(source).toString('utf8') : undefined;
  if (!script || !css) throw new Error('Interaction bundle requires both JavaScript and CSS.');
  return { script, css };
}

function documentHtml(css) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P24 real controller interaction QA</title><style>${css}
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}
    body{display:flex;flex-direction:column}.chrome,.bottom{flex:none;height:70px;display:flex;align-items:center;justify-content:center;font-size:var(--pb-font-caption)}
    .chrome{border-bottom:1px solid var(--pb-surface-2);font-weight:800}.mount{flex:1;min-height:0}.bottom{color:var(--pb-text-muted)}
  </style></head><body><div class="chrome">PB · R3 · Public-view interaction QA</div><div class="mount" id="root"></div><div class="bottom">Haxball · Phone controller</div></body></html>`;
}

/** Preserve JavaScript literally: React bundles contain String.replace tokens such as $&. */
export function buildInteractionDocument(css, script, views) {
  if (typeof script !== 'string' || typeof css !== 'string')
    throw new Error('Mounted document requires string JavaScript and CSS.');
  const json = JSON.stringify(views).replace(/</g, '\\u003c');
  const setup = `window.harnessViews=${json}; window.harnessPhoneOnly=true;
    window.qaPointers=[]; window.qaKeys=[]; window.qaErrors=[];
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture']) {
      window.addEventListener(type,event=>window.qaPointers.push({type,pointerId:event.pointerId,
        pointerType:event.pointerType,trusted:event.isTrusted,
        control:event.target?.closest?.('[data-hax-control]')?.getAttribute('data-hax-control')??null}),true);
    }
    for(const type of ['keydown','keyup']) window.addEventListener(type,event=>window.qaKeys.push({type,key:event.key,repeat:event.repeat,trusted:event.isTrusted}),true);
    window.addEventListener('error',event=>window.qaErrors.push(String(event.message)));
    window.addEventListener('unhandledrejection',event=>window.qaErrors.push(String(event.reason)));`;
  const inlineScript = script.replace(/<\/script/gi, '<\\/script');
  // A callback disables replacement-string expansion ($&, $`, $'), which corrupts minified JS.
  return documentHtml(css).replace(
    '</body>',
    () => `<script>${setup}</script><script>${inlineScript}</script></body>`,
  );
}

/** Called only after static captures, with the capture owner's existing browser/page session. */
export async function runInteraction(cdp, sessionId, isStopping = () => false) {
  const report = {
    capturedAt: new Date().toISOString(),
    source: 'media/interaction-views.json: public controller views only',
    viewport: { width: 390, height: 844 },
    browserOwnership: 'Reuses capture.mjs browser and attached page; launches no browser.',
    checks: [],
    captures: [],
    passed: false,
  };
  let mounted = false;
  const check = (name, passed, observed) => {
    report.checks.push({ name, passed: !!passed, observed });
    console.log(`P24 mounted: ${passed ? 'PASS' : 'FAIL'} ${name}`);
  };
  const evaluate = async (expression) => {
    if (isStopping()) throw new Error('Mounted capture interrupted.');
    const result = await cdp.send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const capture = async (name) => {
    const layout = await evaluate(`(${auditLayout.toString()})(true)`);
    const fits =
      !layout.overflow.horizontal &&
      !layout.overflow.vertical &&
      layout.summary.controlIssues === 0 &&
      layout.summary.offscreen === 0 &&
      layout.summary.textClipped === 0 &&
      layout.summary.scrollContainers === 0;
    check(`mounted layout fits: ${name}`, fits, {
      summary: layout.summary,
      overflow: layout.overflow,
    });
    const screenshot = await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false },
      sessionId,
    );
    await writeFile(join(media, name), Buffer.from(screenshot.data, 'base64'));
    report.captures.push({ file: name, ...layout });
  };
  try {
    report.browserVersion = await cdp.send('Browser.getVersion');
    const views = JSON.parse(await readFile(join(media, 'interaction-views.json'), 'utf8'));
    const required = [
      'play',
      'accepted',
      'paused',
      'goal',
      'next-play',
      'departed',
      'spectator',
      'done',
      'kick-fired',
      'kick-fired-new',
    ];
    for (const name of required) {
      const view = views[name];
      if (!view || view.gameId !== 'haxball' || !view.me || !Array.isArray(view.discs))
        throw new Error(`Missing public Haxball controller view: ${name}`);
      if (['intents', 'rng', 'phase', 'playersState'].some((key) => Object.hasOwn(view, key)))
        throw new Error(`Private server state supplied to mounted page: ${name}`);
    }
    const { script, css } = await buildInteractionBundle();
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: false,
        screenWidth: 390,
        screenHeight: 844,
      },
      sessionId,
    );
    await cdp.send(
      'Emulation.setTouchEmulationEnabled',
      { enabled: true, maxTouchPoints: 5 },
      sessionId,
    );
    await cdp.send(
      'Emulation.setEmulatedMedia',
      { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
      sessionId,
    );
    await cdp.send('Page.navigate', { url: 'about:blank' }, sessionId);
    for (let n = 0; n < 100; n++) {
      if (await evaluate('document.readyState === "complete" && location.href === "about:blank"'))
        break;
      await sleep(25);
      if (n === 99) throw new Error('Mounted page did not reach about:blank.');
    }
    const { frameTree } = await cdp.send('Page.getFrameTree', {}, sessionId);
    const html = buildInteractionDocument(css, script, views);
    await cdp.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html }, sessionId);
    for (let n = 0; n < 100; n++) {
      if (await evaluate('typeof window.harness?.reset === "function"')) {
        mounted = true;
        break;
      }
      await sleep(25);
    }
    if (!mounted) throw new Error('Real Haxball Controller did not mount.');
    await evaluate('document.fonts.ready');
    await sleep(40);
    const methods = await runScenarios({ cdp, sessionId, evaluate, check, capture });
    Object.assign(report, methods);

    // Same mounted Controller also fits the with-TV variant; no additional tab or process.
    await evaluate('window.harnessPhoneOnly=false; window.harness.reset("play")');
    await sleep(40);
    const withTv = await evaluate(`(${auditLayout.toString()})(true)`);
    check(
      'mounted with-TV controller fits',
      !withTv.overflow.horizontal &&
        !withTv.overflow.vertical &&
        withTv.summary.controlIssues === 0 &&
        withTv.summary.offscreen === 0 &&
        withTv.summary.textClipped === 0 &&
        withTv.summary.scrollContainers === 0,
      { summary: withTv.summary, overflow: withTv.overflow },
    );
    report.withTv = withTv;
  } catch (error) {
    let errors = [];
    try {
      errors = await evaluate('window.qaErrors??[]');
    } catch {
      /* Browser cleanup still belongs to the caller. */
    }
    check('mounted harness setup/scenario completion', false, {
      error: String(error),
      runtimeErrors: errors,
    });
  } finally {
    if (mounted) {
      try {
        await evaluate('window.harness.dispose()');
      } catch (error) {
        check('mounted controller cleanup', false, { error: String(error) });
      }
    }
    // Evidence is recorded before the owner closes its one private browser in capture.mjs finally.
    report.passed = report.checks.length > 0 && report.checks.every((item) => item.passed);
    await writeFile(
      join(media, 'interaction.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
    const entries = await readdir(media, { withFileTypes: true });
    const sizes = await Promise.all(
      entries.filter((entry) => entry.isFile()).map((entry) => stat(join(media, entry.name))),
    );
    const bytes = sizes.reduce((sum, entry) => sum + entry.size, 0);
    check('job media stays below 10 MB', bytes < 10_000_000, { bytes, limitBytes: 10_000_000 });
    report.passed = report.checks.every((item) => item.passed);
    await writeFile(
      join(media, 'interaction.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
  }
  return report;
}
