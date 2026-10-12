// Imported by capture.mjs: reuse its existing CDP browser/page, never start another Chrome.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { auditLayout } from './capture-audit.mjs';
import { runInteractionScenarios } from './interaction-scenarios.mjs';

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
        name: 'P03InteractionHarness',
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P03 real controller interaction QA</title><style>${css}
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}
    body{display:flex;flex-direction:column}.chrome,.bottom{flex:none;height:70px;display:flex;align-items:center;justify-content:center;font-size:var(--pb-font-caption)}
    .chrome{border-bottom:1px solid var(--pb-surface-2);font-weight:800}.mount{flex:1;min-height:0}.bottom{color:var(--pb-text-muted)}
  </style></head><body><div class="chrome">PB · R3 · Public-view interaction QA</div><div class="mount" id="root"></div><div class="bottom">Trivia Lightning · Phone controller</div></body></html>`;
}

/** Real DOM events, React state and server-view pushes in the capture runner's one existing page. */
export async function runInteractionAudit(cdp, sessionId, { writeHtml = false } = {}) {
  const report = { capturedAt: new Date().toISOString(), checks: [], captures: [] };
  async function evaluate(expression) {
    const value = await cdp.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails));
    return value.result.value;
  }
  const check = (name, passed, observed) => {
    report.checks.push({ name, passed: Boolean(passed), observed });
  };
  async function waitFor(predicate, name) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const state = await readUi();
      if (predicate(state)) return state;
      await sleep(25);
    }
    throw new Error(`Interaction did not settle: ${name}`);
  }
  const readUi = () =>
    evaluate(`(() => {
      const power = document.querySelector('section[aria-label="Power-ups"]');
      const target = power?.querySelector('select');
      const next = document.querySelector('[role="status"][data-correct] button');
      return {
        sent: window.harness.sent, cues: window.harness.cues,
        vibrations: window.harnessVibrations, now: window.harness.now, kind: window.harness.kind,
        text: document.body.innerText,
        header: document.querySelector('header')?.innerText ?? '',
        statuses: [...document.querySelectorAll('[role="status"]')].map(node => node.textContent.trim()),
        powers: [...(power?.querySelectorAll('button') ?? [])].map(node => ({text:node.textContent.trim(),disabled:node.disabled})),
        target: target ? {value:target.value,disabled:target.disabled,options:[...target.options].map(option => ({value:option.value,text:option.textContent.trim()}))} : null,
        answers: [...document.querySelectorAll('[aria-label="Choose an answer"] button')].map(node => ({text:node.textContent.trim(),disabled:node.disabled,selected:node.hasAttribute('data-selected')})),
        next: next ? {text:next.textContent.trim(),disabled:next.disabled} : null,
      };
    })()`);
  async function click(selector, text = '') {
    const bounds = await evaluate(`(() => {
      const node = [...document.querySelectorAll(${JSON.stringify(selector)})].find(candidate => candidate.textContent.includes(${JSON.stringify(text)}));
      if (!node) throw new Error('Missing interaction control: ' + ${JSON.stringify(text || selector)});
      const rect = node.getBoundingClientRect();
      return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
    })()`);
    for (const type of ['mousePressed', 'mouseReleased'])
      await cdp.send(
        'Input.dispatchMouseEvent',
        { type, ...bounds, button: 'left', clickCount: 1 },
        sessionId,
      );
  }
  async function select(value) {
    const index = await evaluate(`(() => {
      const target = document.querySelector('select[aria-label="Rival to freeze"]');
      if (!target || target.disabled) throw new Error('Freeze target picker is unavailable.');
      target.focus();
      return [...target.options].findIndex(option => option.value === ${JSON.stringify(value)});
    })()`);
    if (index < 0) throw new Error(`No eligible freeze target ${value}.`);
    const keys = [
      ['Home', 36],
      ...Array.from({ length: index }, () => ['ArrowDown', 40]),
      ['Escape', 27],
    ];
    for (const [key, windowsVirtualKeyCode] of keys)
      for (const type of ['keyDown', 'keyUp'])
        await cdp.send('Input.dispatchKeyEvent', { type, key, windowsVirtualKeyCode }, sessionId);
    return waitFor((state) => state.target?.value === value, 'target selection');
  }
  async function snapshot(name) {
    const audit = await evaluate(`(${auditLayout.toString()})(true)`);
    const png = await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false },
      sessionId,
    );
    const file = `phone-interaction-${name}`;
    await writeFile(join(media, `${file}.png`), Buffer.from(png.data, 'base64'));
    if (writeHtml) {
      const html = await evaluate('document.documentElement.outerHTML');
      await writeFile(join(media, `${file}.html`), `<!doctype html>${html}\n`, 'utf8');
    }
    report.captures.push({ file: `${file}.png`, ...audit });
    check(
      `${name}: layout fits`,
      !audit.overflow.horizontal &&
        !audit.overflow.vertical &&
        ['controlIssues', 'offscreen', 'textClipped', 'scrollContainers'].every(
          (key) => audit.summary[key] === 0,
        ),
      { summary: audit.summary, overflow: audit.overflow },
    );
  }
  try {
    const views = JSON.parse(await readFile(join(media, 'interaction-views.json'), 'utf8'));
    if (/"correctIndex"|"deck"|"runners"/.test(JSON.stringify(views)))
      throw new Error('Interaction fixtures must contain public controller views only.');
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
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true }, sessionId);
    const { frameTree } = await cdp.send('Page.getFrameTree', {}, sessionId);
    await cdp.send(
      'Page.setDocumentContent',
      { frameId: frameTree.frame.id, html: documentHtml(css) },
      sessionId,
    );
    await evaluate(`window.harnessViews=${JSON.stringify(views)};window.harnessPhoneOnly=true;
      window.harnessVibrations=[];
      Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.harnessVibrations.push(pattern);return true;}});`);
    await evaluate(script);
    await evaluate('document.fonts.ready.then(() => true)');
    await waitFor(
      (state) => state.powers.length === 2 && state.answers.length === 4,
      'controller mount',
    );
    await runInteractionScenarios({
      evaluate,
      readUi,
      waitFor,
      click,
      select,
      check,
      snapshot,
      views,
    });
  } catch (error) {
    report.error = String(error);
  } finally {
    try {
      await evaluate('window.harness?.dispose()');
    } catch {
      /* Browser closure remains capture.mjs responsibility. */
    }
    report.passed =
      !report.error && report.checks.length > 0 && report.checks.every((entry) => entry.passed);
    await writeFile(
      join(media, 'interaction.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
  }
  return report;
}
