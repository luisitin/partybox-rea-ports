// Twenty compiling behavior defects, planted singly; only focused game tests execute.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const job = dirname(fileURLToPath(import.meta.url));
const root = resolve(job, '../..');
const prefix = 'games/ricochet-rumble/server/';
const physics = 'games/ricochet-rumble/__tests__/physics.test.ts';
const lifecycle = 'games/ricochet-rumble/__tests__/game.test.ts';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Semantic anchors are exact after whitespace normalization, so Prettier does not break them.
const mutants = [
  [
    'M01',
    'Vertical wall leaves X velocity unchanged',
    'collision.ts',
    'if (wall.flipX) b.vx = -b.vx;',
    'if (wall.flipX) b.vx = b.vx;',
    physics,
  ],
  [
    'M02',
    'Horizontal wall leaves Y velocity unchanged',
    'collision.ts',
    'if (wall.flipY) b.vy = -b.vy;',
    'if (wall.flipY) b.vy = b.vy;',
    physics,
  ],
  [
    'M03',
    'Tank movement ignores a blocking wall',
    'world.ts',
    'if (clear(walls, next.x + dx, next.y + dy, TANK_RADIUS)) {',
    'if (true) {',
    physics,
  ],
  [
    'M04',
    'Owner loses the muzzle-clearance grace period',
    'collision.ts',
    'tank.id === b.owner && t - b.born < OWNER_SAFE_MS',
    'tank.id === b.owner && false',
    physics,
  ],
  [
    'M05',
    'A sixth simultaneous shell is allowed',
    'world-core.ts',
    'export const MAX_SHELLS = 5;',
    'export const MAX_SHELLS = 6;',
    physics,
  ],
  [
    'M06',
    'Normal shells live twenty seconds instead of ten',
    'world-core.ts',
    'export const SHELL_MS = 10_000;',
    'export const SHELL_MS = 20_000;',
    physics,
  ],
  [
    'M07',
    'Held fire ignores the ordinary reload',
    'world-core.ts',
    'export const RELOAD_MS = 420;',
    'export const RELOAD_MS = 0;',
    physics,
  ],
  [
    'M08',
    'Beam ricochets instead of being absorbed by a wall',
    'collision.ts',
    "if (b.kind === 'beam') return { bullet: null, hits: [] };",
    'if (false) return { bullet: null, hits: [] };',
    physics,
  ],
  [
    'M09',
    'Burst loses both spread projectiles',
    'world.ts',
    "const angles = tank.weapon === 'scatter' ? [-0.2, 0, 0.2] : [0];",
    "const angles = tank.weapon === 'scatter' ? [0] : [0];",
    physics,
  ],
  [
    'M10',
    'Beam travels at ordinary shell speed',
    'world.ts',
    "const speed = kind === 'beam' ? 130 : kind === 'guided' ? 34 : SHELL_SPEED;",
    "const speed = kind === 'beam' ? 43 : kind === 'guided' ? 34 : SHELL_SPEED;",
    physics,
  ],
  [
    'M11',
    'Seeker never activates before its projectile expires',
    'collision.ts',
    "if (b.kind === 'guided' && t - b.born >= 250) {",
    "if (b.kind === 'guided' && t - b.born >= 25_000) {",
    physics,
  ],
  [
    'M12',
    'An exactly contested pickup favors the first roster seat',
    'world.ts',
    'candidates[1] && Math.abs(candidates[0].d - candidates[1].d) < 1e-8',
    'false',
    physics,
  ],
  [
    'M13',
    'Catch-up continues past the locked final-survivor sample',
    'world.ts',
    'if (finished(next)) break;',
    'if (false) break;',
    physics,
  ],
  [
    'M14',
    'A round win earns two points instead of one',
    'scoring.ts',
    'alive.length === 1 && tank.alive ? 1 : 0',
    'alive.length === 1 && tank.alive ? 2 : 0',
    physics,
  ],
  [
    'M15',
    'Multiple cap survivors each earn a win point',
    'scoring.ts',
    'alive.length === 1 && tank.alive ? 1 : 0',
    'alive.length >= 1 && tank.alive ? 1 : 0',
    physics,
  ],
  [
    'M16',
    'Eliminated tanks earn a point in every round',
    'scoring.ts',
    'alive.length === 1 && tank.alive ? 1 : 0',
    'alive.length === 1 && tank.alive ? 1 : 1',
    physics,
  ],
  [
    'M17',
    'A stale timer can end the present fight',
    'phases/play.ts',
    'isTimerFor(state, event) &&',
    'true &&',
    lifecycle,
  ],
  [
    'M18',
    'A disconnected player can resume steering and firing',
    'phases/play.ts',
    '!state.players[event.playerId]?.connected',
    'false',
    lifecycle,
  ],
  [
    'M19',
    'Inputs from before judged combat time are accepted',
    'phases/play.ts',
    'event.now < state.began + state.checked',
    'false',
    lifecycle,
  ],
  [
    'M20',
    'Public views leak internal projectile and spawn counters',
    'index.ts',
    'arena: { maze: state.world.maze, tanks: state.world.tanks, bullets: state.world.bullets, pickups: state.world.pickups, stepped: state.world.stepped }',
    'arena: state.world',
    lifecycle,
  ],
];

function changedSource(source, from, to, id) {
  const positions = [];
  let compact = '';
  for (let index = 0; index < source.length; index++) {
    if (/\s/.test(source[index])) continue;
    positions.push(index);
    compact += source[index];
  }
  const anchor = from.replace(/\s/g, '');
  const at = compact.indexOf(anchor);
  if (at < 0 || compact.indexOf(anchor, at + 1) >= 0)
    throw new Error(`${id}: expected exactly one semantic mutation site`);
  const start = positions[at];
  const end = positions[at + anchor.length - 1] + 1;
  return source.slice(0, start) + to + source.slice(end);
}

