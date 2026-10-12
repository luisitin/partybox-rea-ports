// Diagnostic public-DOM experiment: production CSS and SVG-native transform paint.
// This changes only the mounted DOM, never game source, physics, or React internals.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cdp, devToolsEndpoint, ownedProfile, closeProfileProcesses } from './safe-cdp.mjs';
import {
  runtimeSources,
  dependencySources,
  hashes,
  sameSources,
  sourceChanges,
} from './provenance.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const base = process.env.PB_INTERACTIVE_BASE;
const token = process.env.PB_PREVIEW_TOKEN;
if (!base || !token) throw new Error('Use the owned transient wrapper');
const identity = await fetch(new URL('/__p05_preview', base), {
  headers: { 'x-p05-preview-token': token },
}).then((response) => response.json());
if (identity.token !== token) throw new Error('Preview ownership mismatch');
const excluded = (path) => /\/svgMotion(?:\.test)?\.ts$/.test(path);
const production = () =>
  Object.fromEntries(
    Object.entries({ ...runtimeSources(), ...dependencySources() }).filter(
      ([path]) => !excluded(path),
    ),
  );
const before = production();
const harnessFiles = [
  'transient-r1.mjs',
  'transient-owned.mjs',
  'safe-cdp.mjs',
  'preview.mjs',
  'interactive.tsx',
  'media/play-phone-only.html',
  'media/screens.css',
].map((name) => 'jobs/P05-blob-arena/' + name);
const harnessBefore = hashes(harnessFiles);
const report = {
  mode: 'diagnostic-public-DOM-only',
  sourceScope:
    'Existing production game/SDK bytes; only the explicitly unimported svgMotion adapter and its tests are excluded during parallel authoring',
  startedAt: new Date().toISOString(),
  sourcesBefore: before,
  harnessBefore,
  cases: [],
  passed: false,
  incomplete: true,
  browserClosed: false,
};
let browser, profile, cdp, sessionId, failure;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function evaluate(expression) {
  const result = await cdp.send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function settle() {
  await evaluate(
    '(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true})()',
  );
}
async function scene() {
  await cdp.send(
    'Page.navigate',
    { url: new URL('jobs/P05-blob-arena/media/play-phone-only.html', base).href },
    sessionId,
  );
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (await evaluate('Boolean(window.__blobReady && window.__blobStatus?.ready)')) {
      ready = true;
      break;
    }
    await sleep(100);
  }
  if (!ready) throw new Error('Mounted source did not become ready');
  await settle();
  await evaluate('window.__blobSetup("eligible-split")');
  await settle();
  const point = await evaluate(
    '(()=>{const r=document.querySelector("button[aria-label=Split]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()',
  );
  for (const type of ['mousePressed', 'mouseReleased'])
    await cdp.send(
      'Input.dispatchMouseEvent',
      { type, ...point, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 },
      sessionId,
    );
  await settle();
}
const install = (mode, at) => `(()=>{
  const svg=document.querySelector('[data-arena]');
  const world=svg.querySelector('[data-world-layer]');
  const matrix=m=>({a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f});
  const animations=svg.getAnimations({subtree:true});
  for(const animation of animations){animation.pause();animation.currentTime=${at};}
  const before=matrix(svg.getCTM().inverse().multiply(world.getCTM()));
  const converted=[];
  if(${JSON.stringify(mode)}!=='css'){
    svg.pauseAnimations();svg.setCurrentTime(0);
    for(const animation of animations){
      const target=animation.effect.target;
      const frames=animation.effect.getKeyframes();
      if(target!==world && !(${JSON.stringify(mode)}==='all-transforms' && target.tagName.toLowerCase()==='g'))continue;
      if(!frames.length || frames.some(f=>typeof f.transform!=='string'))continue;
      const matrices=frames.map(f=>new DOMMatrix(f.transform));
      if(matrices.some(m=>Math.abs(m.b)>1e-8||Math.abs(m.c)>1e-8))throw new Error('Unsupported public rotation');
      const timing=animation.effect.getTiming();
      animation.cancel();target.style.removeProperty('transform');target.removeAttribute('transform');
      const add=(type,values,additive)=>{
        const element=document.createElementNS('http://www.w3.org/2000/svg','animateTransform');
        for(const[k,v]of Object.entries({attributeName:'transform',type,values:values.join(';'),keyTimes:frames.map(f=>f.computedOffset ?? f.offset).join(';'),calcMode:'linear',dur:timing.duration+'ms',begin:'indefinite',fill:'freeze',additive}))element.setAttribute(k,v);
        target.append(element);element.beginElement();
      };
      add('translate',matrices.map(m=>m.e+' '+m.f),'replace');
      if(target===world)add('scale',matrices.map(m=>m.a+' '+m.d),'sum');
      converted.push({world:target===world,id:target.dataset.cellId??null,frames:frames.length,duration:timing.duration});
    }
    svg.setCurrentTime(${at}/1000);
  }
  const after=matrix(svg.getCTM().inverse().multiply(world.getCTM()));
  const list=world.transform.animVal;
  let worldAnim=new DOMMatrix();
  for(let i=0;i<list.numberOfItems;i++)worldAnim=worldAnim.multiply(list.getItem(i).matrix);
  return {mode:${JSON.stringify(mode)},seekMs:${at},before,after,converted,worldAnimVal:matrix(worldAnim),cssTransform:getComputedStyle(world).transform,cells:[...svg.querySelectorAll('[data-cell-id]')].map(g=>({id:g.dataset.cellId,pose:getComputedStyle(g).transform,bodyRadius:getComputedStyle(g.querySelector('[data-cell-body]')).r,label:g.querySelector('[data-name-inside]')?.textContent}))};
})()`;
try {
  profile = await mkdtemp(join(tmpdir(), 'partybox-p05-capture-transient-'));
  report.profile = profile;
  browser = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-background-networking',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--mute-audio',
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  report.browserPid = browser.pid;
  cdp = await Cdp.open(await devToolsEndpoint(browser, profile));
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp.send(
    'Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] },
    sessionId,
  );
  for (const mode of ['css', 'world-native', 'all-transforms']) {
    for (const at of [400, 2200]) {
      await scene();
      const measured = await evaluate(install(mode, at));
      await settle();
      measured.actual = await evaluate(
        '(()=>{const s=document.querySelector("[data-arena]"),w=s.querySelector("[data-world-layer]"),m=s.getCTM().inverse().multiply(w.getCTM());return{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f}})()',
      );
      const png = 'r1-transient-' + mode + '-' + at + '.png';
      const screenshot = await cdp.send(
        'Page.captureScreenshot',
        { format: 'png', fromSurface: true, captureBeyondViewport: false },
        sessionId,
      );
      await writeFile(join(directory, png), Buffer.from(screenshot.data, 'base64'));
      report.cases.push({ png, ...measured });
      console.log(
        JSON.stringify({ png, converted: measured.converted.length, camera: measured.actual }),
      );
    }
  }
} catch (error) {
  failure = error;
  report.error = { message: error.message, stack: error.stack };
} finally {
  report.sourcesAfter = production();
  report.productionSourcesStable = sameSources(before, report.sourcesAfter);
  report.sourceChanges = sourceChanges(before, report.sourcesAfter);
  report.unimportedAdapterPaths = Object.keys(runtimeSources()).filter(excluded);
  report.harnessAfter = hashes(harnessFiles);
  report.harnessStable = sameSources(harnessBefore, report.harnessAfter);
  if (cdp) {
    try {
      await cdp.send('Browser.close', {}, undefined, 2000);
    } catch {}
    try {
      cdp.socket.close();
    } catch {}
  }
  if (profile) {
    report.cleanup = await closeProfileProcesses(ownedProfile(profile));
    report.browserClosed = report.cleanup.remainingPids.length === 0;
    report.profileRetainedForAudit = true;
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(
    join(directory, 'r1-transient.json'),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );
}
if (failure) throw failure;
if (!report.productionSourcesStable || !report.harnessStable || !report.browserClosed)
  throw new Error('Diagnostic scope drift or browser closure failure');
