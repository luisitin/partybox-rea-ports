// One owned browser, real mounted components, reducer-driven native interaction proof.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cdp, devToolsEndpoint, ownedProfile, closeProfileProcesses } from './safe-cdp.mjs';
import {
  runtimeSources,
  dependencySources,
  sameSources,
  sourceChanges,
  hashes,
} from './provenance.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const media = join(directory, 'media');
const pilot = process.env.PB_CAPTURE_PILOT === '1';
const base = new URL(process.env.PB_INTERACTIVE_BASE ?? '');
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/')
  throw new Error('A fresh owned loopback preview is required');
const identity = await fetch(new URL('/__p05_preview', base), {
  headers: { 'x-p05-preview-token': process.env.PB_PREVIEW_TOKEN ?? '' },
  signal: AbortSignal.timeout(5000),
});
if (!identity.ok) throw new Error('Preview ownership check failed');
const preview = await identity.json();
if (
  preview.job !== 'P05' ||
  preview.token !== process.env.PB_PREVIEW_TOKEN ||
  resolve(preview.root) !== resolve(directory, '../..') ||
  preview.phoneShell?.top !== 83.6 ||
  preview.phoneShell?.bottom !== 0
)
  throw new Error('Preview identity or pinned owner shell differs');
const before = { ...runtimeSources(), ...dependencySources() };
const inputPaths = (await readdir(media))
  .filter((name) => /\.(?:html|css)$/.test(name))
  .map((name) => 'jobs/P05-blob-arena/media/' + name);
const harnessPaths = [
  'capture-r1.mjs',
  'capture-owned.mjs',
  'safe-cdp.mjs',
  'interactive.tsx',
  'interactive.html',
  'screens.mjs',
  'screens.json',
  'preview.mjs',
  'provenance.mjs',
]
  .map((name) => 'jobs/P05-blob-arena/' + name)
  .concat(inputPaths);
