// Plant twenty semantic faults separately. Restore the exact source in finally after each run.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base = 'games/slither-io/server/';
const mutations = [
  ['ceil mass scores', 'scoring.ts', 'Math.floor(s.mass)', 'Math.ceil(s.mass)'],
  ['double round points', 'phases/score.ts', '(lastPoints[id] ?? 0)', '(lastPoints[id] ?? 0) * 2'],
  ['missing results', 'scoring.ts', "state.phase.id === 'done'", "state.phase.id === 'never'"],
  ['early round exit', 'phases/play.ts', 'now >= s.endsAt', 'now < s.endsAt'],
  [
    'accept early timer',
    'phases/play.ts',
    'event.now >= (state.phase.deadline ?? Infinity)',
    'true',
  ],
  [
    'accept disconnected input',
    'phases/play.ts',
    '!state.players[event.playerId]!.connected',
    'false',
  ],
  [
    'accept regressive input',
    'phases/play.ts',
    'event.now < state.began + state.world.elapsed',
    'false',
  ],
  [
    'skip connected status update',
    'index.ts',
    'const next = setConnected(s, e);',
    'const next = s;',
  ],
  [
    'boost sticks on disconnect',
    'index.ts',
    '{ ...x, boost: false } : x',
    '{ ...x, boost: true } : x',
  ],
  [
    'ignore phone-only arena',
    'index.ts',
    's.phoneOnly || !hasPlayer(s, id)',
    'false || !hasPlayer(s, id)',
  ],
  ['free boosting', 'world.ts', 'snake.mass - BOOST_COST', 'snake.mass'],
  ['boost at minimum', 'world.ts', 'snake.mass > MIN_MASS', 'snake.mass >= MIN_MASS'],
  ['slow sprint', 'world.ts', 'boosting ? BOOST_SPEED : SPEED', 'boosting ? SPEED : SPEED'],
  ['wrong turn sign', 'world.ts', 'snake.angle + turn', 'snake.angle - turn'],
  ['no right-wall deaths', 'world.ts', 'h[0] > W - RADIUS', 'false'],
  ['self collision enabled', 'world.ts', 'seg.owner !== i', 'true'],
  ['head collision immunity', 'world.ts', 'dead.add(j);', 'void j;'],
  ['lose growth', 'world.ts', 's.mass + f.value)', 's.mass)'],
  ['no growth cap', 'world.ts', 'Math.min(MAX_MASS, s.mass + f.value)', '(s.mass + f.value)'],
  ['full value to tied eaters', 'world.ts', 'f.value / tied.length', 'f.value'],
];
const results = [];
for (const [name, path, from, to] of mutations) {
  const file = base + path,
    original = readFileSync(file, 'utf8');
  if (!original.includes(from)) throw new Error(`Mutation target missing: ${name}`);
  try {
    writeFileSync(file, original.replace(from, to));
    const args = [
      'vitest',
      'run',
      'games/slither-io/server/rules.test.ts',
      'games/slither-io/__tests__/artifacts.test.tsx',
      '--maxWorkers=1',
      '--silent',
    ];
    const run =
      process.platform === 'win32'
        ? spawnSync(
            process.env.ComSpec ?? 'cmd.exe',
            ['/d', '/s', '/c', `pnpm.cmd ${args.join(' ')}`],
            { encoding: 'utf8', windowsHide: true, timeout: 120000 },
          )
        : spawnSync('pnpm', args, { encoding: 'utf8', timeout: 120000 });
    const output = (run.stdout ?? '') + (run.stderr ?? '');
    const killed =
      run.status !== 0 &&
      /AssertionError|expected |Failed Tests|TypeError/.test(output) &&
      !/Cannot find module|SyntaxError|Failed to resolve/.test(output);
    results.push({
      name,
      file,
      killed,
      exit: run.status,
      diagnostic: output
        .split('\n')
        .filter((line) => /FAIL |AssertionError|expected /.test(line))
        .slice(0, 3)
        .join(' | '),
    });
    console.log(`${results.length}/20 ${killed ? 'caught' : 'SURVIVED'} ${name}`);
  } finally {
    writeFileSync(file, original);
  }
}
mkdirSync('jobs/P06-snake-royale/media', { recursive: true });
writeFileSync(
  'jobs/P06-snake-royale/media/mutations.json',
  JSON.stringify(results, null, 2) + '\n',
);
if (results.filter((r) => r.killed).length < 19) process.exitCode = 1;
