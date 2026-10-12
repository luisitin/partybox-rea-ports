// One headless Chrome process and one reused page for static SSR evidence.
import { spawn, execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const job = fileURLToPath(new URL('../', import.meta.url));
const media = join(job, 'media');
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

async function devToolsEndpoint(child, profile) {
  let output = '';
  let launchError;
  let lastRead = 'DevToolsActivePort has not appeared';
  const deadline = Date.now() + 60000;
  const observe = (chunk) => {
    output = `${output}${chunk}`.slice(-32000);
  };
  const failed = (error) => {
    launchError = error;
  };
  child.stderr.on('data', observe);
  child.on('error', failed);
  try {
    while (Date.now() < deadline) {
      // Windows Chrome may hand off to a new browser PID and exit its launcher with code 0.
      // The unique profile's port file is authoritative; launcher exit is not browser exit.
      try {
        const lines = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8'))
          .trim()
          .split(/\r?\n/);
        const port = Number(lines[0]);
        const path = lines[1];
        if (
          Number.isInteger(port) &&
          port > 0 &&
          port <= 65535 &&
          /^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(path ?? '')
        ) {
          return `ws://127.0.0.1:${port}${path}`;
        }
        lastRead = 'DevToolsActivePort is incomplete or invalid';
      } catch (error) {
        lastRead = error.code === 'ENOENT' ? 'DevToolsActivePort has not appeared' : error.message;
      }
      if (launchError) throw launchError;
      await delay(200);
    }
    throw new Error(
      `Chrome did not expose DevToolsActivePort within 60 seconds (launcher PID ${child.pid ?? 'unassigned'}, exit ${child.exitCode ?? 'running'}; ${lastRead}). Collected stderr:\n${output || '<no stderr received>'}`,
    );
  } finally {
    child.stderr.off('data', observe);
    child.off('error', failed);
  }
}

function ownedProfile(profile) {
  const absolute = resolve(profile);
  if (
    dirname(absolute) !== resolve(tmpdir()) ||
    !basename(absolute).startsWith('partybox-p09-capture-')
  ) {
    throw new Error(`Refusing cleanup outside the generated capture profile: ${absolute}`);
  }
  return absolute;
}

async function closeProfileProcesses(profile) {
  // Pass ownership through an environment variable, never a string-built shell command.
  // Enumerate/stop only chrome.exe processes with this exact user-data-dir argument.
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$taskCaptureProfile = $env:PB_P09_CAPTURE_PROFILE
if ([string]::IsNullOrWhiteSpace($taskCaptureProfile)) { throw 'Missing capture profile' }
$taskCapturePattern = '(?i)(?:^|\s|")--user-data-dir(?:=|\s+)"?' + [regex]::Escape($taskCaptureProfile) + '(?:"|\s|$)'
$taskCaptureExited = [System.Collections.Generic.HashSet[int]]::new()
function Get-TaskCaptureProcesses {
  $taskCaptureCandidates = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine -match $taskCapturePattern
  })
  foreach ($taskCaptureCandidate in $taskCaptureCandidates) {
    $taskCaptureCandidateHandle = Get-Process -Id ([int]$taskCaptureCandidate.ProcessId) -ErrorAction SilentlyContinue
    if ($null -eq $taskCaptureCandidateHandle) {
      [void]$taskCaptureExited.Add([int]$taskCaptureCandidate.ProcessId)
      continue
    }
    try {
      # CIM can retain records after Windows reports the actual process handle exited.
      if ($taskCaptureCandidateHandle.HasExited) {
        [void]$taskCaptureExited.Add([int]$taskCaptureCandidate.ProcessId)
      } else {
        $taskCaptureCandidate
      }
    } finally {
      $taskCaptureCandidateHandle.Dispose()
    }
  }
}
$taskCaptureInitial = @(Get-TaskCaptureProcesses)
$taskCaptureIds = @($taskCaptureInitial | ForEach-Object { [int]$_.ProcessId })
$taskCaptureRoots = @($taskCaptureInitial | Where-Object { [int]$_.ParentProcessId -notin $taskCaptureIds })
$taskCaptureStopped = [System.Collections.Generic.List[int]]::new()
foreach ($taskCaptureRoot in $taskCaptureRoots) {
  try {
    & taskkill.exe /PID ([string]$taskCaptureRoot.ProcessId) /T /F 2>$null | Out-Null
  } catch {
    # Force-stop/WaitForExit below still verifies every living matching PID.
  }
}
$taskCaptureDeadline = [DateTime]::UtcNow.AddSeconds(25)
do {
  $taskCaptureRemaining = @(Get-TaskCaptureProcesses)
  if ($taskCaptureRemaining.Count -eq 0) { break }
  foreach ($taskCaptureEntry in $taskCaptureRemaining) {
    $taskCaptureHandle = Get-Process -Id ([int]$taskCaptureEntry.ProcessId) -ErrorAction SilentlyContinue
    if ($null -eq $taskCaptureHandle) { continue }
    try {
      Stop-Process -InputObject $taskCaptureHandle -Force -ErrorAction Stop
      [void]$taskCaptureHandle.WaitForExit(500)
      $taskCaptureStopped.Add([int]$taskCaptureEntry.ProcessId)
    } catch {
      # A concurrent graceful exit is harmless; the final liveness query decides success.
    } finally {
      $taskCaptureHandle.Dispose()
    }
    if ([DateTime]::UtcNow -ge $taskCaptureDeadline) { break }
  }
  if ([DateTime]::UtcNow -ge $taskCaptureDeadline) { break }
  Start-Sleep -Milliseconds 200
} while ($true)
$taskCaptureRemaining = @(Get-TaskCaptureProcesses)
$taskCaptureReport = [pscustomobject]@{
  matchedPids = @($taskCaptureIds)
  rootPids = @($taskCaptureRoots | ForEach-Object { [int]$_.ProcessId })
  forceStoppedPids = @($taskCaptureStopped)
  remainingPids = @($taskCaptureRemaining | ForEach-Object { [int]$_.ProcessId })
  ignoredExitedPids = @($taskCaptureExited)
}
$taskCaptureReport | ConvertTo-Json -Compress -Depth 4
if ($taskCaptureRemaining.Count -ne 0) { throw 'Owned capture Chrome processes remain after bounded cleanup' }
`;
  const report = await new Promise((done, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      {
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 64 * 1024,
        encoding: 'utf8',
        env: { ...process.env, PB_P09_CAPTURE_PROFILE: ownedProfile(profile) },
      },
      (error, stdout, stderr) => {
        if (error)
          reject(
            new Error(
              `Owned-profile Chrome cleanup could not confirm zero processes: ${stdout.trim()} ${stderr.trim()}`,
            ),
          );
        else {
          try {
            done(JSON.parse(stdout.trim()));
          } catch (parseError) {
            reject(
              new Error(
                `Chrome cleanup returned an invalid PID-only report: ${parseError.message}`,
              ),
            );
          }
        }
      },
    );
  });
  if (report.remainingPids.length !== 0) throw new Error('Owned Chrome cleanup report is nonzero');
  console.log(JSON.stringify({ cleanup: report }));
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.requests = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      const request = this.requests.get(message.id);
      if (!request) return;
      this.requests.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const request of this.requests.values()) {
        clearTimeout(request.timeout);
        request.reject(new Error('CDP connection closed'));
      }
      this.requests.clear();
    });
  }

  static async open(endpoint) {
    const socket = new WebSocket(endpoint);
    await new Promise((done, reject) => {
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('CDP WebSocket open timed out after 60 seconds'));
      }, 60000);
      socket.addEventListener(
        'open',
        () => {
          clearTimeout(timeout);
          done();
        },
        { once: true },
      );
      socket.addEventListener(
        'error',
        () => {
          clearTimeout(timeout);
          reject(new Error('CDP WebSocket open failed'));
        },
        { once: true },
      );
    });
    return new Cdp(socket);
  }

  send(method, params = {}, sessionId, timeoutMs = 60000) {
    const id = this.nextId++;
    return new Promise((done, reject) => {
      const timeout = setTimeout(() => {
        this.requests.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.requests.set(id, { resolve: done, reject, timeout });
      try {
        this.socket.send(
          JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
        );
      } catch (error) {
        clearTimeout(timeout);
        this.requests.delete(id);
        reject(error);
      }
    });
  }
}

// Read public rendered DOM only; no application state or browser internals are inspected.
function measure() {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const describe = (node) => ({
    tag: node.tagName.toLowerCase(),
    role: node.getAttribute('role'),
    class: typeof node.className === 'string' ? node.className : '',
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
  });
  const box = (rect) => ({
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
    right: Math.round(rect.right * 100) / 100,
    bottom: Math.round(rect.bottom * 100) / 100,
  });
  const visible = (node, style, rect) =>
    !['STYLE', 'SCRIPT', 'META', 'LINK'].includes(node.tagName) &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    rect.width > 0 &&
    rect.height > 0;
  const outside = [];
  const overflow = [];
  const clipping = [];
  const textOverflow = [];
  const textFonts = [];

  for (const node of document.body.querySelectorAll('*')) {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    if (!visible(node, style, rect)) continue;
    if (
      rect.left < -1 ||
      rect.top < -1 ||
      rect.right > viewport.width + 1 ||
      rect.bottom > viewport.height + 1
    ) {
      outside.push({ ...describe(node), rect: box(rect) });
    }
    if (
      (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1) ||
      (node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1)
    ) {
      overflow.push({
        ...describe(node),
        rect: box(rect),
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        intentionalEllipsis: style.textOverflow === 'ellipsis',
      });
    }
    let ancestor = node.parentElement;
    while (ancestor && ancestor !== document.body) {
      const ancestorStyle = getComputedStyle(ancestor);
      const ancestorRect = ancestor.getBoundingClientRect();
      const clipsX = ['hidden', 'clip', 'auto', 'scroll'].includes(ancestorStyle.overflowX);
      const clipsY = ['hidden', 'clip', 'auto', 'scroll'].includes(ancestorStyle.overflowY);
      if (
        (clipsX && (rect.left < ancestorRect.left - 1 || rect.right > ancestorRect.right + 1)) ||
        (clipsY && (rect.top < ancestorRect.top - 1 || rect.bottom > ancestorRect.bottom + 1))
      ) {
        clipping.push({
          ...describe(node),
          rect: box(rect),
          ancestor: describe(ancestor),
          ancestorRect: box(ancestorRect),
        });
        break;
      }
      ancestor = ancestor.parentElement;
    }
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    const node = text.parentElement;
    if (!node || !(text.textContent ?? '').trim()) continue;
    const style = getComputedStyle(node);
    const parentRect = node.getBoundingClientRect();
    if (!visible(node, style, parentRect)) continue;
    const range = document.createRange();
    range.selectNodeContents(text);
    const rect = range.getBoundingClientRect();
    const font = {
      ...describe(node),
      text: text.textContent.trim().slice(0, 120),
      fontPx: parseFloat(style.fontSize),
      gameText: document.getElementById('game-frame').contains(node),
      rect: box(rect),
    };
    textFonts.push(font);
    if (
      rect.left < parentRect.left - 1 ||
      rect.right > parentRect.right + 1 ||
      rect.top < parentRect.top - 2 ||
      rect.bottom > parentRect.bottom + 2
    ) {
      textOverflow.push({
        ...font,
        parentRect: box(parentRect),
        intentionalEllipsis: style.textOverflow === 'ellipsis',
      });
    }
  }

  const gameFrame = document.getElementById('game-frame');
  const boardOverlaps = [...gameFrame.querySelectorAll('article')].flatMap((article) => {
    const board = article.querySelector('[role="grid"]');
    const caption = article.querySelector('p');
    if (!board || !caption) return [];
    const boardRect = board.getBoundingClientRect();
    const captionRect = caption.getBoundingClientRect();
    return boardRect.bottom > captionRect.top + 1
      ? [{ board: box(boardRect), caption: box(captionRect), text: caption.textContent }]
      : [];
  });
  const gameHeader = gameFrame.querySelector('header');
  const firstCard = gameFrame.querySelector('article');
  const headerOverlap =
    document.documentElement.dataset.surface === 'tv' && gameHeader && firstCard
      ? Math.max(
          0,
          gameHeader.getBoundingClientRect().bottom - firstCard.getBoundingClientRect().top,
        )
      : 0;
  const directionTargets = [...document.querySelectorAll('button[aria-label^="Move "]')].map(
    (node) => {
      const rect = node.getBoundingClientRect();
      return {
        label: node.getAttribute('aria-label'),
        disabled: node.disabled,
        rect: box(rect),
        passes44px: rect.width >= 44 && rect.height >= 44,
      };
    },
  );
  return {
    title: document.title,
    headerOverlap,
    surface: document.documentElement.dataset.surface,
    viewport,
    document: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
    },
    frame: box(document.getElementById('game-frame').getBoundingClientRect()),
    outside,
    overflow,
    clipping,
    textOverflow,
    textFonts,
    directionTargets,
    boardOverlaps,
    tvTextBelow32px:
      document.documentElement.dataset.surface === 'tv'
        ? textFonts.filter((text) => text.gameText && text.fontPx < 32)
        : [],
  };
}

let browser;
let cdp;
let profile;
let captureError;
try {
  await stat(chromePath);
  await mkdir(media, { recursive: true });
  const htmlFiles = (await readdir(media)).filter((name) => name.endsWith('.html')).sort();
  if (!htmlFiles.length) throw new Error('Render the SSR HTML captures before running capture.mjs');
  profile = await mkdtemp(join(tmpdir(), 'partybox-p09-capture-'));
  browser = spawn(
    chromePath,
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
      `--user-data-dir=${profile}`,
      '--window-size=1920,1080',
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  cdp = await Cdp.open(await devToolsEndpoint(browser, profile));
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] }, sessionId);
  await cdp.send(
    'Emulation.setEmulatedMedia',
    {
      features: [
        { name: 'prefers-color-scheme', value: 'dark' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    },
    sessionId,
  );

  const layouts = [];
  for (const filename of htmlFiles) {
    const source = await readFile(join(media, filename), 'utf8');
    const phone = /data-surface="phone"/.test(source);
    const width = phone ? 390 : 1920;
    const height = phone ? 844 : 1080;
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: phone,
        screenWidth: width,
        screenHeight: height,
      },
      sessionId,
    );
    const frame = await cdp.send('Page.getFrameTree', {}, sessionId);
    const contents = await readFile(join(media, filename), 'utf8');
    const base = pathToFileURL(`${media}/`).href;
    await cdp.send(
      'Page.setDocumentContent',
      {
        frameId: frame.frameTree.frame.id,
        html: contents.replace('<head>', `<head><base href="${base}">`),
      },
      sessionId,
    );
    const settled = await cdp.send(
      'Runtime.evaluate',
      {
        expression:
          '(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); return true; })()',
        awaitPromise: true,
        returnByValue: true,
      },
      sessionId,
    );
    if (settled.exceptionDetails)
      throw new Error(`${filename}: ${JSON.stringify(settled.exceptionDetails)}`);
    const measured = await cdp.send(
      'Runtime.evaluate',
      {
        expression: `(${measure.toString()})()`,
        returnByValue: true,
      },
      sessionId,
    );
    if (measured.exceptionDetails)
      throw new Error(`${filename}: ${JSON.stringify(measured.exceptionDetails)}`);
    const screenshot = await cdp.send(
      'Page.captureScreenshot',
      {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      },
      sessionId,
    );
    const png = filename.replace(/\.html$/, '.png');
    await writeFile(join(media, png), Buffer.from(screenshot.data, 'base64'));
    const layout = { html: filename, png, ...measured.result.value };
    layouts.push(layout);
    console.log(
      JSON.stringify({
        file: filename,
        outside: layout.outside.length,
        overflow: layout.overflow.length,
        textOverflow: layout.textOverflow.length,
        clipped: layout.clipping.length,
        smallTvText: layout.tvTextBelow32px.length,
      }),
    );
  }
  await writeFile(
    join(media, 'layout.json'),
    `${JSON.stringify({ chromePath, captures: layouts }, null, 2)}\n`,
    'utf8',
  );
  const mediaFiles = await readdir(media);
  const sizes = await Promise.all(mediaFiles.map((name) => stat(join(media, name))));
  const bytes = sizes
    .filter((entry) => entry.isFile())
    .reduce((total, entry) => total + entry.size, 0);
  const failed = layouts.filter(
    (a) =>
      a.outside.length ||
      a.clipping.length ||
      a.boardOverlaps.length ||
      a.tvTextBelow32px.length ||
      a.headerOverlap > 1 ||
      a.directionTargets.some((t) => !t.passes44px),
  );
  if (failed.length)
    throw new Error(`Current host fit failed: ${failed.map((a) => a.html).join(', ')}`);
  if (bytes >= 10_000_000) throw new Error(`Media exceeds the 10 MB budget: ${bytes} bytes`);
  console.log(
    JSON.stringify({ captures: layouts.length, mediaBytes: bytes, report: 'media/layout.json' }),
  );
} catch (error) {
  captureError = error;
  throw error;
} finally {
  // Cleanup covers failures during launch, connection, navigation, layout inspection, or capture.
  if (cdp) {
    try {
      await cdp.send('Browser.close', {}, undefined, 2000);
    } catch {
      /* close can end CDP before replying */
    }
    try {
      cdp.socket.close();
    } catch {
      /* process cleanup must run even if the socket is already gone */
    }
  }
  if (profile) {
    const absolute = ownedProfile(profile);
    try {
      // Always run, even if the launcher exited, CDP never appeared, or Browser.close succeeded.
      await closeProfileProcesses(absolute);
    } catch (cleanupError) {
      // Keep the exact ownership/profile evidence available for a manual PID audit.
      throw new AggregateError(
        captureError ? [captureError, cleanupError] : [cleanupError],
        `Capture Chrome cleanup failed; profile retained for audit: ${absolute}`,
      );
    }
    await rm(absolute, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(
      () => undefined,
    );
  }
}
