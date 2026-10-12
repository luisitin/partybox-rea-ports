// Root's one-command wrapper: fresh preview, one capture browser, both closed in finally.
// The helper's owner token travels only through an internal pipe/environment, never a report.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url)),
  root = resolve(directory, '../..');
const previewFile = join(directory, 'preview.mjs'),
  captureFile = join(directory, 'transient-r1.mjs');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exited = (child) => child.exitCode !== null || child.signalCode !== null;
let helper, ready, capture, error;
const report = { root, helperPid: null, helperClosed: false, captureExitCode: null };
try {
  helper = spawn(process.execPath, [previewFile], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PB_PREVIEW_WRAPPED: '1' },
  });
  report.helperPid = helper.pid;
  ready = await new Promise((resolveReady, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error('Fresh preview startup timed out.')), 20000);
    helper.once('error', (failure) => {
      clearTimeout(timeout);
      reject(failure);
    });
    helper.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('Fresh preview exited before readiness.'));
    });
    helper.stdout.setEncoding('utf8');
    helper.stdout.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n'),
          line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        try {
          const message = JSON.parse(line);
          if (message.event !== 'preview-ready') continue;
          if (
            message.pid !== helper.pid ||
            resolve(message.root) !== root ||
            typeof message.token !== 'string'
          )
            throw new Error('Fresh preview identity mismatch.');
          clearTimeout(timeout);
          resolveReady(message);
        } catch (failure) {
          if (failure.message === 'Fresh preview identity mismatch.') {
            clearTimeout(timeout);
            reject(failure);
          }
        }
      }
    });
    // Error text may be useful; never forward the ready JSON or its owner token.
    helper.stderr.on('data', (chunk) => process.stderr.write(chunk));
  });
  console.log(`Owned P05 preview ready: pid=${helper.pid}, ordinary phone shell=83.6/0.`);
  capture = spawn(process.execPath, [captureFile], {
    cwd: root,
    windowsHide: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      PB_INTERACTIVE_BASE: ready.base,
      PB_PREVIEW_TOKEN: ready.token,
      PB_KEEP_PREVIEW: '1',
    },
  });
  report.captureExitCode = await new Promise((resolveExit, reject) => {
    capture.once('error', reject);
    capture.once('exit', (code) => resolveExit(code ?? 1));
  });
  if (report.captureExitCode !== 0)
    throw new Error(`P05 capture exited ${report.captureExitCode}.`);
} catch (failure) {
  error = failure;
} finally {
  if (helper) {
    if (ready && !exited(helper)) {
      try {
        await fetch(new URL('/__p05_preview/close', ready.base), {
          method: 'POST',
          headers: { 'x-p05-preview-token': ready.token },
          signal: AbortSignal.timeout(5000),
        });
      } catch {}
    }
    for (let i = 0; i < 30 && !exited(helper); i++) await sleep(100);
    if (!exited(helper)) {
      if (process.platform === 'win32') {
        const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
        const command = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${helper.pid}'; if($null -eq $p){exit 0}; if($p.ExecutablePath -ne ${quote(process.execPath)} -or $p.CommandLine.IndexOf(${quote(previewFile)},[StringComparison]::OrdinalIgnoreCase) -lt 0){exit 7}; & taskkill.exe /PID $p.ProcessId /T /F`;
        const closed = spawnSync(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', command],
          { windowsHide: true, stdio: 'ignore' },
        );
        if (closed.status !== 0)
          error ??= new Error('Owned helper PID/path check rejected termination.');
      } else helper.kill('SIGTERM');
      for (let i = 0; i < 30 && !exited(helper); i++) await sleep(100);
    }
    report.helperClosed = exited(helper);
    if (!report.helperClosed) error ??= new Error('Owned helper remains running.');
  }
  writeFileSync(join(directory, 'transient-owned.json'), JSON.stringify(report, null, 2) + '\n');
}
if (error) throw error;
