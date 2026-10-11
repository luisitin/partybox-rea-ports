// Twenty real, syntax-valid source mutations. Run sequentially when no other process is
// editing game code: node jobs/P04-draw-and-guess/tools/mutate.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const gameDir = join(root, 'games/draw-and-guess');
const logDir = join(here, 'mutation-logs');
mkdirSync(logDir, { recursive: true });

const bugs = [
  [
    'M01',
    'Zero guess base points',
    'scoring.ts',
    'return 300 + Math.floor(700 * fraction);',
    'return 0 + Math.floor(700 * fraction);',
  ],
  [
    'M02',
    'Remove speed points',
    'scoring.ts',
    'return 300 + Math.floor(700 * fraction);',
    'return 300 + Math.floor(0 * fraction);',
  ],
  [
    'M03',
    'Reward slow guesses instead of fast ones',
    'scoring.ts',
    '(state.endsAt - now) / (state.endsAt - state.began)',
    '(now - state.began) / (state.endsAt - state.began)',
  ],
  [
    'M04',
    'Artist receives zero points',
    'phases/draw.ts',
    '[state.drawer]: (state.scores[state.drawer] ?? 0) + 250,',
    '[state.drawer]: (state.scores[state.drawer] ?? 0) + 0,',
  ],
  [
    'M05',
    'Replace accumulated solver score',
    'phases/draw.ts',
    '[playerId]: (state.scores[playerId] ?? 0) + points,',
    '[playerId]: points,',
  ],
  [
    'M06',
    'Award correct guesses repeatedly',
    'phases/draw.ts',
    "if (input.type !== 'guess' || Object.hasOwn(state.solved, playerId)) return state;",
    "if (input.type !== 'guess') return state;",
  ],
  [
    'M07',
    'Every wrong guess scores',
    'phases/draw.ts',
    "if (normalizeAnswer(text, 'en').compact !== normalizeAnswer(state.word, 'en').compact)",
    'if (false)',
  ],
  [
    'M08',
    'TV and public board leak the answer',
    'index.ts',
    "const revealed = state.phase.id === 'reveal' || state.phase.id === 'done';",
    'const revealed = true;',
  ],
  [
    'M09',
    'Word choices leak to other phones',
    'index.ts',
    "...(isDrawer && state.phase.id === 'choose' ? { choices: state.choices } : {}),",
    "...(state.phase.id === 'choose' ? { choices: state.choices } : {}),",
  ],
  [
    'M10',
    'Drawing secret leaks to all phones',
    'index.ts',
    '...(isDrawer && drawing ? { secret: state.word } : {}),',
    '...(drawing ? { secret: state.word } : {}),',
  ],
  [
    'M11',
    'Other players choose the artist word',
    'phases/choose.ts',
    'event.playerId !== state.drawer ||',
    'false ||',
  ],
  [
    'M12',
    'Other players can erase or paint',
    'phases/draw.ts',
    'if (playerId === state.drawer)',
    "if (input.type !== 'guess')",
  ],
  [
    'M13',
    'Undo deletes the oldest stroke',
    'phases/draw.ts',
    'strokes: undoInk(state.strokes),',
    'strokes: state.strokes.slice(1),',
  ],
  [
    'M14',
    'Clear keeps all strokes',
    'phases/draw.ts',
    'return { ...state, clock: now, inkRevision: state.inkRevision + 1, strokes: [] };',
    'return { ...state, clock: now, inkRevision: state.inkRevision + 1, strokes: state.strokes };',
  ],
  [
    'M15',
    'Stroke limit permits an extra stroke',
    'phases/draw.ts',
    'state.strokes.length < MAX_STROKES',
    'state.strokes.length < MAX_STROKES + 1',
  ],
  ['M16', 'Hints appear twice as early', 'phases/draw.ts', '(3 * elapsed)', '(6 * elapsed)'],
  [
    'M17',
    'Idle drawing never exits at its cap',
    'phases/draw.ts',
    'event.now >= state.endsAt || allSolved(state)',
    'false || allSolved(state)',
  ],
  [
    'M18',
    'Draw duration accidentally doubles',
    'phases/draw.ts',
    'now + state.settings.drawSeconds * 1000',
    'now + state.settings.drawSeconds * 2000',
  ],
  [
    'M19',
    'Rotation skips every second artist',
    'index.ts',
    'nextTurn(state, now, state.turn + 1)',
    'nextTurn(state, now, state.turn + 2)',
  ],
  [
    'M20',
    'Pause consumes drawing time',
    'index.ts',
    'endsAt: state.endsAt + shift,',
    'endsAt: state.endsAt,',
  ],
];

const command = 'pnpm.cmd vitest run games/draw-and-guess/__tests__/game.test.ts --maxWorkers=1';
function runTests() {
  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 4 * 1024 * 1024,
          windowsHide: true,
          timeout: 120_000,
        })
      : spawnSync(
          'pnpm',
          ['vitest', 'run', 'games/draw-and-guess/__tests__/game.test.ts', '--maxWorkers=1'],
          { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 120_000 },
        );
  if (result.error) throw result.error;
  return { exitCode: result.status, text: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const baseline = runTests();
writeFileSync(join(logDir, 'baseline.txt'), baseline.text, 'utf8');
if (baseline.exitCode !== 0)
  throw new Error('Baseline tests fail; mutation check refused to start.');

const backups = new Map(
  bugs.map(([, , file]) => {
    const full = join(gameDir, 'server', file);
    return [full, readFileSync(full, 'utf8')];
  }),
);
const results = [];
try {
  for (const [id, description, file, before, after] of bugs) {
    const full = join(gameDir, 'server', file);
    const original = backups.get(full);
    if (!original || original.split(before).length !== 2)
      throw new Error(`${id}: anchor must occur exactly once in ${file}`);
    const mutated = original.replace(before, after);
    let result;
    try {
      writeFileSync(full, mutated, 'utf8');
      result = runTests();
      writeFileSync(join(logDir, `${id}.txt`), result.text, 'utf8');
    } finally {
      writeFileSync(full, original, 'utf8');
    }
    const caught =
      result.exitCode !== 0 &&
      /AssertionError|expected .* (?:to|not)|Error: (?:never reached|wrong)/.test(result.text);
    results.push({
      id,
      description,
      file: `games/draw-and-guess/server/${file}`,
      caught,
      exitCode: result.exitCode,
      originalSha256: createHash('sha256').update(original).digest('hex'),
      mutantSha256: createHash('sha256').update(mutated).digest('hex'),
      testLog: `tools/mutation-logs/${id}.txt`,
    });
    console.log(`${id} ${caught ? 'CAUGHT' : 'SURVIVED'} ${description}`);
  }
} finally {
  for (const [full, original] of backups) writeFileSync(full, original, 'utf8');
  writeFileSync(
    join(here, 'mutation-results.json'),
    `${JSON.stringify({ command, total: bugs.length, caught: results.filter((r) => r.caught).length, restored: true, results }, null, 2)}\n`,
    'utf8',
  );
}
const restored = runTests();
writeFileSync(join(logDir, 'restored.txt'), restored.text, 'utf8');
if (restored.exitCode !== 0) throw new Error('Restored baseline failed.');
const caught = results.filter((r) => r.caught).length;
console.log(
  `Mutation result: ${caught}/${bugs.length}, original sources restored, baseline green.`,
);
if (caught < 19) process.exitCode = 1;
