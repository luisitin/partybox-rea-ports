// Verify the owner's actual conversion command, including transactional invalid-input behavior.
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { parsePackText } from '../content/text-pack';

it('converts the sample exactly, rejects invalid input before replacing output, and rejects unknown arguments', () => {
  const taskTempPath = mkdtempSync(join(tmpdir(), 'p02-r2-pack-'));
  const input = join(taskTempPath, 'my questions.txt');
  const output = join(taskTempPath, 'my questions.json');
  const cli = resolve('jobs/P02-quiz-rush-teams/validate-pack.ts');
  const sample = readFileSync(resolve('jobs/P02-quiz-rush-teams/example-pack.txt'), 'utf8');
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15_000,
    });
  try {
    writeFileSync(input, sample, 'utf8');
    const valid = run(input, '--out', output);
    expect(valid.error).toBeUndefined();
    expect(valid.status, valid.stderr).toBe(0);
    expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(parsePackText(sample));
    const unchanged = readFileSync(output, 'utf8');
    writeFileSync(input, sample.replace(/Correct: [ABCD]/, 'Correct: E'), 'utf8');
    const invalid = run(input, '--out', output);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('Correct must be');
    expect(readFileSync(output, 'utf8')).toBe(unchanged);
    expect(run(output, '--execute', input).status).toBe(1);
    expect(readFileSync(output, 'utf8')).toBe(unchanged);
  } finally {
    for (const file of [input, output]) {
      try {
        unlinkSync(file);
      } catch {
        /* A failed command may not create the output. */
      }
    }
    rmdirSync(taskTempPath);
  }
}, 60_000);
