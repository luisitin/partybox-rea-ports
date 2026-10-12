import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const folder = resolve('jobs/P23-bonk-io/tools');
const id = process.argv[2];
if (!/^\d+$/.test(id ?? '')) throw new Error('Pass a completed Actions run id');
const execute = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 12 * 1024 * 1024 });
const run = JSON.parse(
  execute('gh', ['run', 'view', id, '--json', 'conclusion,status,headSha,url,createdAt,updatedAt']),
);
if (run.status !== 'completed' || run.conclusion !== 'success') throw new Error('CI is not green');
const raw = execute('gh', ['run', 'view', id, '--log']);
const log = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/\^\[\[[0-9;]*m/g, '');
const tests = log.match(/Tests\s+(\d+) passed\s*\((\d+)\)/);
const files = log.match(/Test Files\s+(\d+) passed\s*\((\d+)\)/);
const duration = log.match(/Duration\s+([\d.]+)s/);
if (
  !tests ||
  tests[1] !== tests[2] ||
  !files ||
  files[1] !== files[2] ||
  !duration ||
  !log.includes('Run pnpm vitest run games/bonk-io --maxWorkers=1')
)
  throw new Error('Passing scoped summary missing');
const metrics = {};
let property;
for (const line of log.split(/\r?\n/)) {
  const batch = line.match(/P23 SIM n=([2-8]): (\{.*\})/);
  if (batch) metrics[batch[1]] = JSON.parse(batch[2]);
  const trace = line.match(/P23 PROPERTY: (\{.*\})/);
  if (trace) property = JSON.parse(trace[1]);
}
for (const n of [2, 3, 4, 5, 6, 7, 8])
  if (
    metrics[n]?.games !== 1000 ||
    metrics[n]?.maxMatchMs > 480000 ||
    metrics[n]?.botDecisionMs !== 200 ||
    // Historical R1/R2 reports predate the separately recorded snapshot cadence.
    (metrics[n]?.minAliveY !== undefined && !Number.isFinite(metrics[n]?.minAliveY)) ||
    (metrics[n]?.snapshotMs !== undefined &&
      (metrics[n]?.snapshotMs !== 80 ||
        JSON.stringify(metrics[n]?.botDecisionSpacingMs) !== '[160,240]'))
  )
    throw new Error(`Incomplete ${n}-player metrics`);
if (property?.traces !== 1003) throw new Error('Property evidence missing');
const digest = (source) => createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
const sources = execute('git', ['ls-files', 'games/bonk-io'])
  .trim()
  .split(/\r?\n/)
  .map((file) => {
    const tested = digest(execute('git', ['show', `${run.headSha}:${file}`]));
    const local = digest(readFileSync(resolve(file), 'utf8'));
    return {
      file,
      testedSha256Lf: tested,
      currentSha256Lf: local,
      matchesTestedHead: tested === local,
    };
  });
const result = {
  recordedAtUtc: new Date().toISOString(),
  ...run,
  command: 'pnpm vitest run games/bonk-io --maxWorkers=1',
  tests: Number(tests[1]),
  files: Number(files[1]),
  durationSeconds: Number(duration[1]),
  botMatches: 7000,
  metrics,
  property,
  sources,
  allGameFilesMatchTestedHead: sources.every((s) => s.matchesTestedHead),
};
writeFileSync(resolve(folder, 'latest-scoped-ci.json'), JSON.stringify(result, null, 2) + '\n');
writeFileSync(resolve(folder, 'latest-scoped-ci.log'), raw);
console.log(
  `${result.tests} tests passed; 7000 matches; 1003 traces; hashes match: ${result.allGameFilesMatchTestedHead}`,
);
