// Windows launchers may hand off to a child. Close only this unique evidence profile.
import { spawnSync } from 'node:child_process';

export function closeBrowserProfile(profile) {
  if (process.platform !== 'win32') return;
  const literal = profile.replaceAll("'", "''");
  const command = `$profilePath='${literal}'; for ($closeAttempt=0; $closeAttempt -lt 4; $closeAttempt++) { $ownedProcesses=@(Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profilePath) }); if ($ownedProcesses.Count -eq 0) { exit 0 }; foreach ($ownedProcess in $ownedProcesses) { & taskkill.exe /PID $ownedProcess.ProcessId /T /F 2>$null | Out-Null }; Start-Sleep -Milliseconds 200 }; exit 1`;
  // PowerShell's -Command can strip embedded argument quotes on Windows; encode the exact script.
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(command, 'utf16le').toString('base64'),
    ],
    { windowsHide: true, encoding: 'utf8', timeout: 15_000 },
  );
  if (result.error || result.status !== 0)
    console.error(`Owned browser cleanup failed: ${result.error?.message ?? result.stderr}`);
}
