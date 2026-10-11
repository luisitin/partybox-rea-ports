// The Chrome launcher can exit while its private browser keeps running on Windows.
// Every forced stop rechecks the unique profile, PID, creation time and full command line.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function powershell(script) {
  return new Promise((done, reject) => {
    const command = `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); ${script}`;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let errors = '';
    let settled = false;
    let flush;
    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(flush);
      child.stdout.destroy();
      child.stderr.destroy();
      if (error) reject(error);
      else if (code !== 0) reject(new Error(`Chrome process check failed: ${errors.trim()}`));
      else {
        try {
          if (!output.trim()) throw new Error('Chrome process check produced no JSON result.');
          done(JSON.parse(output.trim()));
        } catch (failure) {
          reject(failure);
        }
      }
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(undefined, new Error('Timed out checking private Chrome processes.'));
    }, 20_000);
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      errors += chunk;
    });
    child.once('error', (error) => {
      finish(undefined, error);
    });
    child.once('exit', (code) => {
      // Windows descendants can retain inherited pipe handles after PowerShell exits.
      clearTimeout(timeout);
      flush = setTimeout(() => finish(code), 100);
    });
    child.once('close', (code) => finish(code));
  });
}

const profileFilter = (profile) => `
  $ownerProfile = ${literal(resolve(profile))}.Replace('/', '\');
  function MatchesProfile($process) {
    $chrome = $process.Name -in @('chrome.exe','chrome_crashpad_handler.exe','crashpad_handler.exe');
    $command = ([string]$process.CommandLine).Replace('/', '\');
    return $chrome -and $command.IndexOf($ownerProfile,[StringComparison]::OrdinalIgnoreCase) -ge 0;
  }
`;

function scopedProcesses(profile) {
  return powershell(`
    $ErrorActionPreference = 'Stop';
    ${profileFilter(profile)}
    $active = @(); $exited = @();
    $matches = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='chrome_crashpad_handler.exe' OR Name='crashpad_handler.exe'" | Where-Object { MatchesProfile $_ });
    foreach ($match in $matches) {
      $record = [pscustomobject]@{ pid=[int]$match.ProcessId; created=$match.CreationDate.ToUniversalTime().ToString('o'); command=[string]$match.CommandLine };
      $native = $null;
      try {
        $native = [Diagnostics.Process]::GetProcessById([int]$match.ProcessId);
        if ($native.HasExited) {
          $record | Add-Member -NotePropertyName nativeState -NotePropertyValue 'exited';
          $exited += $record;
        } else { $active += $record; }
      } catch {
        if ($_.Exception.GetBaseException() -is [ArgumentException]) {
          $record | Add-Member -NotePropertyName nativeState -NotePropertyValue 'not-found';
          $exited += $record;
        } else {
          $record | Add-Member -NotePropertyName inspectionError -NotePropertyValue ([string]$_.Exception.Message);
          $active += $record;
        }
      } finally { if ($native) { $native.Dispose(); } }
    }
    ConvertTo-Json -InputObject @{ active=$active; exited=$exited } -Compress -Depth 4;
  `);
}

function stopMatchingProcesses(profile, records) {
  return powershell(`
    $ErrorActionPreference = 'Stop';
    ${profileFilter(profile)}
    $expected = ConvertFrom-Json -InputObject ${literal(JSON.stringify(records))};
    $stopped = @();
    foreach ($record in $expected) {
      $current = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$record.pid);
      if ($current -and (MatchesProfile $current) -and
          $current.CreationDate.ToUniversalTime().ToString('o') -eq $record.created -and
          ([string]$current.CommandLine) -ceq ([string]$record.command)) {
        Stop-Process -Id ([int]$record.pid) -Force -ErrorAction SilentlyContinue;
        $stopped += [int]$record.pid;
      }
    }
    ConvertTo-Json -InputObject $stopped -Compress;
  `);
}

/** Gracefully close the actual CDP browser, then prove its unique profile has no live Chrome. */
export async function closePrivateChrome(profile, gracefulClose) {
  let before = { active: [], exited: [] };
  let snapshotWarning;
  try {
    before = await scopedProcesses(profile);
  } catch (error) {
    // Process inspection failing must never prevent the authorized graceful browser close.
    snapshotWarning = String(error);
  }
  let gracefulWarning;
  try {
    await gracefulClose();
  } catch (error) {
    gracefulWarning = String(error);
  }
  await sleep(250);
  const exitedRecords = new Map();
  const rememberExited = (snapshot) => {
    for (const record of snapshot.exited)
      exitedRecords.set(`${record.pid}:${record.created}`, record);
  };
  rememberExited(before);
  let status = await scopedProcesses(profile);
  rememberExited(status);
  let remaining = status.active;
  const forced = remaining.length ? await stopMatchingProcesses(profile, remaining) : [];
  for (let attempt = 0; remaining.length && attempt < 5; attempt++) {
    await sleep(200);
    status = await scopedProcesses(profile);
    rememberExited(status);
    remaining = status.active;
  }
  if (remaining.length)
    throw new Error(
      `Private Chrome processes remain: ${remaining.map((item) => item.pid).join(',')}`,
    );
  return {
    verifiedClosed: true,
    observedProcesses: before.active.length + before.exited.length,
    forcedProcesses: forced.length,
    exitedRecords: [...exitedRecords.values()].map(({ pid, created, nativeState }) => ({
      pid,
      created,
      nativeState,
    })),
    ...(exitedRecords.size
      ? {
          warning:
            'Windows retains exited Chrome process records; no native active process remains.',
        }
      : {}),
    ...(snapshotWarning ? { snapshotWarning } : {}),
    ...(gracefulWarning ? { gracefulWarning } : {}),
  };
}
