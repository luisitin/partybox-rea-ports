// Plant one real source fault, run focused rule tests, restore the byte-identical file in finally.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const gameDir = 'games/stack-tower/';
const cases = [
  [
    'M01',
    'floor scoring doubled',
    'server/world.ts',
    'const height = tower.height + 1;',
    'const height = tower.height + 2;',
  ],
  [
    'M02',
    'best combines attempts',
    'server/world.ts',
    'Math.max(tower.best, height)',
    'tower.best + height',
  ],
  [
    'M03',
    'trim retains perfect streak',
    'server/world.ts',
    'const streak = perfect ? tower.streak + 1 : 0;',
    'const streak = tower.streak + 1;',
  ],
  [
    'M04',
    'growth exceeds starting footprint',
    'server/world.ts',
    'Math.min(WIDTH, rounded(size + growth))',
    'rounded(size + growth)',
  ],
  [
    'M05',
    'trim moves center the wrong way',
    'server/world.ts',
    'tower.footprint[axis] + offset / 2',
    'tower.footprint[axis] - offset / 2',
  ],
  [
    'M06',
    'only half overhang removed',
    'server/world.ts',
    'tower.footprint[dim] - lost',
    'tower.footprint[dim] - lost / 2',
  ],
  [
    'M07',
    'axes never alternate',
    'server/world.ts',
    "height % 2 === 0 ? 'x' : 'z'",
    "height >= 0 ? 'x' : 'x'",
  ],
  [
    'M08',
    'drop cooldown disabled',
    'server/world.ts',
    'now < tower.movingSince + DROP_MS',
    'now < tower.movingSince',
  ],
  [
    'M09',
    'retry does not change attempt serial',
    'server/world.ts',
    'previous.attempt + 1',
    'previous.attempt',
  ],
  ['M10', 'retry erases saved score', 'server/world.ts', 'best: previous?.best ?? 0', 'best: 0'],
  ['M11', 'reveal deadline extended', 'server/types.ts', 'SCORE_MS = 6000', 'SCORE_MS = 60_000'],
  [
    'M12',
    'round does not expire on time',
    'server/phases/play.ts',
    'if (event.now >= state.endsAt) return next(state, state.endsAt);',
    'if (event.now >= state.endsAt + 1000) return next(state, state.endsAt);',
  ],
  [
    'M13',
    'stale floor input accepted',
    'server/phases/play.ts',
    'event.input.level !== tower.height',
    'event.input.level < 0',
  ],
  [
    'M14',
    'stale attempt input accepted',
    'server/phases/play.ts',
    'event.input.attempt !== tower.attempt',
    'event.input.attempt < 0',
  ],
  [
    'M15',
    'pause fails to shift slider clock',
    'server/index.ts',
    'movingSince: t.movingSince + ms',
    'movingSince: t.movingSince',
  ],
  [
    'M16',
    'stale timer accepted',
    'server/phases/play.ts',
    '!isTimerFor(state, event)',
    'event.phaseId !== state.phase.id',
  ],
  [
    'M17',
    'disconnect still accepts inputs',
    'server/phases/play.ts',
    '!state.players[event.playerId]?.connected',
    'false',
  ],
  [
    'M18',
    'TV leaks future RNG',
    'server/index.ts',
    'towers: state.towers,',
    'towers: state.towers, rng: state.rng,',
  ],
  [
    'M19',
    'phone leaks future RNG',
    'server/index.ts',
    'stage,\n    rank:',
    'stage,\n    rng: state.rng,\n    rank:',
  ],
  [
    'M20',
    'terminal results never published',
    'server/scoring.ts',
    "state.phase.id !== 'done'",
    "state.phase.id !== 'never'",
  ],
];
const files = ['world', 'game', 'bot', 'views', 'screens'].map(
  (name) => `${gameDir}__tests__/${name}.test.${name === 'screens' ? 'tsx' : 'ts'}`,
);
const report = [];
for (const [id, fault, name, from, to] of cases) {
  const file = new URL(`../../../${gameDir}${name}`, import.meta.url);
  const original = readFileSync(file, 'utf8');
  if (!original.includes(from)) throw new Error(`${id}: mutation target not found in ${name}`);
  try {
    writeFileSync(file, original.replace(from, to));
    const run = spawnSync(
      process.execPath,
      ['node_modules/vitest/vitest.mjs', 'run', ...files, '--maxWorkers=1'],
      { cwd: root, encoding: 'utf8', timeout: 60_000, windowsHide: true },
    );
    const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
    const caught =
      run.status !== 0 &&
      /AssertionError|expected .*|FAIL\s+games\/stack-tower/.test(output) &&
      !run.error;
    const failed = [...output.matchAll(/FAIL\s+([^\n]+)/g)].map((match) => match[1].trim());
    report.push({ id, fault, file: name, caught, status: run.status, tests: failed });
    console.log(`${id} ${caught ? 'CAUGHT' : 'SURVIVED'} ${fault}`);
    if (run.error) throw run.error;
  } finally {
    writeFileSync(file, original);
  }
}
writeFileSync(
  new URL('../media/mutations.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
const caught = report.filter((row) => row.caught).length;
console.log(`Mutation score ${caught}/${report.length}`);
if (caught < 19) process.exitCode = 1;
