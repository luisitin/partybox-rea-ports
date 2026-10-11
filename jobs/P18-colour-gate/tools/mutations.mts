// Plant one real source bug, run only the game's relevant mechanics/lifecycle tests, restore in finally.
// Run after a full green game suite and while no other worker edits server files.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const server = new URL('../../../games/colour-gate/server/', import.meta.url);
type Mutation = { id: string; bug: string; file: string; find: string; replace: string };
const mutations: Mutation[] = [
  {
    id: 'M01',
    bug: 'Ignore reverse gate rotation',
    file: 'world.ts',
    find: '(gate.direction * t)',
    replace: 't',
  },
  {
    id: 'M02',
    bug: 'Gate colours turn early by rounding upward',
    file: 'world.ts',
    find: 'Math.floor(gate.offset',
    replace: 'Math.ceil(gate.offset',
  },
  {
    id: 'M03',
    bug: 'Reverse the upward crossing test',
    file: 'world.ts',
    find: 'y >= gate.height',
    replace: 'y <= gate.height',
  },
  {
    id: 'M04',
    bug: 'Crash on matching colour and allow a wrong colour',
    file: 'world.ts',
    find: 'gateColour(gate, t) !== runner.colour',
    replace: 'gateColour(gate, t) === runner.colour',
  },
  {
    id: 'M05',
    bug: 'A successful crossing does not award a gate',
    file: 'world.ts',
    find: 'gates: runner.gates + 1',
    replace: 'gates: runner.gates + 0',
  },
  {
    id: 'M06',
    bug: 'A clear does not change the runner colour',
    file: 'world.ts',
    find: 'colour: gate.colourAfter',
    replace: 'colour: runner.colour',
  },
  {
    id: 'M07',
    bug: 'Checkpoint remains one full gate below the clear',
    file: 'world.ts',
    find: 'floor: gate.height - 90',
    replace: 'floor: gate.height - 120',
  },
  {
    id: 'M08',
    bug: 'Retry dead air doubles to 2400 ms',
    file: 'world.ts',
    find: 'respawnAt: t + RETRY_MS',
    replace: 'respawnAt: t + RETRY_MS * 2',
  },
  {
    id: 'M09',
    bug: 'Crash counter never advances',
    file: 'world.ts',
    find: 'crashes: runner.crashes + 1',
    replace: 'crashes: runner.crashes + 0',
  },
  {
    id: 'M10',
    bug: 'Idle unlaunched runners fall and crash',
    file: 'world.ts',
    find: 'if (!runner.launched) return runner;',
    replace: 'if (false && !runner.launched) return runner;',
  },
  {
    id: 'M11',
    bug: 'Respawn drops the runner to the original floor',
    file: 'world.ts',
    find: 'y: runner.floor, velocity: 0, launched: false',
    replace: 'y: 0, velocity: 0, launched: false',
  },
  {
    id: 'M12',
    bug: 'Gravity accelerates upward',
    file: 'world.ts',
    find: 'runner.velocity - GRAVITY * dt',
    replace: 'runner.velocity + GRAVITY * dt',
  },
  {
    id: 'M13',
    bug: 'Repeated taps stack impulse without limit',
    file: 'world.ts',
    find: 'velocity: IMPULSE, lastTap: t',
    replace: 'velocity: r.velocity + IMPULSE, lastTap: t',
  },
  {
    id: 'M14',
    bug: 'Duplicate inputs bypass the debounce',
    file: 'world.ts',
    find: 't - runner.lastTap < TAP_MS',
    replace: 't - runner.lastTap < 0',
  },
  {
    id: 'M15',
    bug: 'Physics samples drift to a 25 ms grid',
    file: 'types.ts',
    find: 'STEP_MS = 20;',
    replace: 'STEP_MS = 25;',
  },
  {
    id: 'M16',
    bug: 'Partial progress rounds up instead of down',
    file: 'scoring.ts',
    find: 'Math.floor(',
    replace: 'Math.ceil(',
  },
  {
    id: 'M17',
    bug: 'Gate clears score only 90 instead of 100',
    file: 'scoring.ts',
    find: 'runner.gates * 100',
    replace: 'runner.gates * 90',
  },
  {
    id: 'M18',
    bug: 'Partial progress can beat a full cleared gate',
    file: 'scoring.ts',
    find: 'Math.min(99,',
    replace: 'Math.min(999,',
  },
  {
    id: 'M19',
    bug: 'The match plays an extra round after the last score',
    file: 'index.ts',
    find: 'state.round >= state.settings.rounds',
    replace: 'state.round > state.settings.rounds',
  },
  {
    id: 'M20',
    bug: 'Phone view leaks the private RNG state',
    file: 'index.ts',
    find: '...controllerEnvelope(state, manifest.id, id, { statusOf: statusOf(state) }),',
    replace:
      '...controllerEnvelope(state, manifest.id, id, { statusOf: statusOf(state) }), rng: state.rng,',
  },
];

const files = [...new Set(mutations.map((m) => m.file))];
const originals = new Map(files.map((file) => [file, readFileSync(new URL(file, server), 'utf8')]));
for (const m of mutations) {
  const source = originals.get(m.file)!;
  if (source.split(m.find).length !== 2)
    throw new Error(`Mutation ${m.id} does not have exactly one target`);
}
const results: {
  id: string;
  bug: string;
  caught: boolean;
  status: number | null;
  failureExcerpt: string;
}[] = [];
try {
  for (const m of mutations) {
    const target = new URL(m.file, server);
    writeFileSync(target, originals.get(m.file)!.replace(m.find, m.replace), 'utf8');
    try {
      const args = [
        'vitest',
        'run',
        'games/colour-gate/__tests__/world.test.ts',
        'games/colour-gate/__tests__/game.test.ts',
        '--maxWorkers=1',
        '--reporter=verbose',
      ];
      const run =
        process.platform === 'win32'
          ? spawnSync('cmd.exe', ['/d', '/s', '/c', `pnpm.cmd ${args.join(' ')}`], {
              cwd: root,
              encoding: 'utf8',
              timeout: 120_000,
            })
          : spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', timeout: 120_000 });
      const log = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
      if (run.error || run.status === null || !/Tests\s+\d+ (?:failed|passed)/.test(log))
        throw new Error(
          `Mutation ${m.id} did not produce a valid test run: ${String(run.error ?? '')}\n${log.slice(-2000)}`,
        );
      const failed = log
        .split('\n')
        .filter((line) => /×|FAIL|AssertionError|Expected|Received/.test(line))
        .slice(0, 10)
        .join('\n');
      const result = {
        id: m.id,
        bug: m.bug,
        caught: run.status !== 0,
        status: run.status,
        failureExcerpt: failed,
      };
      results.push(result);
      console.log(`${m.id} ${result.caught ? 'CAUGHT' : 'SURVIVED'} ${m.bug}`);
    } finally {
      writeFileSync(target, originals.get(m.file)!, 'utf8');
    }
  }
} finally {
  for (const [file, source] of originals) writeFileSync(new URL(file, server), source, 'utf8');
  writeFileSync(
    new URL('mutation-results.json', import.meta.url),
    `${JSON.stringify(results, null, 2)}\n`,
    'utf8',
  );
}
const caught = results.filter((r) => r.caught).length;
console.log(`${caught}/${mutations.length} planted source bugs caught; original sources restored.`);
if (caught < 19) process.exitCode = 1;
