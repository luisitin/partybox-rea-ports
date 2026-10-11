// Plants real source bugs one at a time, executes only this game's rule tests,
// and restores all original bytes even if a runner is interrupted or fails.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const world = 'games/pong-party/server/world.ts';
const scoring = 'games/pong-party/server/scoring.ts';
const mutations = [
  {
    id: 1,
    name: 'only four initial lives',
    file: world,
    from: 'INITIAL_LIVES = 5',
    to: 'INITIAL_LIVES = 4',
  },
  {
    id: 2,
    name: 'oversized paddles hide legal misses',
    file: world,
    from: 'PADDLE_HALF = 5.8',
    to: 'PADDLE_HALF = 10',
  },
  {
    id: 3,
    name: 'collision ignores ball radius',
    file: world,
    from: 'BALL_RADIUS = 0.85',
    to: 'BALL_RADIUS = 0',
  },
  {
    id: 4,
    name: 'round lasts ninety seconds',
    file: world,
    from: 'ROUND_MS = 60_000',
    to: 'ROUND_MS = 90_000',
  },
  {
    id: 5,
    name: 'second ball arrives too late',
    file: world,
    from: 'SPAWN_EVERY_MS = 15_000',
    to: 'SPAWN_EVERY_MS = 30_000',
  },
  {
    id: 6,
    name: 'a fifth ball may spawn',
    file: world,
    from: 'MAX_BALLS = 4',
    to: 'MAX_BALLS = 5',
  },
  {
    id: 7,
    name: 'missing serve has no grace period',
    file: world,
    from: 'RESPAWN_MS = 700',
    to: 'RESPAWN_MS = 0',
  },
  {
    id: 8,
    name: 'opening ball moves too slowly',
    file: world,
    from: 'SPEED = 26',
    to: 'SPEED = 18',
  },
  {
    id: 9,
    name: 'save bonus can beat another life',
    file: world,
    from: 'SAVES_CAP = 999',
    to: 'SAVES_CAP = 1001',
  },
  {
    id: 10,
    name: 'two players get neighboring sides',
    file: world,
    from: 'Math.floor((index * 8) / seats.length)',
    to: 'index',
  },
  {
    id: 11,
    name: 'a miss removes two lives',
    file: world,
    from: 'seat.lives - 1',
    to: 'seat.lives - 2',
  },
  {
    id: 12,
    name: 'a hit grants two saves',
    file: world,
    from: 'seat.saves + 1',
    to: 'seat.saves + 2',
  },
  {
    id: 13,
    name: 'future serves move before release',
    file: world,
    from: 'ball.readyAt >= to',
    to: 'ball.readyAt < to',
  },
  {
    id: 14,
    name: 'wall reflection points outside',
    file: world,
    from: 'ball.vx - 2 * dot * edge.nx',
    to: 'ball.vx + 2 * dot * edge.nx',
  },
  {
    id: 15,
    name: 'elimination does not record its time',
    file: world,
    from: 'seat.eliminatedAt = to',
    to: 'seat.eliminatedAt = null',
  },
  {
    id: 16,
    name: 'one survivor fails to end the match',
    file: world,
    from: 'aliveCount(world) <= 1',
    to: 'aliveCount(world) < 1',
  },
  {
    id: 17,
    name: 'lives have too little score weight',
    file: scoring,
    from: 'paddle.lives * 1000',
    to: 'paddle.lives * 100',
  },
  {
    id: 18,
    name: 'done never produces results',
    file: scoring,
    from: "state.phase.id === 'done'",
    to: "state.phase.id === 'impossible'",
  },
  {
    id: 19,
    name: 'score deadline never exits',
    file: 'games/pong-party/server/phases/score.ts',
    from: '? next(state, event.now)',
    to: '? state',
  },
  {
    id: 20,
    name: 'views expose future serve directions',
    file: 'games/pong-party/server/index.ts',
    from: 'stepped: state.world.stepped,',
    to: 'stepped: state.world.stepped, spawnAngles: state.world.spawnAngles,',
  },
];
const files = [...new Set(mutations.map((mutation) => mutation.file))];
const originals = new Map(files.map((file) => [file, readFileSync(resolve(root, file), 'utf8')]));
const directory = resolve(root, 'jobs/P21-pong-party');
mkdirSync(directory, { recursive: true });
const report = [];
const args = ['vitest', 'run', 'games/pong-party', '--maxWorkers=1', '-t', 'mut:'];
function run() {
  return process.platform === 'win32'
    ? spawnSync(
        process.env.ComSpec ?? 'cmd.exe',
        ['/d', '/s', '/c', 'pnpm.cmd vitest run games/pong-party --maxWorkers=1 -t mut:'],
        { cwd: root, encoding: 'utf8', timeout: 120_000, windowsHide: true },
      )
    : spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', timeout: 120_000 });
}
try {
  const baseline = run();
  if (baseline.status !== 0)
    throw new Error(`baseline rule tests failed:\n${baseline.stdout}\n${baseline.stderr}`);
  for (const mutation of mutations) {
    const original = originals.get(mutation.file);
    if (!original || original.split(mutation.from).length !== 2)
      throw new Error(`mutation ${mutation.id} anchor is not unique: ${mutation.from}`);
    try {
      writeFileSync(
        resolve(root, mutation.file),
        original.replace(mutation.from, mutation.to),
        'utf8',
      );
      const result = run();
      const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
      const failedTests = [...log.matchAll(/FAIL\s+games\/pong-party\/[^\n]+/g)].map((match) =>
        match[0].replace(/\u001b\[[\d;]*m/g, ''),
      );
      const caught = result.status !== 0 && !result.error && /(?:failed|FAIL)/i.test(log);
      report.push({
        id: mutation.id,
        bug: mutation.name,
        file: mutation.file,
        caught,
        exitCode: result.status,
        failedTests,
      });
      console.log(`${mutation.id}/20 ${caught ? 'CAUGHT' : 'SURVIVED'} ${mutation.name}`);
      if (!caught)
        writeFileSync(resolve(directory, `mutation-${mutation.id}-survived.log`), log, 'utf8');
    } finally {
      writeFileSync(resolve(root, mutation.file), original, 'utf8');
    }
  }
} finally {
  for (const [file, original] of originals) writeFileSync(resolve(root, file), original, 'utf8');
  const summary = {
    command: 'pnpm.cmd vitest run games/pong-party --maxWorkers=1 -t mut:',
    planted: report.length,
    caught: report.filter((item) => item.caught).length,
    required: 19,
    restored: true,
    bugs: report,
  };
  writeFileSync(
    resolve(directory, 'mutation.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
}
if (report.length !== 20 || report.filter((item) => item.caught).length < 19) process.exitCode = 1;
