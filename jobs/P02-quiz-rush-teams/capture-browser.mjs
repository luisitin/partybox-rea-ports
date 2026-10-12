// Bounded launch/cleanup probes for this job's unique profile, copied from public P04's protocol.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export function browserEndpoint(processHandle, profile) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const finish = (error, endpoint) => {
      clearInterval(probe);
      clearTimeout(deadline);
      processHandle.stderr?.removeListener('data', onData);
      processHandle.removeListener('error', onError);
      error ? reject(error) : resolve(endpoint);
    };
    const probe = setInterval(() => {
      try {
        const [port, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8')
          .trim()
          .split(/\r?\n/);
        if (/^\d+$/.test(port) && path?.startsWith('/devtools/browser/'))
          finish(null, `ws://127.0.0.1:${port}${path}`);
      } catch {
        /* The owned browser has not published its endpoint yet. */
      }
    }, 100);
    const deadline = setTimeout(
      () => finish(new Error('P02 capture browser did not start within 15 seconds.')),
      15_000,
    );
    const onData = (chunk) => {
      stderr = (stderr + chunk).slice(-16_384);
      const match = /DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/.exec(stderr);
      if (match) finish(null, match[1]);
    };
    const onError = (error) => finish(error);
    processHandle.stderr?.on('data', onData);
    processHandle.once('error', onError);
  });
}

export function verifyClosedProfile(profile) {
  if (process.platform !== 'win32') return true;
  const literal = profile.replaceAll("'", "''");
  const command = `$captureProfile='${literal}'; for ($captureAttempt=0; $captureAttempt -lt 8; $captureAttempt++) { $captureProcesses=@(Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($captureProfile) }); if ($captureProcesses.Count -eq 0) { exit 0 }; Start-Sleep -Milliseconds 200 }; exit 1`;
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(command, 'utf16le').toString('base64'),
    ],
    { windowsHide: true, stdio: 'ignore', timeout: 10_000 },
  );
  return result.status === 0;
}
