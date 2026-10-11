// Renew only this runner's claim on main; preserve concurrent runners on every retry.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
// Keep the game checkout intact while tests/simulations read fixtures and write evidence.
const claimPath = mkdtempSync(join(tmpdir(), 'r10-claim-'));
if (
  !resolve(claimPath).startsWith(resolve(tmpdir())) ||
  !basename(claimPath).startsWith('r10-claim-')
)
  throw new Error('Unexpected temporary worktree path.');
git('fetch', 'origin', 'main');
git('worktree', 'add', '--detach', claimPath, 'origin/main');
const claimGit = (...args) => git('-C', claimPath, ...args);
const suffix = process.argv.includes('--done') ? ' DONE' : '';
try {
  for (let attempt = 0; attempt < 5; attempt++) {
    // Required immediately before every CLAIMS.md commit, including a retry.
    claimGit('pull', '--rebase', 'origin', 'main');
    const text = readFileSync(join(claimPath, 'CLAIMS.md'), 'utf8');
    if (!/^P14 r10-local /m.test(text))
      throw new Error('P14 claim is no longer owned by r10-local.');
    writeFileSync(
      join(claimPath, 'CLAIMS.md'),
      text.replace(
        /^P14 r10-local .*$/m,
        `P14 r10-local ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')} job/P14-crossy-streets${suffix}`,
      ),
    );
    claimGit('add', 'CLAIMS.md');
    claimGit('commit', '-m', `chore: ${suffix ? 'complete' : 'renew'} P14 claim for r10-local`);
    try {
      claimGit('push', 'origin', 'HEAD:main');
      console.log('P14 claim renewed on main.');
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      // The only unpublished commit is this script's own claim renewal. Recreate it
      // from fetched main so a neighbouring claim never gets dropped in a conflict.
      claimGit('fetch', 'origin', 'main');
      claimGit('reset', '--soft', 'origin/main');
      claimGit('restore', '--staged', 'CLAIMS.md');
      claimGit('restore', 'CLAIMS.md');
    }
  }
} finally {
  // The resolved, verified temporary path is owned entirely by this script.
  git('worktree', 'remove', claimPath);
}
