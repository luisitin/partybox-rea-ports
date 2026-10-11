// Real source mutations. Run only after the unmodified game is green, with no concurrent editor.
// pnpm tsx jobs/P20-fruit-slice/mutate.ts > jobs/P20-fruit-slice/mutation-report.json
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Mutation {
  id: string;
  label: string;
  file: string;
  before: string;
  after: string;
  witness: string;
}
interface Assertion {
  title: string;
  fullName?: string;
  status: string;
}
interface VitestReport {
  success: boolean;
  numTotalTests: number;
  numFailedTests: number;
  testResults: Array<{ assertionResults: Assertion[] }>;
}
interface ProbeResult {
  exitCode: number | null;
  timedOut: boolean;
  elapsedMs: number;
  report: VitestReport | null;
  diagnostic: string;
}

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const probe = 'games/fruit-slice/__tests__/mutation.test.ts';
const server = 'games/fruit-slice/server/';
const mutations: Mutation[] = [
  {
    id: 'M01',
    label: 'base fruit score inflated',
    file: 'scoring.ts',
    before: 'count * 10',
    after: 'count * 11',
    witness: 'single fruit base points',
  },
  {
    id: 'M02',
    label: 'two fruit incorrectly qualifies as a combo',
    file: 'scoring.ts',
    before: 'count >= 3',
    after: 'count >= 2',
    witness: 'two fruit is not a combo',
  },
  {
    id: 'M03',
    label: 'combo multiplier removed',
    file: 'scoring.ts',
    before: '(count >= 3 ? 2 : 1)',
    after: '(count >= 3 ? 1 : 1)',
    witness: 'three fruit combo doubles',
  },
  {
    id: 'M04',
    label: 'streak bonus cap removed',
    file: 'scoring.ts',
    before: 'Math.min(5, streak)',
    after: 'Math.min(50, streak)',
    witness: 'streak bonus is capped',
  },
  {
    id: 'M05',
    label: 'bomb swipe earns fruit points',
    file: 'phases/play.ts',
    before: 'bombed || count === 0',
    after: 'count === 0',
    witness: 'bomb gives zero points',
  },
  {
    id: 'M06',
    label: 'bomb preserves the streak',
    file: 'phases/play.ts',
    before: 'streak: bombed ? 0 : seat.streak',
    after: 'streak: bombed ? seat.streak : seat.streak',
    witness: 'bomb resets streak',
  },
  {
    id: 'M07',
    label: 'bomb no longer locks its wave',
    file: 'phases/play.ts',
    before: 'seat.bombed\n  )',
    after: 'false\n  )',
    witness: 'bomb locks the rest of its wave',
  },
  {
    id: 'M08',
    label: 'duplicate swipe sequence accepted',
    file: 'phases/play.ts',
    before: 'input.seq <= seat.lastSeq',
    after: 'input.seq < seat.lastSeq',
    witness: 'duplicate sequence cannot score',
  },
  {
    id: 'M09',
    label: 'cut fruit can be scored again',
    file: 'phases/play.ts',
    before: '!seat.cut.includes(f.id) && crosses(input.points, f)',
    after: 'crosses(input.points, f)',
    witness: 'cut fruit cannot score twice',
  },
  {
    id: 'M10',
    label: 'twenty-first stroke accepted',
    file: 'phases/play.ts',
    before: 'seat.strokes >= 20',
    after: 'seat.strokes > 20',
    witness: 'strokes are capped at twenty per wave',
  },
  {
    id: 'M11',
    label: 'stale wave accepted',
    file: 'phases/play.ts',
    before: 'input.wave !== settled.wave',
    after: 'false',
    witness: 'stale wave cannot score',
  },
  {
    id: 'M12',
    label: 'future gesture frame accepted',
    file: 'phases/play.ts',
    before: 'input.frame > settled.checked',
    after: 'false',
    witness: 'future frame cannot score',
  },
  {
    id: 'M13',
    label: 'disconnected player can score',
    file: 'phases/play.ts',
    before: '!state.players[event.playerId]?.connected',
    after: 'false',
    witness: 'disconnected player cannot score',
  },
  {
    id: 'M14',
    label: 'round deadline cannot leave play',
    file: 'phases/play.ts',
    before: 'if (now >= settled.endsAt) return next(settled, now);',
    after: 'if (false) return next(settled, now);',
    witness: 'round deadline exits play',
  },
  {
    id: 'M15',
    label: 'score deadline cannot leave leaderboard',
    file: 'phases/score.ts',
    before: 'return isTimerFor(state, event) ? next(state, event.now) : state;',
    after: 'return state;',
    witness: 'scores deadline exits to done',
  },
  {
    id: 'M16',
    label: 'TV exposes raw personal cut history',
    file: 'index.ts',
    before: '...envelope(state, manifest.id, { statusOf: statusOf(state) }),',
    after:
      '...envelope(state, manifest.id, { statusOf: statusOf(state) }),\n    seats: state.seats,',
    witness: 'TV hides raw cut history',
  },
  {
    id: 'M17',
    label: 'own phone retains already sliced fruit',
    file: 'index.ts',
    before: '!seat.cut.includes(f.id)',
    after: 'true',
    witness: 'own controller removes sliced fruit',
  },
  {
    id: 'M18',
    label: 'every missed segment counts as a hit',
    file: 'world.ts',
    before: 'return false;',
    after: 'return true;',
    witness: 'distant segment misses fruit',
  },
  {
    id: 'M19',
    label: 'resume fails to extend round clock',
    file: 'index.ts',
    before: 'endsAt: state.endsAt + ms',
    after: 'endsAt: state.endsAt',
    witness: 'resume extends the round clock',
  },
  {
    id: 'M20',
    label: 'bot acts for disconnected player',
    file: 'bot.ts',
    before: '!state.players[id]?.connected',
    after: 'false',
    witness: 'bot rejects disconnected player',
  },
];

