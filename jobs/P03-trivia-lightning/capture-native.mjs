// CDP membership proves ownership; native PID/start time prevents stopping a reused process ID.
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const active = (record) => ['active', 'inspection-error'].includes(record.nativeState);

function nativeQuery(profile, records, operation, powershell) {
  return powershell(
    `
    $ErrorActionPreference = 'Stop';
    $ownerProfile = ${literal(profile)}.Replace('/', '\');
    $members = ConvertFrom-Json -InputObject ${literal(JSON.stringify(records))};
    $result = @();
    foreach ($member in $members) {
      $native = $null;
      $record = [ordered]@{ pid=[int]$member.pid; type=[string]$member.type; source=[string]$member.source };
      if ($member.created) { $record.created = [string]$member.created; }
      try {
        $native = [Diagnostics.Process]::GetProcessById([int]$member.pid);
        if ($native.HasExited) { $record.nativeState = 'exited'; }
        else {
          $created = $native.StartTime.ToUniversalTime().ToString('o');
          $name = $native.ProcessName;
          if ($member.created -and $created -cne [string]$member.created) { $record.nativeState = 'pid-reused'; }
          elseif ($name -ne 'chrome') {
            if ($member.source -eq 'launcher') { $record.nativeState = 'not-this-profile'; }
            else { throw 'A CDP process ID no longer identifies Chrome.'; }
          } else {
            $record.created = $created; $record.nativeName = $name;
            $owned = $member.source -eq 'cdp';
            if (-not $owned) {
              $cim = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$member.pid);
              $command = ([string]$cim.CommandLine).Replace('/', '\');
              $owned = $cim.Name -eq 'chrome.exe' -and $command.IndexOf($ownerProfile,[StringComparison]::OrdinalIgnoreCase) -ge 0;
              if ($member.command -and ([string]$cim.CommandLine) -cne ([string]$member.command)) { $owned = $false; }
              $record.command = [string]$cim.CommandLine;
            }
            if (-not $owned) { $record.nativeState = 'not-this-profile'; }
            elseif (${literal(operation)} -eq 'stop') {
              if (-not $member.created) { throw 'Refusing stop without cached native creation time.'; }
              $native.Refresh();
              if (-not $native.HasExited -and $native.ProcessName -eq 'chrome' -and $native.StartTime.ToUniversalTime().ToString('o') -ceq [string]$member.created) {
                $native.Kill(); $record.nativeState = 'stop-requested';
              } else { $record.nativeState = 'exited'; }
            } else { $record.nativeState = 'active'; }
          }
        }
      } catch {
        if (-not $native -and $_.Exception.GetBaseException() -is [ArgumentException]) { $record.nativeState = 'not-found'; }
        else { $record.nativeState = 'inspection-error'; $record.error = [string]$_.Exception.Message; }
      } finally { if ($native) { $native.Dispose(); } }
      $result += [pscustomobject]$record;
    }
    ConvertTo-Json -InputObject $result -Compress -Depth 4;
  `,
    `native ${operation}`,
  );
}

async function closedEndpoint(endpointUrl) {
  if (!endpointUrl) return { checked: false };
  const expected = new URL(endpointUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(expected.hostname))
    throw new Error('Private Chrome endpoint must use loopback.');
  const version = new URL('/json/version', expected);
  version.protocol = expected.protocol === 'wss:' ? 'https:' : 'http:';
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(version, { signal: AbortSignal.timeout(500) });
      const current = await response.json();
      if (current.webSocketDebuggerUrl !== expected.href)
        return { checked: true, closed: true, portReused: true };
    } catch {
      return { checked: true, closed: true };
    }
    await sleep(150);
  }
  return { checked: true, closed: false };
}

