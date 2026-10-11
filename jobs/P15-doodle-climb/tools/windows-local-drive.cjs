// Vite 8 probes mapped drives with an unbounded `net use` on Windows. This checkout
// is on local C:, so a hung network lookup must not keep completed tests alive.
// Test tooling only: leave every command except that optional drive probe intact.
const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
if (process.platform === 'win32' && /^[A-Za-z]:[\\/]/.test(process.cwd())) {
  const exec = childProcess.exec;
  childProcess.exec = function (command, options, callback) {
    return exec.call(
      this,
      command === 'net use' ? 'cmd.exe /d /c exit 0' : command,
      options,
      callback,
    );
  };
  syncBuiltinESMExports();
}