const originals = new Map<string, string>();
let activeFile: string | null = null;
let activeChild: ChildProcess | null = null;
let interrupted = false;
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const restore = (): void => {
  if (!activeFile) return;
  const original = originals.get(activeFile);
  if (original === undefined) throw new Error(`Missing original for ${activeFile}`);
  writeFileSync(activeFile, original, 'utf8');
  if (readFileSync(activeFile, 'utf8') !== original)
    throw new Error(`Restore failed: ${activeFile}`);
  activeFile = null;
};
function stopChild(): void {
  if (!activeChild?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(activeChild.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    activeChild.kill('SIGTERM');
  }
}
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
  ['SIGHUP', 129],
] as const) {
  process.once(signal, () => {
    interrupted = true;
    stopChild();
    restore();
    process.stderr.write(`Mutation run interrupted by ${signal}; active source restored.\n`);
    process.exit(code);
  });
}
process.once('exit', restore);

async function runProbe(reportPath: string): Promise<ProbeResult> {
  const started = performance.now();
  const args = [
    'vitest',
    'run',
    probe,
    '--maxWorkers=1',
    '--reporter=json',
    `--outputFile=${reportPath}`,
  ];
  const windows = process.platform === 'win32';
  // cmd is used only to launch the installed pnpm shim; all file writes use node:fs.
  const executable = windows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
  const commandArgs = windows
    ? [
        '/d',
        '/s',
        '/c',
        `pnpm vitest run ${probe} --maxWorkers=1 --reporter=json --outputFile="${reportPath}"`,
      ]
    : args;
  let diagnostic = '';
  let timedOut = false;
  const exitCode = await new Promise<number | null>((resolveExit, reject) => {
    const child = spawn(executable, commandArgs, {
      cwd: repo,
      windowsHide: true,
      env: { ...process.env, CI: '1' },
    });
    activeChild = child;
    const capture = (chunk: Buffer): void => {
      diagnostic = (diagnostic + chunk.toString()).slice(-6000);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    const timeout = setTimeout(() => {
      timedOut = true;
      stopChild();
    }, 60_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      activeChild = null;
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      activeChild = null;
      resolveExit(code);
    });
  });
  let report: VitestReport | null = null;
  if (existsSync(reportPath)) {
    try {
      report = JSON.parse(readFileSync(reportPath, 'utf8')) as VitestReport;
    } catch {
      /* An incomplete report is not a killed mutant. */
    }
  }
  return {
    exitCode,
    timedOut,
    elapsedMs: Math.round(performance.now() - started),
    report,
    diagnostic,
  };
}