const originals = new Map();
for (const [, , file] of mutants) {
  const path = resolve(root, prefix + file);
  if (!originals.has(path)) originals.set(path, readFileSync(path));
}
// Validate all twenty sites before creating a temporary report or changing any source byte.
for (const [id, , file, from, to] of mutants)
  changedSource(originals.get(resolve(root, prefix + file)).toString('utf8'), from, to, id);

if (process.argv.includes('--check')) {
  console.log('20 unique semantic sites validated; no mutations planted and no tests started');
} else {
  const temp = mkdtempSync(join(tmpdir(), 'ricochet-rumble-mutations-'));
  const reportPath = join(temp, 'vitest.json');
  const results = [];
  let baseline;
  const commandArgs = (files) => [
    resolve(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    ...files,
    '--maxWorkers=1',
    '--pool=threads',
    '--reporter=json',
    `--outputFile=${reportPath}`,
  ];

  function runRules(files) {
    const result = spawnSync(process.execPath, commandArgs(files), {
      cwd: root,
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1' },
    });
    let report;
    try {
      report = JSON.parse(readFileSync(reportPath, 'utf8'));
    } catch {
      throw new Error(
        `No valid test report: ${result.error?.message ?? result.stderr?.slice(-500)}`,
      );
    } finally {
      try {
        unlinkSync(reportPath);
      } catch {
        /* No report on a tool failure. */
      }
    }
    if (result.error) throw result.error;
    const suites = report.testResults ?? [];
    const assertions = suites.flatMap((suite) => suite.assertionResults ?? []);
    const failed = assertions.filter((assertion) => assertion.status === 'failed');
    const invalidSuite = suites.some(
      (suite) => suite.status === 'failed' && !(suite.assertionResults ?? []).length,
    );
    // Syntax, module-load, unexpected runtime errors, timeouts and worker failures never count.
    const invalidFailure = failed.some(
      (assertion) =>
        !(assertion.failureMessages ?? []).some((message) => message.includes('AssertionError')),
    );
    if (
      !assertions.length ||
      invalidSuite ||
      invalidFailure ||
      (result.status !== 0 && !failed.length) ||
      report.numRuntimeErrorTestSuites > 0
    )
      throw new Error(`Invalid mutation kill (load/runtime/timeout), exit=${result.status}`);
    return {
      exitCode: result.status,
      tests: assertions.length,
      failed: failed.map((assertion) => ({
        name: assertion.fullName,
        message:
          assertion.failureMessages
            .flatMap((message) => message.split('\n'))
            .find((line) => line.includes('AssertionError')) ?? '',
      })),
    };
  }

  try {
    baseline = runRules([lifecycle, physics]);
    if (baseline.exitCode !== 0 || baseline.failed.length)
      throw new Error('Unmodified focused baseline is not green');
    console.log(`Baseline: ${baseline.tests} focused behavioral tests passed`);
    for (const [id, description, file, from, to, target] of mutants) {
      const path = resolve(root, prefix + file);
      const original = originals.get(path);
      if (hash(readFileSync(path)) !== hash(original))
        throw new Error(`${id}: source changed after the baseline; stop before planting`);
      const changed = changedSource(original.toString('utf8'), from, to, id);
      let outcome;
      try {
        writeFileSync(path, changed, 'utf8');
        outcome = runRules([target]);
      } finally {
        writeFileSync(path, original);
      }
      const status = outcome.exitCode !== 0 && outcome.failed.length ? 'killed' : 'survived';
      results.push({ id, description, file: prefix + file, target, status, ...outcome });
      console.log(`${id}: ${status}, ${outcome.failed.length} behavioral assertions failed`);
    }
    const killed = results.filter((result) => result.status === 'killed').length;
    const sourceHashes = Object.fromEntries(
      [...originals].map(([path, bytes]) => [
        path.slice(root.length + 1).replaceAll('\\', '/'),
        hash(bytes),
      ]),
    );
    const evidence = {
      command: 'node jobs/P22-ricochet-rumble/mutate.mjs',
      baselineCommand:
        'pnpm vitest run games/ricochet-rumble/__tests__/game.test.ts games/ricochet-rumble/__tests__/physics.test.ts --maxWorkers=1 --pool=threads',
      mutationTestCommand:
        'node node_modules/vitest/vitest.mjs run <listed target> --maxWorkers=1 --pool=threads --reporter=json --outputFile=<temporary report>',
      baselineTests: baseline.tests,
      mutations: mutants.length,
      killed,
      invalidMutations: 0,
      sourceHashes,
      results,
    };
    mkdirSync(join(job, 'media'), { recursive: true });
    writeFileSync(
      join(job, 'media', 'mutation-results.json'),
      JSON.stringify(evidence, null, 2) + '\n',
      'utf8',
    );
    console.log(`${killed}/${mutants.length} meaningful mutations detected`);
    if (killed < 19) process.exitCode = 1;
  } finally {
    for (const [path, bytes] of originals) writeFileSync(path, bytes);
    for (const [path, bytes] of originals)
      if (hash(readFileSync(path)) !== hash(bytes)) throw new Error(`Restoration failed: ${path}`);
    try {
      unlinkSync(reportPath);
    } catch {
      /* A report is removed after each run. */
    }
    rmdirSync(temp);
  }
}
