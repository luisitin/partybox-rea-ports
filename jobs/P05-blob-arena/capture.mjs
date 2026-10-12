// One fresh owned cached browser, closed in finally. Never navigate to the original game.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  statSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url)),
  root = resolve(directory, '../..');
const archive = (name) => {
  const from = join(directory, name),
    to = join(directory, `r5-history-${name}`);
  if (existsSync(from) && !existsSync(to)) copyFileSync(from, to);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
let preview, executable, profileBase, profile;
const ownerMarker = randomUUID();
async function initializeCapture() {
  for (const name of ['fit.json', 'interactive-baseline.json', 'interactive-fixed.json'])
    archive(name);
  if (process.env.PB_INTERACTIVE_BASE) {
    const base = new URL(process.env.PB_INTERACTIVE_BASE);
    assert(
      base.protocol === 'http:' && base.hostname === '127.0.0.1' && base.pathname === '/',
      'Preview must be a fresh loopback base URL.',
    );
    assert(
      process.env.PB_PREVIEW_TOKEN,
      'PB_PREVIEW_TOKEN from the newly started helper is required.',
    );
    const response = await fetch(new URL('/__p05_preview', base), {
      headers: { 'x-p05-preview-token': process.env.PB_PREVIEW_TOKEN },
      signal: AbortSignal.timeout(5000),
    });
    assert(
      response.ok,
      'Fresh P05 preview identity endpoint rejected this capture; never use the stale r5 helper.',
    );
    const identity = await response.json();
    assert(
      identity.job === 'P05' &&
        resolve(identity.root) === root &&
        identity.token === process.env.PB_PREVIEW_TOKEN &&
        Number.isSafeInteger(identity.pid) &&
        identity.pid > 0,
      'Preview owner/root/token does not match this workspace.',
    );
    assert(
      identity.phoneShell?.top === 80 && identity.phoneShell?.bottom === 80,
      'Preview must reserve 80 px at both ends.',
    );
    preview = { ...identity, base: base.href };
  }
  executable = resolve(
    process.env.PB_CHROME ??
      join(
        process.env.LOCALAPPDATA ?? '',
        'ms-playwright',
        'chromium-1243',
        'chrome-win64',
        'chrome.exe',
      ),
  );
  assert(
    existsSync(executable),
    'Set PB_CHROME to an existing cached Chromium executable; do not install a browser.',
  );
  // This dedicated parent is explicit and separate from the retained historical .git profile.
  const temporaryRoot = realpathSync(tmpdir());
  const requestedParent = resolve(temporaryRoot, 'partybox-rea-r4-local-P05');
  assert(
    relative(temporaryRoot, requestedParent) === 'partybox-rea-r4-local-P05',
    'Unexpected temporary profile parent.',
  );
  mkdirSync(requestedParent, { recursive: true });
  profileBase = realpathSync(requestedParent);
  assert(profileBase === requestedParent, 'Owned temporary parent must not be a redirected path.');
  profile = resolve(profileBase, `P05-capture-${process.pid}-${ownerMarker}`);
  run.profile = profile;
  run.profileParent = profileBase;
  assert(
    insideProfileBase(),
    'Owned profile must remain inside the dedicated r4-local P05 temporary parent.',
  );
  mkdirSync(profile);
}
const insideProfileBase = () => {
  if (!profileBase || !profile) return false;
  const path = relative(profileBase, resolve(profile));
  return !isAbsolute(path) && path === `P05-capture-${process.pid}-${ownerMarker}`;
};
let browser,
  socket,
  serial = 0,
  failure;
const pending = new Map(),
  run = {
    job: 'P05',
    root,
    profile: null,
    profileParent: null,
    ownerMarker,
    startedAt: new Date().toISOString(),
    stage: 'initialization',
    browserPid: null,
    actualBrowserPids: [],
    previewPid: null,
    browserClosed: false,
    profileRemoved: false,
    previewClosed: false,
    cleanupErrors: [],
    processChecks: [],
    inputRequests: [],
  };
const redact = (value) => {
  const text = String(value);
  return process.env.PB_PREVIEW_TOKEN
    ? text.replaceAll(process.env.PB_PREVIEW_TOKEN, '[redacted]')
    : text;
};
const errorDetails = (error) => ({
  name: error?.name ?? 'Error',
  message: redact(error?.message ?? error),
  stack: error?.stack ? redact(error.stack) : null,
});
const saveJson = (name, value) => {
  try {
    writeFileSync(join(directory, name), JSON.stringify(value, null, 2) + '\n');
  } catch (error) {
    run.cleanupErrors.push({ stage: `write ${name}`, ...errorDetails(error) });
    failure ??= error;
  }
};
const finishInputRequest = (request, status, error = null) => {
  if (!request) return;
  request.status = status;
  request.finishedAt = new Date().toISOString();
  if (error) request.error = errorDetails(error);
  if (run.pendingInput?.id === request.id) run.pendingInput = null;
  if (status !== 'passed') run.failedInputRequest ??= structuredClone(request);
  saveJson('capture-input.json', {
    job: 'P05',
    pending: run.pendingInput ?? null,
    requests: run.inputRequests,
  });
};
const ask = (method, params = {}, timeoutMs = 20000) =>
  new Promise((resolve, reject) => {
    run.lastCdpMethod = method;
    if (socket?.readyState !== WebSocket.OPEN) {
      reject(new Error(`CDP socket closed: ${method}`));
      return;
    }
    const id = ++serial,
      input = method.startsWith('Input.')
        ? {
            id,
            method,
            params: JSON.parse(redact(JSON.stringify(params))),
            stage: run.stage,
            startedAt: new Date().toISOString(),
            status: 'pending',
          }
        : null,
      timeout = setTimeout(() => {
        pending.delete(id);
        const error = new Error(
          `CDP timed out: ${method}${input ? ` ${JSON.stringify(input.params)}` : ''}`,
        );
        finishInputRequest(input, 'timed out', error);
        reject(error);
      }, timeoutMs);
    if (input) {
      run.inputRequests.push(input);
      run.pendingInput = input;
      // Persist before sending, so a hung native input retains its exact parameters.
      saveJson('capture-input.json', { job: 'P05', pending: input, requests: run.inputRequests });
    }
    pending.set(id, { resolve, reject, timeout, input });
    try {
      socket.send(JSON.stringify({ id, method, params }));
    } catch (error) {
      clearTimeout(timeout);
      pending.delete(id);
      finishInputRequest(input, 'send failed', error);
      reject(error);
    }
  });
const evaluate = async (expression) => {
  const result = await ask('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const navigate = async (url, ready = 'document.readyState === "complete"') => {
  await ask('Page.navigate', { url });
  await sleep(100);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(`location.href === ${JSON.stringify(url)} && (${ready})`)) {
      await evaluate('document.fonts.ready.then(()=>true)');
      return;
    }
    await sleep(50);
  }
  throw new Error(`Page did not become ready: ${url}`);
};

