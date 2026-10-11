import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

interface Mutation {
  id: string;
  file: string;
  find: RegExp;
  replace: string;
}
const mutations: Mutation[] = [
  {
    id: '01-score-rounds-up',
    file: 'scoring.ts',
    find: /Math\.floor\(Math\.max\(0, c\.peak\)\)/,
    replace: 'Math.ceil(Math.max(0, c.peak))',
  },
  {
    id: '02-score-current-height',
    file: 'scoring.ts',
    find: /Math\.max\(0, c\.peak\)/,
    replace: 'Math.max(0, c.y)',
  },
  {
    id: '03-score-negative-height',
    file: 'scoring.ts',
    find: /Math\.max\(0, c\.peak\)/,
    replace: 'c.peak',
  },
  {
    id: '04-score-subtracts-round',
    file: 'scoring.ts',
    find: /\(state\.scores\[id\] \?\? 0\) \+ \(lastPoints\[id\] \?\? 0\)/,
    replace: '(state.scores[id] ?? 0) - (lastPoints[id] ?? 0)',
  },
  {
    id: '05-score-forgets-previous-round',
    file: 'scoring.ts',
    find: /\(state\.scores\[id\] \?\? 0\) \+ \(lastPoints\[id\] \?\? 0\)/,
    replace: '(lastPoints[id] ?? 0)',
  },
  {
    id: '06-reveal-does-not-credit',
    file: 'phases/score.ts',
    find: /enterPhase\(credit\(state\), 'score'/,
    replace: "enterPhase(state, 'score'",
  },
  {
    id: '07-reveal-timer-never-exits',
    file: 'phases/score.ts',
    find: /return isTimerFor\(state, event\) \? next\(state, event\.now\) : state;/,
    replace: 'return state;',
  },
  {
    id: '08-next-round-number-stuck',
    file: 'phases/ready.ts',
    find: /freshRound\(state, state\.round \+ 1\)/,
    replace: 'freshRound(state, state.round)',
  },
  {
    id: '09-round-clock-halved',
    file: 'phases/play.ts',
    find: /state\.settings\.seconds \* 1000/,
    replace: 'state.settings.seconds * 500',
  },
  {
    id: '10-paused-clock-not-shifted',
    file: 'index.ts',
    find: /began: state\.began \+ ms, endsAt: state\.endsAt \+ ms/,
    replace: 'began: state.began, endsAt: state.endsAt',
  },
  {
    id: '11-gravity-points-up',
    file: 'world.ts',
    find: /climber\.vy - GRAVITY \* dt/,
    replace: 'climber.vy + GRAVITY * dt',
  },
  {
    id: '12-steering-does-not-move',
    file: 'world.ts',
    find: /climber\.dir \* SPEED \* dt/,
    replace: '0 * climber.dir * SPEED * dt',
  },
  { id: '13-land-while-rising', file: 'world.ts', find: /if \(vy < 0\)/, replace: 'if (vy > 0)' },
  {
    id: '14-platform-collision-missing',
    file: 'world.ts',
    find: /return Math\.abs\(deltaX\(x, platform\.x\)\) <= platform\.width \/ 2 \+ 8;/,
    replace: 'return false;',
  },
  {
    id: '15-spring-normal-bounce',
    file: 'world.ts',
    find: /p\.kind === 'spring' \? SPRING : BOUNCE/,
    replace: "p.kind === 'spring' ? BOUNCE : BOUNCE",
  },
  {
    id: '16-fall-does-not-end-run',
    file: 'world.ts',
    find: /died: y < camera - 24 \? elapsed : null/,
    replace: 'died: null',
  },
  {
    id: '17-dead-run-keeps-moving',
    file: 'world.ts',
    find: /if \(climber\.died !== null\) return climber;/,
    replace: 'if (false) return climber;',
  },
  {
    id: '18-view-leaks-future-course',
    file: 'index.ts',
    find: /state\.world\.platforms\.filter\(\(p\) =>\s*state\.world\.climbers\.some\(\(c\) => p\.y >= c\.camera - 24 && p\.y <= c\.camera \+ H\),?\s*\)/,
    replace: 'state.world.platforms',
  },
  {
    id: '19-view-leaks-prng-state',
    file: 'index.ts',
    find: /round: state\.round,/,
    replace: 'rng: state.rng, round: state.round,',
  },
  {
    id: '20-controller-shows-other-player',
    file: 'index.ts',
    find: /const mine = state\.world\.climbers\.find\(\(c\) => c\.id === id\) \?\? null;/,
    replace: 'const mine = state.world.climbers[0] ?? null;',
  },
];

const root = fileURLToPath(new URL('../../../', import.meta.url));
const env = { ...process.env };
if (process.platform === 'win32')
  env['NODE_OPTIONS'] =
    `${env['NODE_OPTIONS'] ?? ''} --require "${resolve(root, 'jobs/P15-doodle-climb/tools/windows-local-drive.cjs')}"`.trim();
const args = [
  'vitest',
  'run',
  'games/doodle-climb/__tests__/physics.test.ts',
  'games/doodle-climb/__tests__/game.test.ts',
  '--maxWorkers=1',
  '--pool=threads',
  '--reporter=dot',
];
const run = (): ReturnType<typeof spawnSync> =>
  process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `pnpm.cmd ${args.join(' ')}`], {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout: 120_000,
      })
    : spawnSync('pnpm', args, { cwd: root, env, encoding: 'utf8', timeout: 120_000 });
const baseline = run();
if (baseline.status !== 0)
  throw new Error(`baseline failed; mutation run refused\n${baseline.stdout}\n${baseline.stderr}`);
const results: unknown[] = [];
let killed = 0;
for (const mutation of mutations) {
  const file = resolve(root, 'games/doodle-climb/server', mutation.file);
  const original = readFileSync(file, 'utf8');
  const count = [...original.matchAll(new RegExp(mutation.find.source, 'g'))].length;
  if (count !== 1) throw new Error(`${mutation.id}: expected one anchor, found ${count}`);
  let result: ReturnType<typeof spawnSync>;
  try {
    writeFileSync(file, original.replace(mutation.find, mutation.replace), 'utf8');
    result = run();
  } finally {
    writeFileSync(file, original, 'utf8');
  }
  if (result.error || result.status === null)
    throw new Error(`${mutation.id}: test runner failed ${String(result.error)}`);
  const caught = result.status !== 0;
  if (caught) killed++;
  const output = String(result.stdout) + '\n' + String(result.stderr);
  const failedTests = output
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .filter((line) => /FAIL|AssertionError|Tests\s+\d+ failed/.test(line))
    .slice(0, 8);
  results.push({
    id: mutation.id,
    file: mutation.file,
    killed: caught,
    exitCode: result.status,
    failedTests,
  });
  console.log(`${caught ? 'KILLED' : 'SURVIVED'} ${mutation.id}`);
}
const report = {
  planted: mutations.length,
  killed,
  requiredKills: 19,
  passed: killed >= 19,
  commands: args,
  results,
};
writeFileSync(
  fileURLToPath(new URL('./mutation-results.json', import.meta.url)),
  JSON.stringify(report, null, 2) + '\n',
  'utf8',
);
if (killed < 19) throw new Error(`only ${killed}/20 bugs caught`);
console.log(`Mutation result: ${killed}/20 caught; every source restored in finally.`);
