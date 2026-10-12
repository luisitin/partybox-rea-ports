// P09 safe CDP/profile ownership helpers, adapted for the P05 local capture.
import { spawn, execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const delay = (ms) => new Promise((done) => setTimeout(done, ms));

export async function devToolsEndpoint(child, profile) {
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

export function ownedProfile(profile) {
  const absolute = resolve(profile);
  if (
    dirname(absolute) !== resolve(tmpdir()) ||
    !basename(absolute).startsWith('partybox-p05-capture-')
  ) {
    throw new Error(`Refusing cleanup outside the generated capture profile: ${absolute}`);
  }
  return absolute;
}

export async function closeProfileProcesses(profile) {
  // Pass ownership through an environment variable, never a string-built shell command.
  // Enumerate/stop only chrome.exe processes with this exact user-data-dir argument.
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$taskCaptureProfile = $env:PB_P05_CAPTURE_PROFILE
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
        env: { ...process.env, PB_P05_CAPTURE_PROFILE: ownedProfile(profile) },
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
  return report;
}

export class Cdp {
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
