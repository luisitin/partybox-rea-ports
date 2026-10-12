// One temporary real reducer/controller room. Public DOM/CSS animation evidence only.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Cdp, devToolsEndpoint, ownedProfile, closeProfileProcesses } from './capture.mjs';
const directory = fileURLToPath(new URL('../../../games/2048/fidelity/', import.meta.url));
const temporary = join(tmpdir(), 'r1-local-p09-interactive.html');
const profile = await mkdtemp(join(tmpdir(), 'partybox-p09-capture-motion-'));
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
let cdp;
let pausedFrame = null;
let onPaused = null;
let sessionId;
try {
  const browser = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-extensions',
      '--no-first-run',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  cdp = await Cdp.open(await devToolsEndpoint(browser, profile));
  const exceptions = [];
  cdp.socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Runtime.exceptionThrown')
      exceptions.push({
        text: message.params.exceptionDetails.text,
        description: message.params.exceptionDetails.exception?.description,
      });
    if (message.method === 'Debugger.paused') {
      pausedFrame = message.params.callFrames[0]?.callFrameId;
      onPaused?.(message.params);
    }
  });
  let { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
  for (const domain of ['Page', 'Runtime', 'Network', 'Animation', 'Debugger'])
    await cdp.send(`${domain}.enable`, {}, sessionId);
  await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] }, sessionId);
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  const evaluate = async (expression) => {
    const result = await cdp.send(
      pausedFrame ? 'Debugger.evaluateOnCallFrame' : 'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        ...(pausedFrame ? { callFrameId: pausedFrame } : { awaitPromise: true }),
      },
      sessionId,
    );
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const read = () =>
    evaluate(`(() => ({
    board:Array.from(document.querySelectorAll('[role="gridcell"]'),cell=>Number(cell.dataset.value)),
    score:Number(document.querySelector('dd')?.firstChild?.textContent || 0),
    receipt:Number(document.querySelector('dd [role="status"]')?.textContent || 0),
    moving:document.querySelector('[role="grid"]')?.dataset.moving === 'true',
    buttons:document.querySelectorAll('button').length,
    text:document.querySelector('#game-frame').innerText,
    animations:document.getAnimations().map(animation=>({name:animation.animationName??animation.transitionProperty,target:animation.effect.target.dataset.motion??animation.effect.target.className,timing:animation.effect.getTiming(),keyframes:animation.effect.getKeyframes()}))
  }))()`);
  const photograph = async (name) => {
    const { data } = await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false },
      sessionId,
    );
    await writeFile(join(directory, name), Buffer.from(data, 'base64'));
  };
  const reports = [];
  for (const target of [false, true]) {
    if (target) {
      await cdp.send('Target.closeTarget', { targetId });
      ({ targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }));
      ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
      for (const domain of ['Page', 'Runtime', 'Network', 'Animation', 'Debugger'])
        await cdp.send(`${domain}.enable`, {}, sessionId);
      await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] }, sessionId);
      await cdp.send(
        'Emulation.setDeviceMetricsOverride',
        { width: 390, height: 844, deviceScaleFactor: 1, mobile: false },
        sessionId,
      );
    }
    const navigation = await cdp.send(
      'Page.navigate',
      { url: `${pathToFileURL(temporary).href}${target ? '?target' : ''}` },
      sessionId,
    );
    if (navigation.errorText) throw new Error(`Own room navigation: ${navigation.errorText}`);
    for (let i = 0; i < 150; i++) {
      if (await evaluate('document.querySelectorAll("[role=gridcell]").length===16')) break;
      if (i === 149)
        throw new Error(
          `Own interactive room did not render: ${JSON.stringify({ exceptions, dom: await evaluate('({url:location.href,title:document.title,text:document.body?.innerText.slice(0,200)})') })}`,
        );
      await delay(100);
    }
    await evaluate('document.fonts.ready');
    await delay(50);
    const before = await read();
    const paused = new Promise((done) => {
      onPaused = done;
    });
    let executionError;
    const execution = cdp
      .send(
        'Runtime.evaluate',
        {
          expression: `new Promise(resolve=>{document.querySelector('button[aria-label="Move ${target ? 'left' : 'up'}"]').click(); setTimeout(()=>{document.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=50}); debugger; resolve();},0);})`,
          awaitPromise: true,
          returnByValue: true,
        },
        sessionId,
      )
      .catch((error) => {
        executionError = error;
      });
    await Promise.race([
      paused,
      delay(10000).then(() => {
        throw new Error('Debugger did not pause own capture room');
      }),
    ]);
    const accepted = await read();
    if (!accepted.moving || accepted.score <= before.score)
      throw new Error(`No actual merge motion: ${JSON.stringify({ target, before, accepted })}`);
    const prefix = target ? 'ours-target' : 'ours-merge';
    for (const time of target ? [50, 200, 2500] : [50, 200]) {
      await evaluate(
        `document.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=${time}})`,
      );
      await photograph(`${prefix}-${time}ms.png`);
    }
    const travel = accepted.animations.filter((a) => a.target === 'travel');
    const merges = accepted.animations.filter((a) => a.target === 'merge');
    const spawns = accepted.animations.filter((a) => a.target === 'spawn');
    const gains = accepted.animations.filter((a) => String(a.target).includes('gain'));
    const near = (actual, expected) => Math.abs(actual - expected) < 0.000001;
    if (
      !travel.length ||
      !merges.length ||
      !spawns.length ||
      travel.some((a) => !near(a.timing.duration, 100)) ||
      [...merges, ...spawns].some(
        (a) => !near(a.timing.duration, 200) || !near(a.timing.delay, 100),
      ) ||
      accepted.receipt !== accepted.score - before.score ||
      !gains.some((a) => near(a.timing.duration, 600))
    )
      throw new Error(
        `Original motion timings differ: ${JSON.stringify({ receipt: accepted.receipt, gain: accepted.score - before.score, gains: gains.map((a) => a.timing), travel: travel.map((a) => a.timing), merges: merges.map((a) => a.timing), spawns: spawns.map((a) => a.timing) })}`,
      );
    if (target && (accepted.buttons !== 0 || !accepted.text.includes('You win!')))
      throw new Error('Target payoff erased personal board or retained controls');
    await cdp.send('Debugger.resume', {}, sessionId);
    pausedFrame = null;
    onPaused = null;
    await execution;
    if (executionError) throw executionError;
    await delay(target ? 3200 : 400);
    const settled = await read();
    if (target && (!settled.text.includes('Final standings') || settled.board.length))
      throw new Error('Target payoff did not hand off to complete standings');
    reports.push({ scenario: prefix, before, accepted, settled });
  }
  await writeFile(
    join(directory, 'motion.json'),
    `${JSON.stringify({ method: 'Actual own-game reducer/controller button input; JavaScript debugger holds layer cleanup while public CSS clocks seek50/200ms (target overlay2500ms). Compositor runs normally. Original timings checked against pinned CSS; these transient PNGs are ours-only.', scenarios: reports }, null, 2)}\n`,
    'utf8',
  );
  console.log(
    JSON.stringify({
      motionScenarios: reports.length,
      frames: 5,
      originalTimingChecks: true,
      targetPayoff: true,
    }),
  );
} finally {
  if (cdp) {
    if (pausedFrame) await cdp.send('Debugger.resume', {}, sessionId, 2000).catch(() => undefined);
    await cdp.send('Browser.close', {}, undefined, 2000).catch(() => undefined);
    cdp.socket.close();
  }
  const absolute = ownedProfile(profile);
  await closeProfileProcesses(absolute);
  await rm(absolute, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }).catch(
    (error) => {
      if (!['EBUSY', 'EPERM'].includes(error.code)) throw error;
    },
  );
  await rm(temporary, { force: true });
  await rm(join(tmpdir(), 'r1-local-p09-interactive.js'), { force: true });
}
