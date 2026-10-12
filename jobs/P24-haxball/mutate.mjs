// P24 only: run after root's ordinary checks and while no one is editing server files.
// node jobs/P24-haxball/mutate.mjs
// Each valid semantic mutation runs only the game's focused rule tests, one worker.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const job = dirname(fileURLToPath(import.meta.url));
const repo = resolve(job, '../..');
const media = join(job, 'media');
const workReport = join(media, 'mutation-work.json');
const vitest = join(repo, 'node_modules/vitest/vitest.mjs');
const target = 'games/haxball/__tests__/game.test.ts';
const world = 'games/haxball/server/world.ts';
const play = 'games/haxball/server/phases/play.ts';
const index = 'games/haxball/server/index.ts';
const goal = 'games/haxball/server/phases/goal.ts';
const mutations = [
  {
    id: 1,
    label: 'Credit the wrong attacking team',
    file: world,
    pattern:
      /const\s+redScores\s*=\s*\(side\s*===\s*['"]right['"]\)\s*===\s*state\.redAttacksRight\s*;/,
    replacement: "const redScores = (side === 'left') === state.redAttacksRight;",
  },
  {
    id: 2,
    label: 'Count crossing before the whole ball clears the goal',
    file: world,
    pattern: /after\.x\s*>\s*W\s*\+\s*BALL_R/,
    replacement: 'after.x > W',
  },
  {
    id: 3,
    label: 'Score outside the mouth',
    file: world,
    pattern:
      /if\s*\(Math\.abs\(y\s*-\s*H\s*\/\s*2\)\s*>\s*GOAL_HALF\s*-\s*BALL_R\)\s*return\s+null\s*;/,
    replacement: 'if (false) return null;',
  },
  {
    id: 4,
    label: 'Judge goal from final y rather than crossing y',
    file: world,
    pattern: /const\s+y\s*=\s*before\.y\s*\+\s*\(after\.y\s*-\s*before\.y\)\s*\*\s*fraction\s*;/,
    replacement: 'const y = after.y;',
  },
  {
    id: 5,
    label: 'Reverse own-goal attribution',
    file: world,
    pattern: /toucher\.team\s*!==\s*team/,
    replacement: 'toucher.team === team',
  },
  {
    id: 6,
    label: 'Award two goals for one crossing',
    file: goal,
    pattern: /state\.goals\[goal\.team\]\s*\+\s*1/,
    replacement: 'state.goals[goal.team] + 2',
  },
  {
    id: 7,
    label: 'Leave the scored puck in the net after reset',
    file: world,
    pattern: /ball:\s*centerBall\(\)/,
    replacement: 'ball: { ...state.ball }',
  },
  {
    id: 8,
    label: 'Never expire held controls',
    file: world,
    pattern: /if\s*\(intent\.until\s*<=\s*at\)/,
    replacement: 'if (false)',
  },
  {
    id: 9,
    label: 'Give diagonal movement extra acceleration',
    file: world,
    pattern: /const\s+length\s*=\s*Math\.hypot\(intent\.dx,\s*intent\.dy\)\s*\|\|\s*1\s*;/,
    replacement: 'const length = 1;',
  },
  {
    id: 10,
    label: 'Allow kicking a distant ball',
    file: world,
    pattern: /distance\s*>\s*KICK_RANGE/,
    replacement: 'distance > 1_000_000',
  },
  {
    id: 11,
    label: 'Keep a successful held kick armed',
    file: world,
    pattern: /kickArmed:\s*false,\s*kickReadyAt:\s*at/,
    replacement: 'kickArmed: true, kickReadyAt: at',
  },
  {
    id: 12,
    label: 'Remove the kick recovery interval',
    file: world,
    pattern: /kickReadyAt:\s*at\s*\+\s*KICK_COOLDOWN_MS/,
    replacement: 'kickReadyAt: at',
  },
  {
    id: 13,
    label: 'Accept a duplicate sequence in applyControl',
    file: world,
    pattern: /input\.seq\s*<=\s*before\.seq/,
    replacement: 'input.seq < before.seq',
  },
  {
    id: 14,
    label: 'Let an old-instance input advance live physics',
    file: play,
    pattern: /event\.input\.phaseAt\s*!==\s*state\.phase\.startedAt/,
    replacement: 'false',
  },
  {
    id: 15,
    label: 'Accept controls from disconnected players',
    file: play,
    pattern: /!state\.players\[event\.playerId\]\?\.connected/,
    replacement: 'false',
  },
  {
    id: 16,
    label: 'Let a permanent leaver drive after reconnect',
    file: play,
    pattern: /state\.left\.includes\(event\.playerId\)/,
    replacement: 'false',
  },
  {
    id: 17,
    label: 'Never swap goals at halftime',
    file: index,
    pattern: /redAttacksRight:\s*!state\.redAttacksRight/,
    replacement: 'redAttacksRight: state.redAttacksRight',
  },
  {
    id: 18,
    label: 'Double the second-half clock',
    file: index,
    pattern: /halfEndsAt:\s*now\s*\+\s*state\.halfSeconds\s*\*\s*1000/,
    replacement: 'halfEndsAt: now + state.halfSeconds * 2000',
  },
  {
    id: 19,
    label: 'Start delayed goal reset at receipt time',
    file: play,
    pattern: /goal\(settled\.state,\s*settled\.goal,\s*settled\.state\.simAt\)/,
    replacement: 'goal(settled.state, settled.goal, now)',
  },
  {
    id: 20,
    label: 'Leak every player’s intent in the public match view',
    file: index,
    pattern: /function\s+common\(state:\s*State\):\s*MatchView\s*\{\s*return\s*\{/,
    replacement: (match) => `${match} intents: state.intents,`,
  },
];

const files = [...new Set(mutations.map((mutation) => mutation.file))];
const originals = new Map(files.map((file) => [file, readFileSync(join(repo, file), 'utf8')]));
const hashes = Object.fromEntries(
  files.map((file) => [file, createHash('sha256').update(originals.get(file)).digest('hex')]),
);
const reports = [];
mkdirSync(media, { recursive: true });

function test() {
  if (existsSync(workReport)) unlinkSync(workReport);
  const args = [
    vitest,
    'run',
    target,
    '--maxWorkers=1',
    '--no-file-parallelism',
    '--reporter=json',
    '--outputFile',
    workReport,
  ];
  const child = spawnSync(process.execPath, args, {
    cwd: repo,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PB_WRITE_EVIDENCE: '0' },
  });
  let report;
  if (existsSync(workReport)) report = JSON.parse(readFileSync(workReport, 'utf8'));
  const cases = report?.testResults?.flatMap((suite) => suite.assertionResults ?? []) ?? [];
  const failed = cases.filter((entry) => entry.status === 'failed');
  return {
    exit: child.status,
    error: child.error?.message ?? null,
    total: report?.numTotalTests ?? 0,
    failed: failed.map((entry) => ({
      name: entry.fullName ?? entry.title,
      message: String(entry.failureMessages?.[0] ?? '').slice(0, 1200),
    })),
    stderr: String(child.stderr ?? '').slice(-1500),
  };
}

let baseline;
let successful = false;
try {
  baseline = test();
  if (baseline.exit !== 0 || baseline.failed.length > 0 || baseline.total < 20)
    throw new Error(`Focused baseline is not green: ${JSON.stringify(baseline)}`);
  for (const mutation of mutations) {
    const original = originals.get(mutation.file);
    const occurrences = [...original.matchAll(new RegExp(mutation.pattern.source, 'g'))];
    if (occurrences.length !== 1)
      throw new Error(
        `Mutation ${mutation.id} needs exactly one formatted anchor; found ${occurrences.length}`,
      );
    const changed = original.replace(mutation.pattern, mutation.replacement);
    if (changed === original) throw new Error(`Mutation ${mutation.id} made no change`);
    let result;
    try {
      writeFileSync(join(repo, mutation.file), changed, 'utf8');
      result = test();
    } finally {
      writeFileSync(join(repo, mutation.file), original, 'utf8');
    }
    // Import/transform errors have no complete assertion list and are never kills.
    const valid = result.total === baseline.total && !result.error;
    const killed = valid && result.exit !== 0 && result.failed.length > 0;
    const status = !valid ? 'invalid' : killed ? 'killed' : 'survived';
    reports.push({
      id: mutation.id,
      label: mutation.label,
      file: mutation.file,
      status,
      ...result,
    });
    process.stdout.write(`${mutation.id}/20 ${status}: ${mutation.label}\n`);
  }
  const killed = reports.filter((report) => report.status === 'killed').length;
  const invalid = reports.filter((report) => report.status === 'invalid').length;
  successful = killed >= 19 && invalid === 0;
} finally {
  for (const [file, original] of originals) writeFileSync(join(repo, file), original, 'utf8');
  if (existsSync(workReport)) unlinkSync(workReport);
  const restored = files.every(
    (file) => readFileSync(join(repo, file), 'utf8') === originals.get(file),
  );
  writeFileSync(
    join(media, 'mutations.json'),
    `${JSON.stringify(
      {
        command: `${process.execPath} ${vitest} run ${target} --maxWorkers=1 --no-file-parallelism --reporter=json`,
        target,
        baseline,
        sourceSha256: hashes,
        requiredKilled: 19,
        totalMutations: 20,
        killed: reports.filter((report) => report.status === 'killed').length,
        survived: reports.filter((report) => report.status === 'survived').length,
        invalid: reports.filter((report) => report.status === 'invalid').length,
        originalsRestored: restored,
        reports,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  if (!restored) throw new Error('Mutation originals were not restored');
}
if (!successful) process.exitCode = 1;
