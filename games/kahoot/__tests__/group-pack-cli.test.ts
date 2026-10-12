// Exercise the owner's real command and ensure invalid input never replaces its output.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { classicPackSchema } from '../content/classic-schema';
import { parsePackText } from '../content/text-pack';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const cli = join(repo, 'jobs/P02-quiz-rush-teams/validate-pack.ts');
const sample = readFileSync(join(repo, 'jobs/P02-quiz-rush-teams/example-pack.txt'), 'utf8');
const run = (...args: string[]) =>
  spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], {
    cwd: repo,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15_000,
  });

function withFiles(check: (input: string, output: string) => void): void {
  const taskTempPath = mkdtempSync(join(tmpdir(), 'p02-r2-group-pack-'));
  const input = join(taskTempPath, 'my questions.txt');
  const output = join(taskTempPath, 'my questions.json');
  try {
    writeFileSync(input, sample, 'utf8');
    check(input, output);
  } finally {
    for (const file of [input, output]) {
      try {
        unlinkSync(file);
      } catch {
        /* A rejected command may not create output. */
      }
    }
    rmdirSync(taskTempPath);
  }
}

it('validates and compiles custom text into exactly the canonical runtime JSON', () => {
  withFiles((input, output) => {
    const checked = run(input);
    expect(checked.error).toBeUndefined();
    expect(checked.status, checked.stderr).toBe(0);
    expect(checked.stdout.trim()).toBe('Valid custom: 5 questions');
    const converted = run(input, '--out', output);
    expect(converted.error).toBeUndefined();
    expect(converted.status, converted.stderr).toBe(0);
    expect(converted.stdout.trim()).toBe(`Valid custom: 5 questions → ${output}`);
    const result = JSON.parse(readFileSync(output, 'utf8'));
    expect(classicPackSchema.parse(result)).toEqual(parsePackText(sample));
    expect(result.questions.map((q: { id: string }) => q.id)).toEqual(
      ['01', '02', '03', '04', '05'].map((suffix) => `custom-general-${suffix}`),
    );
    const jsonChecked = run(output);
    expect(jsonChecked.status, jsonChecked.stderr).toBe(0);
    expect(jsonChecked.stdout.trim()).toBe('Valid custom: 5 questions');
  });
}, 60_000);

it('preserves the existing destination for malformed text, malformed JSON, flags and input/output collisions', () => {
  withFiles((input, output) => {
    const original = JSON.stringify(parsePackText(sample), null, 2) + '\n';
    writeFileSync(output, original, 'utf8');
    writeFileSync(input, sample.replace('Correct: B', 'Correct: B\nCorrect: C'), 'utf8');
    const invalid = run(input, '--out', output);
    expect(invalid.status, invalid.stderr).toBe(1);
    expect(invalid.stderr).toMatch(/Line \d+: Duplicate Correct/);
    expect(invalid.stdout).toBe('');
    expect(readFileSync(output, 'utf8')).toBe(original);
    writeFileSync(input, sample.replace('Id: custom-general-01', 'Id: general-01'), 'utf8');
    const collisionId = run(input, '--out', output);
    expect(collisionId.status, collisionId.stderr).toBe(1);
    expect(collisionId.stderr).toContain('must start with custom-');
    expect(readFileSync(output, 'utf8')).toBe(original);
    writeFileSync(input, '{ "id": "custom", broken JSON', 'utf8');
    expect(run(input, '--out', output).status).toBe(1);
    expect(readFileSync(output, 'utf8')).toBe(original);
    const unknown = run(output, '--execute', input);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('Usage:');
    const collision = run(output, '--out', output);
    expect(collision.status).toBe(1);
    expect(collision.stderr).toContain('Input and output must be different files');
    expect(readFileSync(output, 'utf8')).toBe(original);
  });
}, 60_000);

it('rejects a valid standard pack rather than compiling an unusable custom-setting file', () => {
  withFiles((input, output) => {
    const sports = readFileSync(join(repo, 'games/kahoot/content/classic-sports.json'), 'utf8');
    writeFileSync(input, sports, 'utf8');
    writeFileSync(output, 'Leave this owner file alone\n', 'utf8');
    const result = run(input, '--out', output);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain('Pack: custom');
    expect(readFileSync(output, 'utf8')).toBe('Leave this owner file alone\n');
  });
}, 30_000);
