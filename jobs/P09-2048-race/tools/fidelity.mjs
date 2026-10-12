// One owned browser, public original DOM, and matched static port evidence.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Cdp, closeProfileProcesses, devToolsEndpoint, ownedProfile } from './capture.mjs';

const directory = fileURLToPath(new URL('../../../games/2048/fidelity/', import.meta.url));
const media = fileURLToPath(new URL('../media/', import.meta.url));
const original = 'https://gabrielecirulli.github.io/2048/';
const originalSource = process.env.PB_2048_REFERENCE_PATH;
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
await mkdir(directory, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'partybox-p09-capture-fidelity-'));
let cdp;
try {
  const browser = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  cdp = await Cdp.open(await devToolsEndpoint(browser, profile));
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  const evaluate = async (expression) => {
    const response = await cdp.send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const screenshot = async (name) => {
    const { data } = await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false },
      sessionId,
    );
    await writeFile(join(directory, name), Buffer.from(data, 'base64'));
  };
  if (process.argv.includes('--original')) {
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send(
      'Network.setBlockedURLs',
      { urls: ['*google-analytics*', '*googletagmanager*', '*doubleclick*'] },
      sessionId,
    );
    const referenceUrl = originalSource
      ? pathToFileURL(join(originalSource, 'index.html')).href
      : original;
    const navigation = await cdp.send('Page.navigate', { url: referenceUrl }, sessionId);
    console.log(JSON.stringify({ navigation }));
    if (navigation.errorText)
      throw new Error(`Original navigation failed: ${navigation.errorText}`);
    for (let i = 0; i < 240; i++) {
      if (await evaluate("document.querySelectorAll('.tile-container .tile').length >= 2")) break;
      if (i === 239)
        throw new Error(
          `Original did not render its public board: ${await evaluate('JSON.stringify({url:location.href,title:document.title,text:document.body.innerText.slice(0,900)})')}`,
        );
      await delay(250);
    }
    await evaluate('document.fonts.ready');
    await delay(500);
    const read = () =>
      evaluate(`(() => {
      const board = Array(16).fill(0);
      for (const tile of document.querySelectorAll('.tile-container .tile')) {
        const position = tile.className.match(/tile-position-(\\d)-(\\d)/);
        if (position) board[(Number(position[2])-1)*4+Number(position[1])-1] = Number(tile.querySelector('.tile-inner').textContent);
      }
      const score = Number(document.querySelector('.score-container').firstChild.textContent);
      const best = Number(document.querySelector('.best-container').firstChild.textContent);
      const rect = document.querySelector('.game-container').getBoundingClientRect();
      return { board, score, best, boardRect: {x:rect.x,y:rect.y,width:rect.width,height:rect.height} };
    })()`);
    const states = [{ moment: 'start', ...(await read()), moves: 0 }];
    if (states[0].board.filter(Boolean).length !== 2)
      throw new Error('Fresh original profile was not a new game');
    await screenshot('original-start.png');
    const keys = [
      'ArrowLeft',
      'ArrowUp',
      'ArrowRight',
      'ArrowDown',
      'ArrowLeft',
      'ArrowUp',
      'ArrowRight',
      'ArrowDown',
      'ArrowLeft',
      'ArrowUp',
      'ArrowRight',
      'ArrowDown',
    ];
    let previous = states[0].board;
    let moves = 0;
    for (const key of keys) {
      const code = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[key];
      await cdp.send(
        'Input.dispatchKeyEvent',
        { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code },
        sessionId,
      );
      await cdp.send(
        'Input.dispatchKeyEvent',
        { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code },
        sessionId,
      );
      await delay(700);
      const next = await read();
      if (JSON.stringify(next.board) !== JSON.stringify(previous)) moves++;
      previous = next.board;
    }
    states.push({ moment: 'midgame', ...(await read()), moves });
    await screenshot('original-midgame.png');
    await writeFile(
      join(directory, 'original-states.json'),
      `${JSON.stringify({ url: original, reference: originalSource ? 'https://github.com/gabrielecirulli/2048/tree/478b6ec346e3787f589e4af751378d06ded4cbbc' : original, captureMethod: originalSource ? 'Pinned original release in a temporary reference checkout; ordinary keyboard play in a fresh profile.' : 'Hosted original; ordinary keyboard play in a fresh profile.', capturedAt: new Date().toISOString(), viewport: { width: 390, height: 844 }, keys, settleMs: 700, states }, null, 2)}\n`,
      'utf8',
    );
    console.log(JSON.stringify({ original: states }));
  } else {
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] }, sessionId);
    for (const moment of ['start', 'midgame']) {
      await cdp.send(
        'Page.navigate',
        { url: pathToFileURL(join(media, `${moment}-fidelity.html`)).href },
        sessionId,
      );
      await delay(100);
      await evaluate('document.fonts.ready');
      await delay(200);
      const board = await evaluate(
        "(() => {const r=document.querySelector('[role=grid]').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()",
      );
      await screenshot(`ours-${moment}.png`);
      console.log(JSON.stringify({ moment, board }));
    }
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 1560, height: 920, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    const columns = await Promise.all(
      ['start', 'midgame'].map(async (moment) => {
        const urls = await Promise.all(
          ['original', 'ours'].map(
            async (side) =>
              `data:image/png;base64,${(await readFile(join(directory, `${side}-${moment}.png`))).toString('base64')}`,
          ),
        );
        return `<section><h2>${moment}: original</h2><img src="${urls[0]}"></section><section><h2>${moment}: PartyBox</h2><img src="${urls[1]}"></section>`;
      }),
    );
    const { frameTree } = await cdp.send('Page.getFrameTree', {}, sessionId);
    await cdp.send(
      'Page.setDocumentContent',
      {
        frameId: frameTree.frame.id,
        html: `<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#171923;color:#fff;display:grid;grid-template-columns:repeat(4,390px);font:18px system-ui}section{margin:0}h2{height:60px;margin:0;padding:16px;font-size:20px}img{display:block;width:390px;height:844px}</style></head><body>${columns.join('')}</body></html>`,
      },
      sessionId,
    );
    await evaluate('Promise.all(Array.from(document.images, image=>image.decode()))');
    await screenshot('side-by-side.png');
  }
} finally {
  if (cdp) {
    await cdp.send('Browser.close', {}, undefined, 2000).catch(() => undefined);
    cdp.socket.close();
  }
  const absolute = ownedProfile(profile);
  await closeProfileProcesses(absolute);
  await rm(absolute, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }).catch(
    (error) => {
      // Zero owned browser PIDs above is the lifetime gate; antivirus may retain a
      // temporary file handle after Chrome exits. Preserve the path for later cleanup.
      if (error.code !== 'EBUSY' && error.code !== 'EPERM') throw error;
      console.log(
        JSON.stringify({
          retainedTemporaryProfile: absolute,
          reason: error.code,
          ownedBrowserPids: 0,
        }),
      );
    },
  );
}