const harnessBefore = hashes(harnessPaths);
const chrome = process.env.PB_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const report = {
  job: 'P05',
  runId: 'r1-local',
  mode: pilot ? 'diagnostic-pilot' : 'complete-current-source',
  expectedBaseCaptures: 63,
  selectedBaseCaptures: pilot ? 5 : 63,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  sourceScope: 'Game runtime/client/tests/fixtures and SDK/shared/dependency configuration',
  sources: before,
  sourcesAfter: null,
  sourcesStable: false,
  sourceChanges: [],
  harnessScope: 'Capture/mount/preview/provenance tooling and all rendered HTML/CSS/input metadata',
  harnessBefore,
  harnessAfter: null,
  harnessStable: false,
  harnessChanges: [],
  browserPid: null,
  profile: null,
  browserClosed: false,
  cleanup: null,
  ownerShell: {
    pin: '0a977',
    authoredLocalFrame: true,
    ordinaryPhoneTop: 83.6,
    vipPhoneTop: 87.6,
    phoneFooter: 0,
    tvTop: 167.2,
    tvBottom: 80,
    tvOuterHeight: 832.8,
    gameOwnsStagePadding: true,
  },
  mountedCaptures: [],
  nativeChecks: [],
  motion: [],
  passed: false,
  incomplete: true,
  error: null,
};
let browser, cdp, profile, sessionId, failure;
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function evaluate(expression) {
  const result = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function settle() {
  await evaluate(
    '(async()=>{await document.fonts.ready;await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));return true})()',
  );
}
async function load(path, width, height, reduced = false) {
  // Invalidate the previous document's harness flag before asynchronous navigation.
  await evaluate('window.__blobReady = false');
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 1000,
      screenWidth: width,
      screenHeight: height,
    },
    sessionId,
  );
  await cdp.send(
    'Emulation.setEmulatedMedia',
    {
      features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
    },
    sessionId,
  );
  await cdp.send('Page.navigate', { url: new URL(path, base).href }, sessionId);
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    if (
      await evaluate(
        'window.__blobReady === true && document.getElementById("root")?.dataset.ready === "true"',
      )
    ) {
      await settle();
      assert(!(await evaluate('window.__blobStatus.error')), 'Mounted preview reported an error');
      return;
    }
    await pause(100);
  }
  throw new Error('Actual component mount timed out: ' + path);
}
function measure() {
  const box = (rect) =>
    Object.fromEntries(
      ['x', 'y', 'width', 'height', 'right', 'bottom'].map((key) => [key, +rect[key].toFixed(2)]),
    );
  const root = document.getElementById('root');
  const frame = root.getBoundingClientRect();
  const html = [...root.querySelectorAll('*')].filter(
    (node) => node instanceof HTMLElement && !node.closest('svg'),
  );
  const visible = (node) => {
    const r = node.getBoundingClientRect(),
      s = getComputedStyle(node);
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const describe = (node) => ({
    tag: node.tagName,
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
    rect: box(node.getBoundingClientRect()),
  });
  const outside = html
    .filter(visible)
    .filter((node) => {
      const r = node.getBoundingClientRect();
      return (
        r.left < frame.left - 1 ||
        r.right > frame.right + 1 ||
        r.top < frame.top - 1 ||
        r.bottom > frame.bottom + 1
      );
    })
    .map(describe);
  const clippedText = [],
    intentionalEllipsis = [];
  for (const node of html.filter(visible)) {
    if (
      ![...node.childNodes].some(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim(),
      )
    )
      continue;
    const s = getComputedStyle(node);
    if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) {
      const item = {
        ...describe(node),
        client: [node.clientWidth, node.clientHeight],
        scroll: [node.scrollWidth, node.scrollHeight],
        accessible: node.title || node.getAttribute('aria-label'),
      };
      if (s.textOverflow === 'ellipsis' && item.accessible) intentionalEllipsis.push(item);
      else clippedText.push(item);
    }
  }
  const buttons = [...root.querySelectorAll('button')].filter(visible).map((node) => ({
    label: node.getAttribute('aria-label'),
    disabled: node.disabled,
    rect: box(node.getBoundingClientRect()),
    passes44: node.getBoundingClientRect().width >= 44 && node.getBoundingClientRect().height >= 44,
  }));
  const arenas = [...root.querySelectorAll('[data-arena]')].map((node) => {
    const r = node.getBoundingClientRect();
    return {
      rect: box(r),
      viewBox: node.getAttribute('viewBox'),
      camera: node.dataset.camera,
      center: node.dataset.cameraCenter,
      zoom: node.dataset.cameraZoom,
      intentionalClipping: node.dataset.cameraClipping ?? null,
      worldTransform: getComputedStyle(node.querySelector('[data-world-layer]')).transform,
      worldTransition: getComputedStyle(node.querySelector('[data-world-layer]'))
        .transitionDuration,
    };
  });
  for (const node of root.querySelectorAll('[data-arena]')) {
    const r = node.getBoundingClientRect();
    if (
      r.left < frame.left - 1 ||
      r.right > frame.right + 1 ||
      r.top < frame.top - 1 ||
      r.bottom > frame.bottom + 1
    )
      outside.push(describe(node));
  }
  const personal = arenas.filter((a) => a.camera === 'personal');
  const cameraMeasured = personal.every((a) => {
    const values = a.viewBox.split(' ').map(Number);
    return Math.abs(values[2] - a.rect.width) < 1 && Math.abs(values[3] - a.rect.height) < 1;
  });
  const textFonts = html
    .filter(visible)
    .filter((node) =>
      [...node.childNodes].some(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim(),
      ),
    )
    .map((node) => ({
      text: (node.textContent ?? '').trim(),
      fontPx: parseFloat(getComputedStyle(node).fontSize),
    }));
  return {
    ready: window.__blobReady,
    status: window.__blobStatus,
    viewport: { width: innerWidth, height: innerHeight },
    frame: box(frame),
    ownerBanner: document.getElementById('p05-owner-banner')?.hidden
      ? null
      : box(document.getElementById('p05-owner-banner').getBoundingClientRect()),
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    },
    outside,
    clippedText,
    intentionalEllipsis,
    buttons,
    arenas,
    cameraMeasured,
    textFonts,
    intentionalWorldClippingExcluded: true,
  };
}
async function snapshot(name, metadata = {}) {
  const measured = await evaluate('(' + measure.toString() + ')()');
  const png = name + '.png';
  const captured = await cdp.send(
    'Page.captureScreenshot',
    { format: 'png', fromSurface: true, captureBeyondViewport: false },
    sessionId,
  );
  await writeFile(join(media, png), Buffer.from(captured.data, 'base64'));
  const result = { png, ...metadata, ...measured };
  report.mountedCaptures.push(result);
  console.log(
    JSON.stringify({
      stage: 'capture',
      png,
      outside: measured.outside.length,
      clippedText: measured.clippedText.length,
      cameraMeasured: measured.cameraMeasured,
    }),
  );
  assert(measured.outside.length === 0, png + ': game HTML escapes pinned host frame');
  assert(measured.clippedText.length === 0, png + ': non-ellipsis text clips');
  assert(
    measured.buttons.every((button) => button.passes44),
    png + ': touch target below44px',
  );
  assert(measured.cameraMeasured, png + ': personal camera did not use measured live viewport');
  return measured;
}
async function status() {
  await settle();
  return evaluate('structuredClone(window.__blobStatus)');
}
async function mouse(type, x, y, button = 'left', buttons = type === 'mouseReleased' ? 0 : 1) {
  await cdp.send(
    'Input.dispatchMouseEvent',
    { type, x, y, button, buttons, clickCount: type === 'mouseMoved' ? 0 : 1 },
    sessionId,
  );
}
async function key(type, key, code, keyCode) {
  await cdp.send(
    'Input.dispatchKeyEvent',
    { type, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode },
    sessionId,
  );
}
async function pad() {
  return evaluate(
    '(()=>{const r=document.querySelector("[data-pad-primary]").getBoundingClientRect();return{x:r.x+r.width*.45,y:r.y+r.height*.65}})()',
  );
}
async function check(name, test) {
  const began = Date.now();
  await test();
  const current = await status();
  report.nativeChecks.push({
    name,
    passed: true,
    elapsedMs: Date.now() - began,
    status: current,
    history: await evaluate('structuredClone(window.__blobHistory)'),
    inputs: await evaluate('structuredClone(window.__blobInputs)'),
  });
  console.log(JSON.stringify({ stage: 'native', name, passed: true }));
}
async function removeOwnedProfile(profilePath) {
  // A separate, bounded helper prevents a locked profile from hanging this runner.
  const script = `
    import {rmSync} from 'node:fs';
    import {resolve,dirname,basename} from 'node:path';
    import {tmpdir} from 'node:os';
    const target=resolve(process.argv[1]);
    if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('partybox-p05-capture-'))
      throw new Error('Unexpected owned profile');
    rmSync(target,{recursive:true,force:true,maxRetries:1,retryDelay:100});
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script, profilePath], {
    windowsHide: true,
    stdio: 'ignore',
  });
  return new Promise((done) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      done(result);
    };
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish({
        removed: false,
        retainedForAudit: true,
        reason: 'Owned profile cleanup exceeded5s',
      });
    }, 5000);
    child.once('error', (error) =>
      finish({ removed: false, retainedForAudit: true, reason: error.message }),
    );
    child.once('exit', (code) =>
      finish({ removed: code === 0, retainedForAudit: code !== 0, exitCode: code }),
    );
  });
}
try {
  await stat(chrome);
  await mkdir(media, { recursive: true });
  const pages = JSON.parse(await readFile(join(directory, 'screens.json'), 'utf8'));
  assert(pages.length === 63, 'Preserve all63 SSR scenarios');
  profile = await mkdtemp(join(tmpdir(), 'partybox-p05-capture-'));
  report.profile = profile;
  browser = spawn(
    chrome,
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
      '--user-data-dir=' + profile,
      '--window-size=1920,1080',
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  report.browserPid = browser.pid;
  cdp = await Cdp.open(await devToolsEndpoint(browser, profile));
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
  const selected = pilot
    ? pages.filter((page) =>
        [
          'play-tv.html',
          'play-phone-only.html',
          'play-paused-phone-only.html',
          'score-phone-only.html',
          'done-phone-only.html',
        ].includes(page.name),
      )
    : pages;
  assert(selected.length === (pilot ? 5 : 63), 'Required selected capture pages are missing');
  for (const page of selected) {
    await load('jobs/P05-blob-arena/media/' + page.name, page.width, page.height, true);
    await snapshot(page.name.replace(/\.html$/, ''), {
      html: page.name,
      scenario: page.scenario,
      surface: page.surface,
      provenance: page.provenance,
      authoredStress: page.authoredStress,
      reducedMotion: true,
    });
  }
  const playPath = 'jobs/P05-blob-arena/media/play-phone-only.html';
  for (const height of [659, 852]) {
    await load(playPath, 393, height);
    await snapshot('live-play-phone-only-' + height, {
      scenario: 'play',
      surface: 'phone-only',
      provenance: 'seeded reducer fixture in measured short/tall owner shell',
    });
  }
  await load(playPath + '?vip=1', 393, 659);
  await snapshot('live-play-phone-only-vip-659', {
    scenario: 'play',
    surface: 'phone-only',
    vipShell: true,
    provenance: 'seeded reducer fixture in measured87.6px VIP short-phone shell',
  });
  await load(
    'jobs/P05-blob-arena/media/play-paused-phone-only.html?vipname=WWWWWWWWWWWWWWWW',
    393,
    659,
  );
  await snapshot('live-paused-phone-only-long-vip-659', {
    scenario: 'play-paused',
    surface: 'phone-only',
    authoredStress: true,
    provenance:
      'real reducer pause fixture; authored legal16-character owner VIP name exercises natural shell-banner wrapping',
  });
  await load(playPath, 390, 844);
  await check(
    'native pointer steer advances actual physics; outside release sends neutral',
    async () => {
      const point = await pad();
      await mouse('mousePressed', point.x, point.y);
      await mouse('mouseMoved', point.x + 60, point.y);
      assert((await status()).controls.p1.x > 0.9, 'Native pointer did not reach reducer control');
      const beforeWorld = await evaluate(
        '({time:window.__blobState.world.time,x:window.__blobState.world.cells.find(c=>c.owner==="p1").x})',
      );
      await evaluate('window.__blobAdvance(200)');
      const afterWorld = await evaluate(
        '({time:window.__blobState.world.time,x:window.__blobState.world.cells.find(c=>c.owner==="p1").x})',
      );
      assert(
        afterWorld.time === beforeWorld.time + 200 && afterWorld.x > beforeWorld.x,
        'Timer did not reduce actual moving physics',
      );
      await mouse('mouseReleased', -4, point.y);
      const current = await status();
      assert(
        current.controls.p1.x === 0 && current.controls.p1.y === 0,
        'Captured outside release did not stop reducer steering',
      );
    },
  );
  await check('native keyboard and blur stop reducer steering', async () => {
    await key('keyDown', 'ArrowUp', 'ArrowUp', 38);
    assert((await status()).controls.p1.y === -1, 'ArrowUp did not enter reducer');
    await key('keyUp', 'ArrowUp', 'ArrowUp', 38);
    assert((await status()).controls.p1.y === 0, 'Keyboard release did not stop');
    await key('keyDown', 'd', 'KeyD', 68);
    assert((await status()).controls.p1.x === 1, 'D did not enter reducer');
    await evaluate('window.dispatchEvent(new Event("blur"))');
    assert((await status()).controls.p1.x === 0, 'Blur did not stop');
    await key('keyUp', 'd', 'KeyD', 68);
  });
  await check('native split mutates actual pieces from labelled eligible setup', async () => {
    await evaluate('window.__blobSetup("eligible-split")');
    assert((await status()).canSplit, 'Authored eligible split precondition failed');
    const count = await evaluate('window.__blobState.world.cells.filter(c=>c.owner==="p1").length');
    const point = await evaluate(
      '(()=>{const r=document.querySelector("button[aria-label=\"Split\"]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()',
    );
    await mouse('mousePressed', point.x, point.y);
    await mouse('mouseReleased', point.x, point.y);
    const afterCount = await evaluate(
      'window.__blobState.world.cells.filter(c=>c.owner==="p1").length',
    );
    assert(afterCount > count, 'Native split did not create reducer pieces');
    assert(!(await status()).canSplit, 'Real cooldown/cell state did not disable split');
    await snapshot('native-split-phone-only', {
      provenance: 'authored eligible setup followed by native split reduced by actual game',
    });
  });
  await check('VIP pause/resume and player disconnect cancel live controls', async () => {
    const point = await pad();
    await mouse('mousePressed', point.x, point.y);
    await mouse('mouseMoved', point.x + 60, point.y);
    await evaluate(
      'window.__blobDispatch({type:"vip",action:"pause",now:window.__blobStatus.now})',
    );
    const held = await status();
    assert(held.paused && held.controls.p1.x === 0, 'VIP pause did not freeze and neutralize');
    await evaluate('window.__blobAdvance(30000)');
    assert((await status()).checked === held.checked, 'Paused timer advanced physics');
    await evaluate(
      'window.__blobDispatch({type:"vip",action:"resume",now:window.__blobStatus.now})',
    );
    assert(!(await status()).paused, 'VIP resume not reduced');
    await mouse('mouseReleased', point.x + 60, point.y);
    await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
    await evaluate(
      'window.__blobDispatch({type:"player",playerId:"p1",connected:false,now:window.__blobStatus.now})',
    );
    assert((await status()).controls.p1.x === 0, 'Disconnect failed to cancel reducer controls');
    await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
    await evaluate(
      'window.__blobDispatch({type:"player",playerId:"p1",connected:true,now:window.__blobStatus.now})',
    );
  });
  await check(
    'native Space split follows held keyboard steering and releases cleanly',
    async () => {
      await evaluate('window.__blobSetup("eligible-split")');
      await settle();
      const count = await evaluate(
        'window.__blobState.world.cells.filter(c=>c.owner==="p1").length',
      );
      await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
      await key('keyDown', ' ', 'Space', 32);
      await key('keyUp', ' ', 'Space', 32);
      await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
      const after = await status();
      assert(
        (await evaluate('window.__blobState.world.cells.filter(c=>c.owner==="p1").length')) > count,
        'Native Space did not create actual reducer pieces',
      );
      assert(
        after.controls.p1.x === 0 && after.controls.p1.y === 0,
        'Keyboard split/release left reducer steering held',
      );
    },
  );
  await check('native reducer horn/score/final transitions reach actual results', async () => {
    await evaluate('window.__blobSetup("low-clock")');
    await evaluate('window.__blobAdvance(1000)');
    assert((await status()).phase === 'score', 'Actual horn did not enter score');
    assert(
      await evaluate('document.querySelector("[data-pad-primary]")===null'),
      'Score retained active pad',
    );
    await snapshot('native-horn-score-phone-only', {
      provenance: 'authored one-second horn then real timer and scoring reducer',
    });
    await evaluate('window.__blobSetFixture("score-last")');
    await settle();
    await evaluate(
      'window.__blobAdvance(window.__blobState.phase.deadline-window.__blobStatus.now)',
    );
    assert((await status()).phase === 'done', 'Actual final score deadline did not finish');
    await snapshot('native-done-phone-only', {
      provenance: 'actual third-round fixture deadline reduced to done',
    });
  });
  for (const reduced of [false, true]) {
    await load(playPath, 390, 844, reduced);
    await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
    const motion = await evaluate(`(async()=>{
      const frames=[];
      const read=()=>{
        const arena=document.querySelector('[data-arena]');
        const cell=arena.querySelector('[data-mine="true"]');
        const bodyNode=cell.querySelector('[data-cell-body]');
        const body=bodyNode.getBoundingClientRect();
        const label=cell.querySelector('[data-cell-label-id]').getBoundingClientRect();
        return {at:performance.now(),body:{x:body.x,y:body.y,width:body.width,height:body.height},bodyRadius:getComputedStyle(bodyNode).getPropertyValue('r'),bodyRadiusTarget:bodyNode.getAttribute('r'),label:{x:label.x,y:label.y,width:label.width,height:label.height},camera:getComputedStyle(arena.querySelector('[data-world-layer]')).transform,pose:getComputedStyle(cell).transform,cameraCenter:arena.dataset.cameraCenter,animations:arena.querySelector('[data-world-layer]').getAnimations().map(animation=>({playState:animation.playState,currentTime:animation.currentTime,duration:animation.effect.getTiming().duration}))};
      };
      frames.push(read());window.__blobAdvance(200);
      const until=performance.now()+2200;
      while(performance.now()<until){await new Promise(done=>requestAnimationFrame(done));frames.push(read())}
      return {frames,checked:window.__blobStatus.checked,inputs:window.__blobInputs,stateClock:window.__blobStatus.now};
    })()`);
    const uniquePoses = new Set(motion.frames.map((frame) => frame.pose)).size;
    const uniqueCameras = new Set(motion.frames.map((frame) => frame.camera)).size;
    const tail = motion.frames.slice(-5);
    const stableTail = tail.every(
      (frame) => frame.pose === tail[0].pose && frame.camera === tail[0].camera,
    );
    const reducedSettled = motion.frames
      .slice(3)
      .every(
        (frame) =>
          frame.pose === motion.frames.at(-1).pose && frame.camera === motion.frames.at(-1).camera,
      );
    report.motion.push({
      reducedMotion: reduced,
      uniquePoses,
      uniqueCameras,
      stableTail,
      reducedSettled,
      ...motion,
    });
    await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
    await snapshot('live-motion-' + (reduced ? 'reduced' : 'normal'), {
      reducedMotion: reduced,
      provenance: 'actual timer snapshot rendered over2200ms; RAF read-only samples',
    });
    assert(motion.frames.length > 1, 'Motion sampler collected no actual frames');
    assert(
      uniquePoses > 1 && uniqueCameras > 1,
      'Actual packet did not change body and camera transforms',
    );
    assert(stableTail, 'Bounded body/camera animation did not settle by2200ms');
    if (reduced)
      assert(reducedSettled, 'Reduced-motion body/camera continued animating after early frames');
    else
      assert(
        uniquePoses > 2 && uniqueCameras > 2,
        'Normal body/camera lacks intermediate animated poses',
      );
  }
  const after = { ...runtimeSources(), ...dependencySources() };
  report.sourcesAfter = after;
  report.sourcesStable = sameSources(before, after);
  report.sourceChanges = sourceChanges(before, after);
  assert(report.sourcesStable, 'Game/SDK sources drifted during capture');
  report.harnessAfter = hashes(harnessPaths);
  report.harnessStable = sameSources(harnessBefore, report.harnessAfter);
  report.harnessChanges = sourceChanges(harnessBefore, report.harnessAfter);
  assert(report.harnessStable, 'Capture tooling or HTML/CSS/input metadata drifted during capture');
  const names = await readdir(media);
  const sizes = await Promise.all(names.map((name) => stat(join(media, name))));
  report.mediaBytes = sizes
    .filter((size) => size.isFile())
    .reduce((sum, size) => sum + size.size, 0);
  assert(report.mediaBytes < 10000000, 'Media exceeds10MB');
  report.pilotChecksPassed = pilot;
  report.passed = !pilot;
  report.incomplete = pilot;
} catch (error) {
  failure = error;
  report.error = { name: error.name, message: error.message, stack: error.stack };
  report.passed = false;
  report.incomplete = true;
} finally {
  // Diagnostic failures still retain actual source/tool drift rather than default placeholders.
  try {
    report.sourcesAfter = { ...runtimeSources(), ...dependencySources() };
    report.sourcesStable = sameSources(before, report.sourcesAfter);
    report.sourceChanges = sourceChanges(before, report.sourcesAfter);
    report.harnessAfter = hashes(harnessPaths);
    report.harnessStable = sameSources(harnessBefore, report.harnessAfter);
    report.harnessChanges = sourceChanges(harnessBefore, report.harnessAfter);
  } catch (error) {
    report.provenanceError = error.message;
    report.passed = false;
    report.incomplete = true;
    failure ??= error;
  }
  if (cdp) {
    try {
      await cdp.send('Browser.close', {}, undefined, 2000);
    } catch {}
    try {
      cdp.socket.close();
    } catch {}
  }
  if (profile) {
    const absolute = ownedProfile(profile);
    try {
      report.cleanup = await closeProfileProcesses(absolute);
      report.browserClosed = report.cleanup.remainingPids.length === 0;
      // A locked profile is retained; there is no fallback cleanup against another path.
      report.profileRemoval = await removeOwnedProfile(absolute);
    } catch (error) {
      report.passed = false;
      report.incomplete = true;
      report.cleanupError = error.message;
      failure ??= error;
    }
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(
    join(directory, pilot ? 'capture-r1-pilot.json' : 'capture-r1.json'),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );
  console.log(
    JSON.stringify({
      captures: report.mountedCaptures.length,
      nativeChecks: report.nativeChecks.length,
      passed: report.passed,
      browserClosed: report.browserClosed,
      mediaBytes: report.mediaBytes ?? null,
    }),
  );
}
if (failure) throw failure;