/** Ownership failures return diagnostic data and leave final proof to scoped CIM verification. */
export async function closeKnownChrome(profile, gracefulClose, known, powershell) {
  const supplied = Array.isArray(known?.processes) ? known.processes : [];
  const processes = supplied.map((process) => ({ ...process, id: Number(process.id) }));
  const browser = processes.find(
    (process) =>
      String(process.type).toLowerCase() === 'browser' &&
      Number.isSafeInteger(process.id) &&
      process.id > 0,
  );
  if (!browser)
    return {
      fallbackRequired: true,
      gracefulCloseAttempted: false,
      inspectionWarning: 'CDP did not supply a browser member with a positive integer PID.',
      suppliedProcesses: supplied.map(({ type, id }) => ({ type, id })),
    };
  const members = new Map();
  for (const process of processes) {
    if (!Number.isSafeInteger(process.id) || process.id <= 0) continue;
    members.set(process.id, { pid: process.id, type: process.type, source: 'cdp' });
  }
  if (Number.isSafeInteger(known.launcherPid) && !members.has(known.launcherPid))
    members.set(known.launcherPid, {
      pid: known.launcherPid,
      type: 'launcher',
      source: 'launcher',
    });
  let before;
  let inspectionWarning;
  try {
    before = await nativeQuery(profile, [...members.values()], 'snapshot', powershell);
  } catch (error) {
    inspectionWarning = String(error);
  }
  let gracefulWarning;
  try {
    console.log('Chrome cleanup: graceful browser close started.');
    await gracefulClose();
  } catch (error) {
    gracefulWarning = String(error);
  } finally {
    console.log('Chrome cleanup: graceful browser close finished.');
  }
  if (!before)
    return {
      fallbackRequired: true,
      gracefulCloseAttempted: true,
      inspectionWarning,
      gracefulWarning,
    };
  const pending = before.filter(active);
  if (pending.some((record) => !record.created || record.nativeState === 'inspection-error'))
    return {
      fallbackRequired: true,
      gracefulCloseAttempted: true,
      inspectionWarning: 'Native ownership cache was incomplete; scoped CIM must verify closure.',
      gracefulWarning,
      records: before,
    };
  // An exited/missing PID is terminal evidence; never recache it after possible PID reuse.
  const terminal = before.filter((record) => !active(record));
  let current = [
    ...terminal,
    ...(pending.length ? await nativeQuery(profile, pending, 'inspect', powershell) : []),
  ];
  const forced = current.filter((record) => active(record) && record.created);
  if (forced.length) await nativeQuery(profile, forced, 'stop', powershell);
  for (let attempt = 0; current.some(active) && attempt < 5; attempt++) {
    await sleep(100);
    current = [...terminal, ...(await nativeQuery(profile, pending, 'inspect', powershell))];
  }
  if (current.some(active))
    throw new Error(
      `Private CDP Chrome is still active: ${JSON.stringify(current.filter(active))}`,
    );
  console.log('Chrome cleanup: exact endpoint verification started.');
  const endpoint = await closedEndpoint(known.endpointUrl);
  console.log(
    `Chrome cleanup: exact endpoint verification ${endpoint.closed === false ? 'failed' : 'finished'}.`,
  );
  if (endpoint.closed === false)
    throw new Error('The exact private Chrome debugging endpoint remains open.');
  const exitedRecords = current
    .filter((record) => ['exited', 'not-found', 'pid-reused'].includes(record.nativeState))
    .map(({ pid, created, type, nativeState }) => ({ pid, created, type, nativeState }));
  return {
    verifiedClosed: true,
    verification: 'CDP process membership plus native PID/creation/exit checks',
    browserPid: browser.id,
    observedProcesses: before.filter(active).length,
    forcedProcesses: forced.length,
    exitedRecords,
    endpoint,
    ...(current.some((record) => record.nativeState === 'exited')
      ? {
          warning: 'Windows retains native-exited Chrome records; no owned active process remains.',
        }
      : {}),
    ...(inspectionWarning ? { inspectionWarning } : {}),
    ...(gracefulWarning ? { gracefulWarning } : {}),
  };
}
