// Windows launchers may hand off to a child. Close only this unique evidence profile.
import { spawn } from 'node:child_process';

export async function closeBrowserProfile(profile) {
  if (process.platform !== 'win32') return true;
  const command = profileCommand(
    profile,
    `
    for ($closeAttempt=0; $closeAttempt -lt 4; $closeAttempt++) {
      $ownedProcesses=@(Get-OwnedProfileProcesses);
      if ($ownedProcesses.Count -eq 0) { exit 0 };
      foreach ($ownedProcess in $ownedProcesses) {
        # Every PID is fenced to this exact profile; requery catches late launcher children.
        Stop-Process -Id $ownedProcess.ProcessId -Force -ErrorAction SilentlyContinue;
      };
      Start-Sleep -Milliseconds 200;
    };
    if (@(Get-OwnedProfileProcesses).Count -eq 0) { exit 0 };
    exit 1;
  `,
  );
  const result = await runProfileCommand(command, 15_000);
  if (result.error || result.status !== 0)
    console.error(
      `Owned browser cleanup failed: ${result.error || result.stderr || `PowerShell status ${result.status}`}`,
    );
  return !result.error && result.status === 0;
}

// Match the complete user-data-dir argument, including Windows' quoted forms.
export function profileCommand(profile, body) {
  const literal = profile.replaceAll("'", "''");
  return `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';
    $profilePath='${literal}';
    $profileLeaf=[IO.Path]::GetFileName($profilePath);
    if ($profileLeaf -notmatch '^[A-Za-z0-9._-]+$') { throw 'Unsafe owned profile name' };
    $ownedFilter="(Name = 'chrome.exe' OR Name = 'msedge.exe') AND CommandLine LIKE '%" + $profileLeaf + "%'";
    $escapedProfile=[regex]::Escape($profilePath);
    $profilePattern='(?:^|\\s)"?--user-data-dir=(?:' + $escapedProfile + '|"' + $escapedProfile + '")"?(?=\\s|$)';
    function Get-OwnedProfileProcesses {
      Get-CimInstance Win32_Process -Filter $ownedFilter |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $profilePattern };
    };
    ${body}`;
}

// Asynchronous spawn keeps Vite/CDP/socket shutdown serviced while CIM runs.
export function runProfileCommand(command, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-OutputFormat',
        'Text',
        '-EncodedCommand',
        Buffer.from(command, 'utf16le').toString('base64'),
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), ...result });
    };
    const deadline = setTimeout(() => {
      // Only this spawned PowerShell child is stopped by the helper deadline.
      child.kill();
      child.stdout.destroy();
      child.stderr.destroy();
      finish({ status: null, error: `PowerShell helper timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout = (stdout + chunk).slice(-16_384);
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-16_384);
    });
    child.once('error', (error) => finish({ status: null, error: error.message }));
    child.once('close', (status, signal) => finish({ status, signal }));
  });
}