const ownerData = () => ({
  root,
  profile,
  profileParent: profileBase,
  marker: ownerMarker,
  pid: run.browserPid,
  runnerPid: process.pid,
  executable,
});
const verifyProfileOwner = () => {
  assert(insideProfileBase(), 'Owned temporary profile containment verification failed.');
  assert(
    existsSync(profile) && realpathSync(profile) === profile,
    'Owned profile path is missing or redirected.',
  );
  const owner = JSON.parse(readFileSync(join(profile, 'p05-owner.json'), 'utf8'));
  assert(
    owner.marker === ownerMarker &&
      owner.runnerPid === process.pid &&
      owner.pid === run.browserPid &&
      owner.root === root &&
      owner.profile === profile &&
      owner.profileParent === profileBase &&
      owner.executable === executable,
    'Unique profile owner marker does not match this capture.',
  );
};

// Chrome can relaunch after the spawned launcher exits. Ownership follows the exact
// unique profile argument and marker, then verified process identities/descendants.
// Never use launcher exit alone, broad process names, or taskkill for cleanup.
const ownedWindowsProcesses = (stop, known = []) => {
  verifyProfileOwner();
  const quote = (text) => "'" + text.replaceAll("'", "''") + "'";
  const command = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$profilePath = ${quote(profile)}
$executablePath = ${quote(executable)}
$owner = Get-Content -LiteralPath ${quote(join(profile, 'p05-owner.json'))} -Raw -Encoding UTF8 | ConvertFrom-Json
if ($owner.marker -cne ${quote(ownerMarker)} -or $owner.runnerPid -ne ${process.pid} -or $owner.pid -ne ${run.browserPid ?? '$null'} -or $owner.root -cne ${quote(root)} -or $owner.profile -cne $profilePath -or $owner.profileParent -cne ${quote(profileBase)} -or $owner.executable -cne $executablePath) { throw 'Unique temporary profile owner verification rejected process inspection.' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class P05CaptureArguments {
  [DllImport("shell32.dll", SetLastError=true)] private static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string command, out int count);
  [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
  public static string[] Parse(string command) {
    if (String.IsNullOrEmpty(command)) return new string[0];
    int count; IntPtr memory = CommandLineToArgvW(command, out count);
    if (memory == IntPtr.Zero) throw new InvalidOperationException("CommandLineToArgvW failed");
    try { string[] args = new string[count]; for (int i=0; i<count; i++) args[i] = Marshal.PtrToStringUni(Marshal.ReadIntPtr(memory, i*IntPtr.Size)); return args; }
    finally { LocalFree(memory); }
  }
}
'@
$same = [StringComparison]::OrdinalIgnoreCase
$crashpadPaths = @((Join-Path (Split-Path -Parent $executablePath) 'chrome_crashpad_handler.exe'), (Join-Path (Split-Path -Parent $executablePath) 'crashpad_handler.exe'))
$databasePath = Join-Path $profilePath 'Crashpad'
$known = @(${quote(JSON.stringify(known))} | ConvertFrom-Json)
function Argument-Value {
  param([string[]]$Arguments, [string]$Name)
  for ($i=0; $i -lt $Arguments.Length; $i++) {
    if ($Arguments[$i].StartsWith($Name + '=', [StringComparison]::Ordinal)) { return $Arguments[$i].Substring($Name.Length + 1) }
    if ($Arguments[$i] -ceq $Name -and $i+1 -lt $Arguments.Length) { return $Arguments[$i+1] }
  }
  return $null
}
function Identity {
  param($Process, [string]$Reason)
  [PSCustomObject]@{ pid=[int]$Process.ProcessId; parentPid=[int]$Process.ParentProcessId; executable=[string]$Process.ExecutablePath; createdTicks=$Process.CreationDate.ToUniversalTime().Ticks.ToString(); reason=$Reason }
}
function Select-Owned {
  param([object[]]$Processes, [object[]]$Remembered)
  $selected = @{}
  $candidates = @($Processes | Where-Object { $_.ExecutablePath -and ([String]::Equals($_.ExecutablePath,$executablePath,$same) -or $crashpadPaths -icontains $_.ExecutablePath) })
  foreach ($p in $candidates) {
    $arguments = [P05CaptureArguments]::Parse($p.CommandLine)
    $profileArgument = Argument-Value $arguments '--user-data-dir'
    $databaseArgument = Argument-Value $arguments '--database'
    if ([String]::Equals($profileArgument,$profilePath,$same)) { $selected[[int]$p.ProcessId] = Identity $p 'exact executable and unique user-data-dir' }
    elseif ([String]::Equals($databaseArgument,$databasePath,$same)) { $selected[[int]$p.ProcessId] = Identity $p 'exact crashpad executable and unique database' }
    else {
      foreach ($old in $Remembered) {
        if ($old.pid -eq $p.ProcessId -and [String]::Equals($old.executable,$p.ExecutablePath,$same) -and $old.createdTicks -ceq $p.CreationDate.ToUniversalTime().Ticks.ToString()) {
          $selected[[int]$p.ProcessId] = Identity $p 'previously verified owned process identity'; break
        }
      }
    }
  }
  do {
    $changed = $false
    foreach ($p in $candidates) {
      if ($selected.ContainsKey([int]$p.ProcessId)) { continue }
      if ($selected.ContainsKey([int]$p.ParentProcessId)) {
        $parent = $selected[[int]$p.ParentProcessId]
        if ($p.CreationDate.ToUniversalTime().Ticks -ge [long]$parent.createdTicks) {
          $selected[[int]$p.ProcessId] = Identity $p 'exact executable descendant of verified owned process'; $changed = $true
        }
      }
    }
  } while ($changed)
  return @($selected.Values)
}
$before = @(Select-Owned @(Get-CimInstance Win32_Process) $known)
$stopped = @()
$errors = @()
if (${stop ? '$true' : '$false'}) {
  foreach ($owned in @($before | Sort-Object { [long]$_.createdTicks } -Descending)) {
    try {
      $current = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $owned.pid)
      if ($null -eq $current) { continue }
      if (-not [String]::Equals($current.ExecutablePath,$owned.executable,$same) -or $current.CreationDate.ToUniversalTime().Ticks.ToString() -cne $owned.createdTicks) { throw 'PID identity changed; native termination refused.' }
      $native = Get-Process -Id $owned.pid -ErrorAction SilentlyContinue
      if ($null -eq $native) { continue }
      if (-not [String]::Equals($native.Path,$owned.executable,$same) -or [Math]::Abs(($native.StartTime.ToUniversalTime() - $current.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 100) { throw 'Native process identity changed; termination refused.' }
      Stop-Process -InputObject $native -Force -ErrorAction Stop
      $stopped += $owned.pid
    } catch { $errors += [PSCustomObject]@{ pid=$owned.pid; message=$_.Exception.Message } }
  }
}
$remaining = @(Select-Owned @(Get-CimInstance Win32_Process) @($known + $before))
[PSCustomObject]@{ before=@($before); stopped=@($stopped); remaining=@($remaining); errors=@($errors) } | ConvertTo-Json -Depth 8 -Compress
`;
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 20000,
    },
  );
  assert(
    !result.error && result.status === 0,
    `Owned native process inspection failed: ${redact(result.error?.message ?? result.stderr ?? `exit ${result.status}`)}`,
  );
  const inspection = JSON.parse(result.stdout.trim().replace(/^\uFEFF/, ''));
  run.processChecks.push({ at: new Date().toISOString(), stop, ...inspection });
  run.actualBrowserPids = inspection.remaining.map((p) => p.pid);
  return inspection;
};

function measureFit() {
  const main = document.querySelector('main').getBoundingClientRect();
  const rect = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
  const visible = (e) =>
    e.getClientRects().length &&
    getComputedStyle(e).visibility !== 'hidden' &&
    getComputedStyle(e).display !== 'none';
  const clipped = (r, content = true) =>
    r.left < -1 ||
    r.right > innerWidth + 1 ||
    r.top < (content ? main.top : 0) - 1 ||
    r.bottom > (content ? main.bottom : innerHeight) + 1;
  const selector =
    'main button,main li,main h1,main h2,main p,main [role="timer"],main [role="status"],main svg,main footer';
  const elements = [...document.querySelectorAll(selector)].filter(visible).map((e) => ({
    tag: e.tagName,
    text: e.textContent.slice(0, 160),
    ...rect(e.getBoundingClientRect()),
    font: getComputedStyle(e).fontSize,
    clipped: clipped(e.getBoundingClientRect()),
  }));
  const outside = elements.filter((e) => e.clipped);
  const internalScroll = [...document.querySelectorAll('main,main *')]
    .filter((e) => !e.closest('svg') && visible(e))
    .flatMap((e) => {
      const s = getComputedStyle(e),
        x = /auto|scroll/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1,
        y = /auto|scroll/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1;
      return x || y
        ? [
            {
              tag: e.tagName,
              text: e.textContent.slice(0, 100),
              x,
              y,
              clientWidth: e.clientWidth,
              scrollWidth: e.scrollWidth,
              clientHeight: e.clientHeight,
              scrollHeight: e.scrollHeight,
            },
          ]
        : [];
    });
  const touch = [...document.querySelectorAll('button,[data-pad-primary="true"]')]
    .filter(visible)
    .map((e) => ({
      label: e.getAttribute('aria-label') ?? e.textContent.trim(),
      disabled: Boolean(e.disabled),
      ...rect(e.getBoundingClientRect()),
    }));
  const text = [],
    walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode,
      e = node.parentElement;
    if (!node.textContent.trim() || !e || e.closest('style,script,svg') || !visible(e)) continue;
    const s = getComputedStyle(e),
      box = e.getBoundingClientRect();
    if ((s.clipPath !== 'none' || s.position === 'absolute') && box.width <= 2 && box.height <= 2)
      continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const ellipsis = s.textOverflow === 'ellipsis' && s.overflowX === 'hidden';
    text.push({
      text: node.textContent.trim(),
      tag: e.tagName,
      font: s.fontSize,
      ...rect(range.getBoundingClientRect()),
      ellipsis,
      clipped: !ellipsis && clipped(range.getBoundingClientRect(), Boolean(e.closest('main'))),
    });
  }
  const color = (value) => {
    const parts = value.match(/[\d.]+/g)?.map(Number);
    return parts?.length >= 3 ? { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 } : null;
  };
  const luminance = (rgb) =>
    rgb
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const digits = [...document.querySelectorAll('[data-cell-label-id]')].map((e) => {
    const label = e.tagName.toLowerCase() === 'text' ? e : e.querySelector('text');
    if (!label) return { cellId: e.getAttribute('data-cell-label-id'), error: 'missing text' };
    const id = e.getAttribute('data-cell-label-id'),
      matrix = label.getScreenCTM(),
      plate = document.querySelector(`[data-cell-label-backplate="${CSS.escape(id)}"]`);
    const s = getComputedStyle(label),
      fg = color(s.fill),
      ps = plate && getComputedStyle(plate),
      bg = ps && color(ps.fill);
    const opaque = Boolean(bg && bg.alpha * Number(ps.fillOpacity) * Number(ps.opacity) >= 0.999);
    const contrast =
      fg && bg && opaque
        ? (Math.max(luminance(fg.rgb), luminance(bg.rgb)) + 0.05) /
          (Math.min(luminance(fg.rgb), luminance(bg.rgb)) + 0.05)
        : null;
    return {
      cellId: id,
      digit: label.textContent,
      ...rect(label.getBoundingClientRect()),
      renderedFontPx: parseFloat(s.fontSize) * Math.hypot(matrix?.a ?? 0, matrix?.b ?? 0),
      plateFill: ps?.fill ?? null,
      textFill: s.fill,
      opaqueBackplate: opaque,
      contrast,
      clipped: clipped(label.getBoundingClientRect()),
    };
  });
  const nameTags = [...document.querySelectorAll('[data-name-owner]')].map((group) => {
    const label = group.querySelector('text'),
      plate = group.querySelector('rect'),
      arena = group.closest('svg');
    if (!label || !plate || !arena)
      return {
        owner: group.getAttribute('data-name-owner'),
        error: 'missing SVG name/plate/arena',
        clipped: true,
      };
    const r = label.getBoundingClientRect(),
      p = plate.getBoundingClientRect(),
      a = arena.getBoundingClientRect(),
      matrix = label.getScreenCTM();
    const outside = (box, bounds) =>
      box.left < bounds.left - 1 ||
      box.right > bounds.right + 1 ||
      box.top < bounds.top - 1 ||
      box.bottom > bounds.bottom + 1;
    return {
      owner: group.getAttribute('data-name-owner'),
      name: label.textContent,
      fullName: group.querySelector('title')?.textContent ?? '',
      abbreviated: label.textContent !== group.querySelector('title')?.textContent,
      ...rect(r),
      plate: rect(p),
      renderedFontPx:
        parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix?.a ?? 0, matrix?.b ?? 0),
      clipped: clipped(r) || outside(r, a) || outside(p, a),
      outsideBackplate: outside(r, p),
    };
  });
  const overlap = (a, b) =>
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
  const nameTagOverlaps = [];
  for (let i = 0; i < nameTags.length; i++)
    for (let j = i + 1; j < nameTags.length; j++) {
      const a = nameTags[i],
        b = nameTags[j];
      if (a.plate && b.plate && (overlap(a, b) || overlap(a.plate, b.plate)))
        nameTagOverlaps.push({
          owners: [a.owner, b.owner],
          text: overlap(a, b),
          backplates: overlap(a.plate, b.plate),
        });
    }
  const nameDigitOverlaps = [];
  for (const tag of nameTags)
    if (tag.plate)
      for (const circle of document.querySelectorAll('[data-cell-label-backplate]')) {
        const p = circle.getBoundingClientRect(),
          cx = p.x + p.width / 2,
          cy = p.y + p.height / 2,
          radius = Math.min(p.width, p.height) / 2;
        const x = Math.max(tag.plate.x, Math.min(tag.plate.x + tag.plate.width, cx)),
          y = Math.max(tag.plate.y, Math.min(tag.plate.y + tag.plate.height, cy));
        if (Math.hypot(x - cx, y - cy) < radius - 1)
          nameDigitOverlaps.push({
            owner: tag.owner,
            cellId: circle.getAttribute('data-cell-label-backplate'),
          });
      }
  const scoreOverlaps = [
    ...document.querySelectorAll('[data-standings="tv"] [data-column="round"]'),
  ].flatMap((e) => {
    const total = e.parentElement.querySelector('[data-column="total"]');
    if (!total) return [];
    const a = document.createRange(),
      b = document.createRange();
    a.selectNodeContents(e);
    b.selectNodeContents(total);
    return a.getBoundingClientRect().right > b.getBoundingClientRect().left
      ? [{ round: e.textContent, total: total.textContent }]
      : [];
  });
  return {
    width: innerWidth,
    height: innerHeight,
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    main: rect(main),
    elements,
    outside,
    internalScroll,
    touch,
    text,
    textClipping: text.filter((t) => t.clipped),
    digits,
    nameTags,
    nameTagClipping: nameTags.filter((tag) => tag.clipped || tag.outsideBackplate),
    nameTagOverlaps,
    nameDigitOverlaps,
    scoreOverlaps,
    minimumTouchPx: touch.length
      ? Math.min(...touch.map((t) => Math.min(t.width, t.height)))
      : null,
    minimumDigitPx: digits.length ? Math.min(...digits.map((d) => d.renderedFontPx)) : null,
    minimumNamePx: nameTags.length
      ? Math.min(...nameTags.map((tag) => tag.renderedFontPx ?? 0))
      : null,
    minimumBackplateContrast: digits.length
      ? Math.min(...digits.map((d) => d.contrast ?? 0))
      : null,
  };
}

const interactions = [],
  captureResults = [];
let interactionsComplete = false;
const persistInteractions = () => {
  if (!preview) return;
  saveJson('interactive-current.json', {
    preview: { root: preview.root, pid: preview.pid },
    shell: { top: 80, bottom: 80 },
    method:
      'Native CDP pointer/key checks plus explicitly labelled lifecycle-event/view-patch probes against this owned local Controller; no original/live-room gameplay',
    completed: interactionsComplete,
    status: failure ? 'failed' : interactionsComplete ? 'passed' : 'running',
    failure: failure ? errorDetails(failure) : null,
    checks: interactions,
  });
};
const persistDiagnostics = () => {
  run.passedInteractions = interactions.length;
  run.capturedScreens = captureResults.length;
  run.failure = failure ? errorDetails(failure) : null;
  saveJson('capture-failure.json', {
    job: 'P05',
    status: failure ? 'failed' : 'no failure',
    stage: run.failureStage ?? run.stage,
    lastCdpMethod: run.lastCdpMethod ?? null,
    failureCdpMethod: run.failureCdpMethod ?? null,
    failedInputRequest: run.failedInputRequest ?? null,
    pendingInput: run.pendingInput ?? null,
    passedInteractions: interactions.length,
    capturedScreens: captureResults.length,
    originalFailure: run.originalFailure ?? null,
    failure: run.failure,
    cleanupErrors: run.cleanupErrors,
  });
  saveJson('capture-run.json', run);
};
const key = (type, key, code, modifiers = 0) =>
  ask('Input.dispatchKeyEvent', {
    type,
    key,
    code,
    modifiers,
    windowsVirtualKeyCode: { ArrowRight: 39, Space: 32 }[code] ?? 0,
  });
const inputs = () => evaluate('structuredClone(window.__blobInputs)');
const clear = () => evaluate('window.__blobClearInputs()');
let activeTouches = [],
  touchId = 0,
  touchEmulationEnabled = false;
const enableTouch = async () => {
  if (touchEmulationEnabled) return;
  assert(activeTouches.length === 0, 'Cannot change touch mode during an active gesture.');
  await ask('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  touchEmulationEnabled = true;
  // Input dispatch waits for compositor state. Allow the new touch mode and
  // newly mounted listeners to reach two real browser animation frames first.
  await evaluate(
    'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))',
  );
};
const touch = async (type, points) => {
  const terminal = type === 'touchEnd' || type === 'touchCancel';
  assert(terminal ? points.length === 0 : points.length > 0, `Invalid CDP ${type} point count.`);
  assert(
    type === 'touchStart' ? activeTouches.length === 0 : activeTouches.length > 0,
    `Invalid CDP ${type} sequence: ${activeTouches.length} active points.`,
  );
  assert(
    new Set(points.map((point) => point.id)).size === points.length,
    'Touch IDs must be unique.',
  );
  run.stage = `${run.nativeSurface}: ${run.touchPurpose ?? 'touch gesture'} ${type}`;
  await ask('Input.dispatchTouchEvent', { type, touchPoints: points });
  activeTouches = terminal ? [] : structuredClone(points);
};
const stopped = (list) =>
  list.at(-1)?.type === 'steer' && list.at(-1).x === 0 && list.at(-1).y === 0;
const record = async (phoneOnly, action, verify, method = 'native CDP input') => {
  run.stage = `${phoneOnly ? 'phone-only' : 'local phone'}: ${action}`;
  const list = await inputs();
  assert(verify(list), `${action}: ${JSON.stringify(list)}`);
  interactions.push({ phoneOnly, action, method, inputs: list });
  run.lastPassedInteraction = { phoneOnly, action };
  persistInteractions();
  persistDiagnostics();
  run.stage = `between native checks (${phoneOnly ? 'phone-only' : 'local phone'})`;
};
const drag = async (delta) => {
  const pad = await evaluate(
    '(()=>{const r=document.querySelector("[data-pad-primary=true]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height};})()',
  );
  await ask('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: pad.x,
    y: pad.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await ask('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: pad.x + delta,
    y: pad.y,
    button: 'left',
    buttons: 1,
  });
  await ask('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: pad.x + delta,
    y: pad.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  return pad;
};
const patch = async (value) => {
  await evaluate(`window.__blobSetView(${JSON.stringify(value)})`);
  await sleep(50);
};
async function checkNative(phoneOnly) {
  run.nativeSurface = phoneOnly ? 'phone-only' : 'local phone';
  assert(
    activeTouches.length === 0 && !touchEmulationEnabled,
    'Prior surface left an active touch sequence or mode.',
  );
  const url = new URL(
    `/jobs/P05-blob-arena/interactive.html?phoneonly=${Number(phoneOnly)}`,
    preview.base,
  ).href;
  await navigate(url, `window.__blobReady && window.__blobStatus.phoneOnly === ${phoneOnly}`);
  await ask('Page.bringToFront');
  assert(
    await evaluate(
      'window.__blobView.member && window.__blobView.connected && window.__blobView.canSplit',
    ),
    'Native fixture must mount an eligible connected player.',
  );
  for (const delta of [22, 44]) {
    await clear();
    const pad = await drag(delta);
    await record(
      phoneOnly,
      `native ${delta}px drag and release`,
      (list) =>
        list.some((i) => i.type === 'steer' && Math.abs(i.x - delta / 44) < 1e-6 && i.y === 0) &&
        stopped(list),
    );
    interactions.at(-1).pad = pad;
    persistInteractions();
  }
  for (const pointerKind of ['mouse', 'touch']) {
    await clear();
    if (pointerKind === 'touch') {
      run.touchPurpose = 'isolated native capture loss';
      await enableTouch();
    }
    const pad = await evaluate(
      '(()=>{const pad=document.querySelector("[data-pad-primary=true]"),r=pad.getBoundingClientRect();const probe={pointerId:null,lost:0};probe.down=e=>{probe.pointerId=e.pointerId};probe.loss=e=>{if(e.pointerId===probe.pointerId)probe.lost++};pad.addEventListener("pointerdown",probe.down,{once:true});pad.addEventListener("lostpointercapture",probe.loss);window.__p05PointerCaptureProbe=probe;return {x:r.x+r.width/2,y:r.y+r.height/2};})()',
    );
    const point = { id: ++touchId, x: pad.x, y: pad.y };
    if (pointerKind === 'touch') {
      await touch('touchStart', [point]);
      await touch('touchMove', [{ ...point, x: pad.x + 22 }]);
    } else {
      await ask('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: pad.x,
        y: pad.y,
        button: 'left',
        buttons: 1,
        clickCount: 1,
      });
      await ask('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: pad.x + 22,
        y: pad.y,
        button: 'left',
        buttons: 1,
      });
    }
    const released = await evaluate(
      '(()=>{const p=window.__p05PointerCaptureProbe,pad=document.querySelector("[data-pad-primary=true]");if(p.pointerId===null||!pad.hasPointerCapture(p.pointerId))return false;pad.releasePointerCapture(p.pointerId);return true;})()',
    );
    assert(released, `${pointerKind} native pointer never acquired capture.`);
    // A real move flushes the browser’s pending capture override before its pointermove handler.
    if (pointerKind === 'touch') await touch('touchMove', [{ ...point, x: pad.x + 23 }]);
    else
      await ask('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: pad.x + 23,
        y: pad.y,
        button: 'left',
        buttons: 1,
      });
    await sleep(30);
    const loss = await evaluate(
      '({pointerId:window.__p05PointerCaptureProbe.pointerId,lost:window.__p05PointerCaptureProbe.lost})',
    );
    assert(loss.lost > 0, `${pointerKind} browser did not deliver native lostpointercapture.`);
    await record(
      phoneOnly,
      `${pointerKind} isolated native lost capture stops steering`,
      (list) =>
        list.some((input) => input.type === 'steer' && Math.abs(input.x - 0.5) < 1e-6) &&
        stopped(list),
      'native CDP pointer plus releasePointerCapture; browser-generated lostpointercapture',
    );
    interactions.at(-1).pointerCapture = loss;
    persistInteractions();
    await clear();
    if (pointerKind === 'touch') {
      await touch('touchMove', [{ ...point, x: pad.x + 44 }]);
      await touch('touchEnd', []);
    } else {
      await ask('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: pad.x + 44,
        y: pad.y,
        button: 'left',
        buttons: 1,
      });
      await ask('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: pad.x + 44,
        y: pad.y,
        button: 'left',
        buttons: 0,
        clickCount: 1,
      });
    }
    await record(
      phoneOnly,
      `${pointerKind} old pointer movement/up stays neutral after capture loss`,
      (list) => !list.some((input) => input.type === 'steer' && (input.x !== 0 || input.y !== 0)),
    );
    await evaluate(
      '(()=>{const pad=document.querySelector("[data-pad-primary=true]"),p=window.__p05PointerCaptureProbe;pad.removeEventListener("pointerdown",p.down);pad.removeEventListener("lostpointercapture",p.loss);delete window.__p05PointerCaptureProbe;})()',
    );
  }
  await clear();
  const controls = await evaluate(
    '(()=>{const center=e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}};return {pad:center(document.querySelector("[data-pad-primary=true]")),split:center(document.querySelector("button[aria-describedby]"))};})()',
  );
  run.touchPurpose = 'two-finger steer and split';
  await enableTouch();
  const finger = { id: ++touchId, x: controls.pad.x + 44, y: controls.pad.y },
    tap = { id: ++touchId, x: controls.split.x, y: controls.split.y };
  await touch('touchStart', [{ ...finger, x: controls.pad.x }]);
  await touch('touchMove', [finger]);
  // Active-point diffs add/remove the split finger without starting a second
  // gesture or sending a nonempty terminal event (CDP Input protocol).
  await touch('touchMove', [finger, tap]);
  await touch('touchMove', [finger]);
  await touch('touchCancel', []);
  await record(
    phoneOnly,
    'two-finger steer/split/cancel',
    (list) =>
      list.filter((i) => i.type === 'split').length === 1 &&
      list.some((i) => i.type === 'steer' && i.x === 1) &&
      stopped(list),
  );
  await clear();
  await key('keyDown', 'ArrowRight', 'ArrowRight');
  await key('keyDown', ' ', 'Space');
  await key('keyUp', ' ', 'Space');
  await key('keyUp', 'ArrowRight', 'ArrowRight');
  await record(
    phoneOnly,
    'keyboard steer/split/release',
    (list) => list.filter((i) => i.type === 'split').length === 1 && stopped(list),
  );
  for (const editable of ['input', 'contenteditable']) {
    await clear();
    await key('keyDown', 'ArrowRight', 'ArrowRight');
    await evaluate(
      `(()=>{const e=document.createElement(${JSON.stringify(editable === 'input' ? 'input' : 'div')});e.id='probe-editable';if(e.tagName==='DIV')e.contentEditable='true';Object.assign(e.style,{position:'fixed',bottom:'10px',left:'10px',width:'160px',height:'44px'});document.body.append(e);e.focus();})()`,
    );
    await key('keyUp', 'ArrowRight', 'ArrowRight');
    await record(phoneOnly, `${editable} focus keyup releases held steering`, stopped);
    await clear();
    await key('keyDown', 'ArrowRight', 'ArrowRight');
    await key('keyUp', 'ArrowRight', 'ArrowRight');
    await record(
      phoneOnly,
      `${editable} keydown ignored`,
      (list) => !list.some((i) => i.type === 'steer' && (i.x !== 0 || i.y !== 0)),
    );
    await evaluate('document.getElementById("probe-editable").remove()');
  }
  for (const modifier of [1, 2, 4]) {
    await clear();
    await key('keyDown', 'ArrowRight', 'ArrowRight', modifier);
    await key('keyUp', 'ArrowRight', 'ArrowRight', modifier);
    await record(
      phoneOnly,
      `modifier ${modifier} keydown ignored`,
      (list) => !list.some((i) => i.type === 'steer' && (i.x !== 0 || i.y !== 0)),
    );
    await clear();
    await key('keyDown', 'ArrowRight', 'ArrowRight');
    await key('keyUp', 'ArrowRight', 'ArrowRight', modifier);
    await record(phoneOnly, `modifier ${modifier} keyup releases prior hold`, stopped);
  }
  await clear();
  await key('keyDown', 'ArrowRight', 'ArrowRight');
  await drag(22);
  await record(
    phoneOnly,
    'pointer release preserves independent keyboard hold',
    (list) => list.at(-1)?.type === 'steer' && list.at(-1).x === 1,
  );
  await key('keyUp', 'ArrowRight', 'ArrowRight');
  await record(phoneOnly, 'last held source releases', stopped);
  for (const event of ['blur', 'pagehide', 'offline', 'online']) {
    await clear();
    await key('keyDown', 'ArrowRight', 'ArrowRight');
    await evaluate(`window.dispatchEvent(new Event(${JSON.stringify(event)}))`);
    await record(
      phoneOnly,
      `${event} resets holds`,
      stopped,
      'native key plus synthetic browser lifecycle event',
    );
    await key('keyUp', 'ArrowRight', 'ArrowRight');
  }
  await clear();
  await key('keyDown', 'ArrowRight', 'ArrowRight');
  await evaluate(
    'Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))',
  );
  await record(
    phoneOnly,
    'hidden visibility resets holds',
    stopped,
    'native key plus synthetic hidden-document event',
  );
  await evaluate('delete document.hidden');
  await key('keyUp', 'ArrowRight', 'ArrowRight');
  await clear();
  await key('keyDown', 'ArrowRight', 'ArrowRight');
  await evaluate('window.__blobSetIdentity("p2")');
  await sleep(50);
  await record(
    phoneOnly,
    'same-phase identity change resets steering',
    stopped,
    'native key plus authored identity/view change',
  );
  await clear();
  await evaluate('window.__blobSetIdentity("p1")');
  await sleep(50);
  await record(
    phoneOnly,
    'identity restoration does not restart steering',
    (list) => !list.some((i) => i.type === 'steer' && (i.x !== 0 || i.y !== 0)),
    'authored identity/view restoration',
  );
  await key('keyUp', 'ArrowRight', 'ArrowRight');
  const initial = await evaluate('structuredClone(window.__blobView)');
  const ownId = await evaluate('window.__blobStatus.playerId');
  const offlineEnvelope = initial.players.map((player) =>
    player.id === ownId ? { ...player, connected: false } : player,
  );
  assert(
    initial.connected === true &&
      offlineEnvelope.some((player) => player.id === ownId && !player.connected),
    'Envelope-only drop requires a connected own original seat.',
  );
  await clear();
  await key('keyDown', 'ArrowRight', 'ArrowRight');
  await patch({ connected: true, players: offlineEnvelope });
  assert(
    await evaluate('window.__blobView.connected===true'),
    'Envelope-only probe must retain true CV.connected.',
  );
  await record(
    phoneOnly,
    'own envelope-only disconnect resets held steering',
    stopped,
    'native key plus authored envelope-only presence patch',
  );
  await clear();
  await key('keyDown', 'ArrowRight', 'ArrowRight');
  await key('keyUp', 'ArrowRight', 'ArrowRight');
  await drag(22);
  await record(
    phoneOnly,
    'own envelope-only disconnect blocks fresh key and pointer movement',
    (list) => !list.some((input) => input.type === 'steer' && (input.x !== 0 || input.y !== 0)),
  );
  await clear();
  await patch({ connected: true, players: initial.players });
  await record(
    phoneOnly,
    'own envelope reconnection never restarts steering',
    (list) => !list.some((input) => input.type === 'steer' && (input.x !== 0 || input.y !== 0)),
    'authored envelope presence restoration',
  );
  await clear();
  await key('keyDown', 'ArrowRight', 'ArrowRight');
  await key('keyUp', 'ArrowRight', 'ArrowRight');
  await record(
    phoneOnly,
    'fresh key works after own envelope reconnection',
    (list) => list.some((input) => input.type === 'steer' && input.x === 1) && stopped(list),
  );
  for (const [name, value] of [
    ['disconnected', { connected: false }],
    ['pause', { paused: true, clockHeldAt: initial.began + initial.checked }],
    ['round change', { round: initial.round + 1 }],
    ['permanent departure', { member: false, departed: true, connected: false }],
  ]) {
    await clear();
    await key('keyDown', 'ArrowRight', 'ArrowRight');
    await patch(value);
    await record(
      phoneOnly,
      `${name} context resets held steering`,
      stopped,
      'native key plus authored public-view patch',
    );
    await clear();
    await patch(initial);
    await record(
      phoneOnly,
      `${name} restoration never restarts steering`,
      (list) => !list.some((i) => i.type === 'steer' && (i.x !== 0 || i.y !== 0)),
      'authored public-view restoration',
    );
    await clear();
    await key('keyDown', 'ArrowRight', 'ArrowRight', 0);
    // A fresh keydown is allowed; context restoration itself must never restart a hold.
    await key('keyUp', 'ArrowRight', 'ArrowRight');
    await record(
      phoneOnly,
      `${name} fresh key works after restoration`,
      (list) => list.some((i) => i.type === 'steer' && i.x === 1) && stopped(list),
    );
  }
  assert(
    !(await evaluate('window.__blobStatus.error')),
    'Mounted preview reported a browser error.',
  );
  assert(activeTouches.length === 0, 'Native checks left a touch held.');
  if (touchEmulationEnabled) {
    await ask('Emulation.setTouchEmulationEnabled', { enabled: false });
    touchEmulationEnabled = false;
  }
}

async function checkMotion() {
  const current = await evaluate('structuredClone(window.__blobView)');
  if (!current.arena?.cells?.length) return;
  const cell = { ...current.arena.cells[0], x: 60, y: 50 };
  await patch({ arena: { ...current.arena, cells: [cell] } });
  await sleep(250);
  await patch({ arena: { ...current.arena, cells: [{ ...cell, x: 80 }] } });
  const result = await evaluate(
    `(()=>{const groups=[...document.querySelectorAll('[data-pose-cell="${cell.id}"]')];for(const g of groups)for(const a of g.getAnimations()){a.pause();a.currentTime=100;}return {duration:groups.map(g=>getComputedStyle(g).transitionDuration),midpoint:groups.map(g=>{const m=new DOMMatrix(getComputedStyle(g).transform);return {layer:g.dataset.poseLayer,x:m.m41,y:m.m42}})};})()`,
  );
  assert(
    result.midpoint.length === 3 &&
      result.midpoint.every((p) => Math.abs(p.x - 70) < 0.1 && Math.abs(p.y - 50) < 0.1),
    'Body/plate/number midpoint must remain aligned.',
  );
  await patch({ paused: true, clockHeldAt: current.began + current.checked });
  result.paused = await evaluate(
    'getComputedStyle(document.querySelector("[data-pose-layer=body]")).transitionDuration',
  );
  await patch({ paused: false });
  await evaluate('document.documentElement.style.setProperty("--pb-motion-fast","0ms")');
  result.appOff = await evaluate(
    'getComputedStyle(document.querySelector("[data-pose-layer=body]")).transitionDuration',
  );
  await evaluate('document.documentElement.style.removeProperty("--pb-motion-fast")');
  await evaluate('document.documentElement.dataset.motion="off"');
  result.rootMotionOff = await evaluate(
    'getComputedStyle(document.querySelector("[data-pose-layer=body]")).transitionDuration',
  );
  await evaluate('delete document.documentElement.dataset.motion');
  result.frozen = {};
  for (const phaseId of ['score', 'done']) {
    await evaluate(`window.__blobSetFixture(${JSON.stringify(phaseId)})`);
    await sleep(50);
    const envelope = await evaluate('structuredClone(window.__blobView)');
    assert(
      envelope.phaseId === phaseId && envelope.arena,
      'Frozen motion probe requires the actual phase fixture envelope.',
    );
    await patch({ arena: { ...envelope.arena, cells: [{ ...cell, x: 80 }] } });
    result.frozen[phaseId] = await evaluate(
      'getComputedStyle(document.querySelector("[data-pose-layer=body]")).transitionDuration',
    );
  }
  await evaluate('window.__blobSetFixture("play")');
  await sleep(50);
  await ask('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  result.reduced = await evaluate(
    'getComputedStyle(document.querySelector("[data-pose-layer=body]")).transitionDuration',
  );
  await ask('Emulation.setEmulatedMedia', { features: [] });
  assert(
    [
      result.paused,
      result.appOff,
      result.rootMotionOff,
      result.reduced,
      ...Object.values(result.frozen),
    ].every((v) => v === '0s'),
    'Frozen/reduced-motion poses must not animate.',
  );
  result.method =
    'Authored single-cell mounted snapshot art; actual score/done fixture envelopes; CSS transitions paused at100ms midpoint. No original/live-room gameplay claim.';
  writeFileSync(join(directory, 'motion.json'), JSON.stringify(result, null, 2) + '\n');
}

try {
  await initializeCapture();
  run.previewPid = preview?.pid ?? null;
  persistInteractions();
  persistDiagnostics();
  run.stage = 'browser launch';
  writeFileSync(join(profile, 'p05-owner.json'), JSON.stringify(ownerData()));
  browser = spawn(
    executable,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--disable-background-networking',
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  await new Promise((resolveSpawn, reject) => {
    browser.once('spawn', resolveSpawn);
    browser.once('error', reject);
  });
  run.browserPid = browser.pid;
  writeFileSync(join(profile, 'p05-owner.json'), JSON.stringify(ownerData()));
  run.stage = 'browser debugging connection';
  let port;
  for (let i = 0; i < 100; i++) {
    const active = join(profile, 'DevToolsActivePort');
    if (existsSync(active)) {
      port = readFileSync(active, 'utf8').split('\n')[0];
      break;
    }
    await sleep(100);
  }
  assert(port, 'Owned Chromium did not publish its debugging port.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data),
      request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(message.id);
    if (message.error) {
      const error = new Error(message.error.message);
      finishInputRequest(request.input, 'protocol error', error);
      request.reject(error);
    } else {
      finishInputRequest(request.input, 'passed');
      request.resolve(message.result);
    }
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      const error = new Error('Owned browser CDP connection closed');
      finishInputRequest(request.input, 'connection closed', error);
      request.reject(error);
    }
    pending.clear();
  });
  await ask('Page.enable');
  await ask('Runtime.enable');
  if (preview) {
    await ask('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const phoneOnly of [false, true]) {
      run.stage = `mount ${phoneOnly ? 'phone-only' : 'local phone'} native checks`;
      await checkNative(phoneOnly);
    }
    run.stage = 'mounted motion checks';
    await checkMotion();
    interactionsComplete = true;
    persistInteractions();
    console.log(`Native mounted-controller checks: ${interactions.length}`);
  }
  const pages = process.env.PB_INTERACTIVE_ONLY
      ? []
      : JSON.parse(readFileSync(join(directory, 'screens.json'), 'utf8')),
    results = captureResults;
  run.expectedScreens = pages.length;
  if (pages.length) saveJson('fit.json', results);
  for (const page of pages) {
    run.stage = `static capture ${page.name}`;
    await ask('Emulation.setDeviceMetricsOverride', {
      width: page.width,
      height: page.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate(pathToFileURL(join(directory, 'media', page.name)).href);
    const fit = await evaluate(`(${measureFit.toString()})()`),
      png = await ask('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const file = join(directory, 'media', page.name.replace('.html', '.png')),
      bytes = Buffer.from(png.data, 'base64'),
      current = readdirSync(join(directory, 'media')).reduce(
        (sum, f) => sum + statSync(join(directory, 'media', f)).size,
        0,
      );
    assert(
      current - (existsSync(file) ? statSync(file).size : 0) + bytes.length < 10_000_000,
      'P05 media would exceed10MB.',
    );
    writeFileSync(file, bytes);
    results.push({ ...page, ...fit });
    saveJson('fit.json', results);
    persistDiagnostics();
    console.log(
      `${page.name}: outside=${fit.outside.length}, text=${fit.textClipping.length}, scroll=${fit.internalScroll.length}, touch=${fit.minimumTouchPx}, digits=${fit.minimumDigitPx}, names=${fit.minimumNamePx}, nameClip=${fit.nameTagClipping.length}, nameOverlap=${fit.nameTagOverlaps.length + fit.nameDigitOverlaps.length}, contrast=${fit.minimumBackplateContrast}`,
    );
  }
  if (pages.length) {
    writeFileSync(join(directory, 'fit.json'), JSON.stringify(results, null, 2) + '\n');
    const failures = results.filter(
      (r) =>
        r.overflowX ||
        r.overflowY ||
        r.outside.length ||
        r.internalScroll.length ||
        r.textClipping.length ||
        r.scoreOverlaps.length ||
        r.nameTagClipping.length ||
        r.nameTagOverlaps.length ||
        r.nameDigitOverlaps.length ||
        (r.minimumNamePx !== null && r.minimumNamePx < (r.surface === 'tv' ? 31.99 : 13.99)) ||
        (r.minimumTouchPx !== null && r.minimumTouchPx < 44) ||
        (r.minimumDigitPx !== null && r.minimumDigitPx < 15.99) ||
        (r.minimumBackplateContrast !== null && r.minimumBackplateContrast < 4.5),
    );
    assert(
      failures.length === 0,
      `Capture fit failures: ${failures.map((r) => r.name).join(', ')}`,
    );
  }
  run.captureCompleted = true;
  run.stage = 'capture complete';
} catch (error) {
  failure ??= error;
  run.failureStage = run.stage;
  run.failureCdpMethod = run.failedInputRequest?.method ?? run.lastCdpMethod;
  run.originalFailure = errorDetails(failure);
  // Save the caught stack and completed checks before any process/profile cleanup.
  persistInteractions();
  persistDiagnostics();
  console.error(
    `[P05 capture failure before cleanup]\n${run.originalFailure.stack ?? run.originalFailure.message}`,
  );
} finally {
  const cleanupError = (stage, error) => {
    run.cleanupErrors.push({ stage, ...errorDetails(error) });
  };
  let remembered = [];
  // Snapshot descendants before CDP close, so orphaned crashpad/renderers retain
  // their exact executable + creation-time identity if the main process exits.
  if (browser?.pid && process.platform === 'win32') {
    try {
      const inspection = ownedWindowsProcesses(false);
      remembered = [...inspection.before, ...inspection.remaining];
    } catch (error) {
      cleanupError('pre-close owned process census', error);
    }
  }
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await ask('Browser.close', {}, 2500);
      run.cdpClose = 'acknowledged';
    } catch (error) {
      run.cdpClose = errorDetails(error);
    }
  }
  try {
    socket?.close();
  } catch (error) {
    cleanupError('CDP socket close', error);
  }
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    const error = new Error('Capture closed');
    finishInputRequest(request.input, 'capture closed', error);
    request.reject(error);
  }
  pending.clear();
  if (browser?.pid) {
    if (process.platform === 'win32') {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const inspection = ownedWindowsProcesses(true, remembered);
          remembered = [...remembered, ...inspection.before, ...inspection.remaining];
          for (const error of inspection.errors)
            cleanupError(
              'verified native Stop-Process',
              new Error(`PID ${error.pid}: ${error.message}`),
            );
          run.browserClosed = inspection.remaining.length === 0;
          if (run.browserClosed) break;
        } catch (error) {
          cleanupError('owned profile process closure verification', error);
        }
        await sleep(200);
      }
    } else {
      // This Windows runner cannot prove a relaunching process tree on another OS.
      cleanupError(
        'process verification',
        new Error('Native owned-process cleanup requires Windows; profile retained.'),
      );
    }
  } else run.browserClosed = true;
  run.launcherExitCode = browser?.exitCode ?? null;
  run.launcherSignalCode = browser?.signalCode ?? null;
  if (run.browserClosed && profile && existsSync(profile)) {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        verifyProfileOwner();
        // Recheck native ownership after closure before touching this exact profile.
        if (browser?.pid) {
          const inspection = ownedWindowsProcesses(false, remembered);
          assert(
            inspection.remaining.length === 0,
            'Owned profile still has a live verified process; removal refused.',
          );
        }
        // Node retries transient Windows file locks inside this already verified
        // removal, even if an earlier attempt has removed the marker file.
        rmSync(profile, { recursive: true, force: true, maxRetries: 7, retryDelay: 200 });
        run.profileRemoved = !existsSync(profile);
        if (run.profileRemoved) break;
      } catch (error) {
        if (attempt === 7) cleanupError('verified temporary profile removal', error);
      }
      await sleep(200);
    }
  } else if (!profile) {
    run.profileRemoved = true;
  }
  if (preview && process.env.PB_KEEP_PREVIEW !== '1') {
    try {
      const response = await fetch(new URL('/__p05_preview/close', preview.base), {
        method: 'POST',
        headers: { 'x-p05-preview-token': preview.token },
        signal: AbortSignal.timeout(5000),
      });
      run.previewClosed = response.ok;
    } catch (error) {
      cleanupError('owned preview close', error);
    }
  }
  if (
    !run.browserClosed ||
    !run.profileRemoved ||
    (preview && process.env.PB_KEEP_PREVIEW !== '1' && !run.previewClosed)
  )
    failure ??= new Error('Owned browser/profile/helper cleanup incomplete; see capture-run.json.');
  run.finishedAt = new Date().toISOString();
  run.status = failure ? 'failed' : 'passed';
  persistInteractions();
  persistDiagnostics();
}
if (failure) throw failure;
