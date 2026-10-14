// Windows Chrome can hand off to another PID. Close only this harness's unique profile.
import { spawnSync } from 'node:child_process';

export function closeBrowserProfile(profile) {
  if (process.platform !== 'win32') return;
  const literal = profile.replaceAll("'", "''");
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$profilePath='${literal}'; Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profilePath) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ],
    { windowsHide: true, stdio: 'ignore', timeout: 10_000 },
  );
}
