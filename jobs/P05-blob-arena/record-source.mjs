// CI evidence identifies the complete game tree without changing tracked files.
import { dependencySources, gameSources, runtimeSources } from './provenance.mjs';

const ledger = Object.entries(gameSources()).map(([path, sha256]) => ({ path, sha256 }));
console.log(
  JSON.stringify({
    game: 'agar-io',
    recordedAt: new Date().toISOString(),
    sourceScope: 'Every shipped game byte, including documentation and fidelity artifacts',
    sourceFiles: ledger.length,
    ledger,
    runtimeSources: runtimeSources(),
    dependencySources: dependencySources(),
  }),
);
