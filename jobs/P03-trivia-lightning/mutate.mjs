// Plant one concrete fault at a time; subprocesses have fresh module caches and originals survive failures.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const game = resolve(root, 'games/trivia-lightning');
const faults = [
  ['base score +10', 'server/scoring.ts', '100 + Math.min', '110 + Math.min'],
  ['uncapped streak', 'server/scoring.ts', 'Math.min(60,', 'Math.min(80,'],
  ['wrong answers score', 'server/scoring.ts', ': 0;', ': 1;'],
  ['triple instead of double', 'server/scoring.ts', 'double ? 2 : 1', 'double ? 3 : 1'],
  [
    'invert correct verdict',
    'server/phases/race.ts',
    'input.choice === question.correctIndex',
    'input.choice !== question.correctIndex',
  ],
  [
    'miss keeps streak',
    'server/phases/race.ts',
    'runner.streak + 1 : 0',
    'runner.streak + 1 : runner.streak',
  ],
  ['energy every two correct', 'server/phases/race.ts', '% 3 === 0', '% 2 === 0'],
  [
    'double costs no energy',
    'server/phases/race.ts',
    'energy: 0, double: true',
    'energy: 1, double: true',
  ],
  [
    'accept answer before Next',
    'server/phases/race.ts',
    '!question || runner.feedback || input.index',
    '!question || input.index',
  ],
  ['accept stale question ID', 'server/phases/race.ts', ' || input.questionId !== question.id', ''],
  [
    'accept stale answer cursor',
    'server/phases/race.ts',
    ' || input.index !== runner.answered || input.questionId',
    ' || input.questionId',
  ],
  [
    'accept stale Next cursor',
    'server/phases/race.ts',
    '!runner.feedback || input.index !== runner.answered',
    '!runner.feedback',
  ],
  [
    'answer at exact cap accepted',
    'server/phases/race.ts',
    'event.now >= state.endsAt',
    'event.now > state.endsAt',
  ],
  ['shorten freeze to two seconds', 'server/types.ts', 'FREEZE_MS = 3000', 'FREEZE_MS = 2000'],
  ['answer while frozen', 'server/phases/race.ts', ' || runner.freezeUntil > event.now', ''],
  ['allow self freeze', 'server/phases/race.ts', 'target === id || ', ''],
  ['stack active freezes', 'server/phases/race.ts', ' || rival.freezeUntil > now', ''],
  ['end when only one finishes', 'server/phases/race.ts', '.every((p)', '.some((p)'],
  [
    'skip winner podium beat',
    'server/phases/podium.ts',
    'state.podiumStep >= 3',
    'state.podiumStep >= 2',
  ],
  [
    'leak answer key on phones',
    'server/index.ts',
    'options: [...q.options], index: r!.answered',
    'options: [...q.options], index: r!.answered, correctIndex: q.correctIndex',
  ],
];
const results = [];
for (const [fault, file, before, after] of faults) {
  const path = resolve(game, file);
  const original = readFileSync(path, 'utf8');
  const pattern = new RegExp(
    before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ +/g, '\\s*'),
    'g',
  );
  if ([...original.matchAll(pattern)].length !== 1)
    throw new Error(`Mutation is not unique: ${fault}`);
  try {
    writeFileSync(path, original.replace(pattern, after));
    const run = spawnSync(
      process.execPath,
      [
        resolve(root, 'node_modules/vitest/vitest.mjs'),
        'run',
        'games/trivia-lightning/__tests__/game.test.ts',
        '--maxWorkers=1',
        '--reporter=dot',
      ],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000 },
    );
    const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
    const caught =
      run.status !== 0 &&
      /AssertionError|expected|toBe|toEqual|toMatch/.test(output) &&
      !/Failed to load|Cannot find module|Transform failed|SyntaxError/.test(output);
    results.push({
      fault,
      file,
      caught,
      exitCode: run.status,
      detail: caught ? 'Rule assertion failed on planted bug' : output.slice(-1200),
    });
    process.stdout.write(`${caught ? 'CAUGHT' : 'MISSED'} ${fault}\n`);
  } finally {
    writeFileSync(path, original);
  }
}
writeFileSync(
  resolve(import.meta.dirname, 'media/mutations.json'),
  JSON.stringify(
    { tested: results.length, caught: results.filter((r) => r.caught).length, results },
    null,
    2,
  ) + '\n',
);
if (results.filter((r) => r.caught).length < 19) process.exitCode = 1;