const started = performance.now();
const completed: Array<Record<string, unknown>> = [];
let baseline: ProbeResult | null = null;
let backupDirectory = '';
let error = '';
try {
  if (!existsSync(join(repo, probe))) throw new Error(`Mutation witness file missing: ${probe}`);
  for (const mutation of mutations) {
    const path = join(repo, server, mutation.file);
    const original = originals.get(path) ?? readFileSync(path, 'utf8');
    originals.set(path, original);
    const matches = original.split(mutation.before).length - 1;
    if (matches !== 1)
      throw new Error(
        `${mutation.id} requires exactly one source match; found ${matches}: ${mutation.before}`,
      );
  }
  backupDirectory = mkdtempSync(join(tmpdir(), 'r19-fruit-mutations-'));
  const recovery: Record<string, { backup: string; sha256: string }> = {};
  for (const [path, original] of originals) {
    const backup = join(backupDirectory, path.slice(repo.length + 1));
    mkdirSync(dirname(backup), { recursive: true });
    writeFileSync(backup, original, 'utf8');
    recovery[path] = { backup, sha256: sha256(original) };
  }
  writeFileSync(join(backupDirectory, 'recovery.json'), JSON.stringify(recovery, null, 2), 'utf8');
  process.stderr.write(`Original-source recovery copies: ${backupDirectory}\n`);
  baseline = await runProbe(join(backupDirectory, 'baseline.json'));
  if (baseline.exitCode !== 0 || !baseline.report?.success || baseline.report.numTotalTests < 20)
    throw new Error(
      `Unmodified mutation witnesses must pass before planting bugs: ${baseline.diagnostic}`,
    );
  const witnesses = baseline.report.testResults.flatMap((test) =>
    test.assertionResults.map((assertion) => assertion.title),
  );
  for (const mutation of mutations) {
    if (!witnesses.includes(`mutation: ${mutation.witness}`))
      throw new Error(`${mutation.id} missing named witness: ${mutation.witness}`);
  }
  for (const mutation of mutations) {
    if (interrupted) break;
    for (const [path, original] of originals) {
      if (readFileSync(path, 'utf8') !== original)
        throw new Error(`Concurrent source edit detected; refusing mutation: ${path}`);
    }
    const path = join(repo, server, mutation.file);
    const original = originals.get(path)!;
    activeFile = path;
    writeFileSync(path, original.replace(mutation.before, mutation.after), 'utf8');
    let result: ProbeResult;
    try {
      result = await runProbe(join(backupDirectory, `${mutation.id}.json`));
    } finally {
      restore();
    }
    const failed =
      result.report?.testResults.flatMap((test) =>
        test.assertionResults.filter((assertion) => assertion.status === 'failed'),
      ) ?? [];
    const validFailure = result.exitCode !== 0 && !result.timedOut && failed.length > 0;
    const status = validFailure
      ? 'killed'
      : result.exitCode === 0 && result.report?.success
        ? 'survived'
        : 'invalid';
    completed.push({
      id: mutation.id,
      label: mutation.label,
      file: server + mutation.file,
      before: mutation.before,
      after: mutation.after,
      expectedWitness: `mutation: ${mutation.witness}`,
      status,
      witnessFailed: failed.some(
        (assertion) => assertion.title === `mutation: ${mutation.witness}`,
      ),
      failedTests: failed.map((assertion) => assertion.fullName ?? assertion.title),
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      elapsedMs: result.elapsedMs,
      originalSha256: sha256(original),
      restoredSha256: sha256(readFileSync(path, 'utf8')),
      ...(status === 'invalid' ? { diagnostic: result.diagnostic } : {}),
    });
    process.stderr.write(`${mutation.id} ${status}: ${mutation.label}\n`);
  }
} catch (caught) {
  error = caught instanceof Error ? caught.message : String(caught);
} finally {
  restore();
}
const restored = [...originals].every(
  ([path, original]) => readFileSync(path, 'utf8') === original,
);
const killed = completed.filter((mutation) => mutation.status === 'killed').length;
const reportText =
  JSON.stringify(
    {
      game: 'fruit-slice',
      command: `pnpm vitest run ${probe} --maxWorkers=1 --reporter=json`,
      baseline: baseline
        ? {
            exitCode: baseline.exitCode,
            tests: baseline.report?.numTotalTests ?? 0,
            elapsedMs: baseline.elapsedMs,
          }
        : null,
      mutations: completed,
      planned: mutations.length,
      killed,
      survived: completed.filter((mutation) => mutation.status === 'survived').length,
      invalid: completed.filter((mutation) => mutation.status === 'invalid').length,
      elapsedMs: Math.round(performance.now() - started),
      restored,
      backupDirectory,
      error: error || null,
    },
    null,
    2,
  ) + '\n';
const outAt = process.argv.indexOf('--out');
if (outAt >= 0) {
  const path = process.argv[outAt + 1];
  if (!path) throw new Error('--out needs a report path');
  writeFileSync(path, reportText, 'utf8');
} else process.stdout.write(reportText);
process.exitCode = error || !restored || completed.length !== 20 || killed < 19 ? 1 : 0;
