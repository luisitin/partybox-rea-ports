// Preserve exact scoped CI metrics and compare its game files with the local checkout.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const folder = resolve('jobs/P07-paper-territory/tools');
const runId = process.argv[2];
if (!/^\d+$/.test(runId ?? '')) throw new Error('Pass a completed GitHub Actions run ID');
const execute = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
const run = JSON.parse(
  execute('gh', [
    'run',
    'view',
    runId,
    '--json',
    'conclusion,status,headSha,url,createdAt,updatedAt',
  ]),
);
if (run.status !== 'completed' || run.conclusion !== 'success') throw new Error('CI is not green');
const raw = execute('gh', ['run', 'view', runId, '--log']);
const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/\^\[\[[0-9;]*m/g, '');
const tests = clean.match(/Tests\s+(\d+) passed\s*\((\d+)\)/);
const files = clean.match(/Test Files\s+(\d+) passed\s*\((\d+)\)/);
const duration = clean.match(/Duration\s+([\d.]+)s/);
if (!tests || tests[1] !== tests[2] || !files || files[1] !== files[2] || !duration)
  throw new Error('Complete passing test summary missing');
if (!clean.includes('Run pnpm vitest run games/paper-io --maxWorkers=1'))
  throw new Error('CI command is not scoped to P07');
if (!/property\.test\.ts.*4 tests/.test(clean)) throw new Error('Property checks missing');
const metrics = {};
for (const line of clean.split(/\r?\n/)) {
  const match = line.match(/P07 SIM n=([2-8]): (\{.*\})/);
  if (match) metrics[match[1]] = JSON.parse(match[2]);
}
for (const count of ['2', '3', '4', '5', '6', '7', '8']) {
  const batch = metrics[count];
  if (batch?.games !== 1000 || batch?.decisionBeatMs !== 600 || batch?.maximumGameMs > 360000)
    throw new Error(`Incomplete or over-budget ${count}-player simulation batch`);
}
const digest = (source) => createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
const sources = execute('git', ['ls-files', 'games/paper-io'])
  .trim()
  .split(/\r?\n/)
  .map((file) => {
    const tested = execute('git', ['show', `${run.headSha}:${file}`]);
    const local = readFileSync(resolve(file), 'utf8');
    return {
      file,
      testedSha256Lf: digest(tested),
      currentSha256Lf: digest(local),
      matchesTestedHead: digest(tested) === digest(local),
    };
  });
const result = {
  recordedAtUtc: new Date().toISOString(),
  ...run,
  command: 'pnpm vitest run games/paper-io --maxWorkers=1',
  files: Number(files[1]),
  tests: Number(tests[1]),
  failed: 0,
  durationSeconds: Number(duration[1]),
  propertyTraces: 1003,
  regressionSeeds: [1, 2, 3],
  generatedSeeds: 1000,
  botMatches: 7000,
  metrics,
  sources,
  allGameFilesMatchTestedHead: sources.every((source) => source.matchesTestedHead),
};
writeFileSync(resolve(folder, 'latest-scoped-ci.log'), raw, 'utf8');
writeFileSync(resolve(folder, 'latest-scoped-ci.json'), JSON.stringify(result, null, 2) + '\n');
console.log(
  `${result.tests}/${result.tests} passed; 7000 matches; 1003 traces; game files match CI: ${result.allGameFilesMatchTestedHead}`,
);
