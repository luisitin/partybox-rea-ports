// Recover only the restored-baseline process check; never count a timed-out mutant as killed.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const job = dirname(fileURLToPath(import.meta.url));
const root = resolve(job, '../..');
const path = resolve(job, 'mutation-results.json');
const evidence = JSON.parse(readFileSync(path, 'utf8'));
const retry = JSON.parse(readFileSync(resolve(job, 'post-baseline-retry.json'), 'utf8'));
const assertions = retry.testResults.flatMap((suite) => suite.assertionResults ?? []);
const restored = Object.entries(evidence.sourceHashes).every(
  ([file, expected]) =>
    createHash('sha256')
      .update(readFileSync(resolve(root, file)))
      .digest('hex') === expected,
);
if (
  !restored ||
  !retry.success ||
  retry.numRuntimeErrorTestSuites > 0 ||
  assertions.length !== evidence.baseline.tests ||
  assertions.some((assertion) => assertion.status !== 'passed') ||
  evidence.results.length !== 20 ||
  evidence.invalidMutations !== 0 ||
  evidence.killed < 19
)
  throw new Error(
    'Restoration retry did not establish a clean source and passing behavioral baseline',
  );

evidence.postBaselineAttempts = [
  evidence.postBaseline,
  {
    command:
      'pnpm vitest run games/kahoot/__tests__/group-server.test.ts games/kahoot/__tests__/classic-server.test.ts games/kahoot/__tests__/scoring.test.ts games/kahoot/__tests__/answer-window.test.ts games/kahoot/__tests__/vip.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --reporter=json --outputFile=jobs/P02-quiz-rush-teams/post-baseline-retry.json',
    exitCode: 0,
    tests: assertions.length,
    failed: [],
    invalidReason: '',
    timedout: false,
    reportFile: 'post-baseline-retry.json',
  },
];
evidence.previousError = evidence.error;
evidence.postBaseline = evidence.postBaselineAttempts[1];
evidence.error = '';
evidence.restorationVerified = restored;
evidence.complete = true;
evidence.recoveryCommand = 'node jobs/P02-quiz-rush-teams/verify-mutation-restoration.mjs';
writeFileSync(path, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
console.log(
  `Restored hashes match; ${assertions.length} baseline checks passed; ${evidence.killed}/20 mutations detected.`,
);
