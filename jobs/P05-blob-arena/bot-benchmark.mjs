// Thirty complete matches, one physics trajectory each. Compare old/new bot decisions and RNG.
// Run only after the full sweep ends: node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/bot-benchmark.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { createRng } from '../../packages/game-sdk/src/index.ts';
import { botInput as cachedBot } from '../../games/agar-io/server/bot.ts';
import { game } from '../../games/agar-io/server/index.ts';

const botUrl = new URL('../../games/agar-io/server/bot.ts', import.meta.url);
const cachedSource = readFileSync(botUrl, 'utf8');
const cachedBlock = `      const pellets = state.world.pellets
        .map((pellet) => ({ pellet, distance: distance(me, pellet) }))
        .sort((a, b) => a.distance - b.distance);
      target = pellets[skill === 'easy' ? rng.int(0, Math.min(4, pellets.length - 1)) : 0]?.pellet;`;
const oldBlock = `      const pellets = [...state.world.pellets].sort((a, b) => distance(me, a) - distance(me, b));
      target = pellets[skill === 'easy' ? rng.int(0, Math.min(4, pellets.length - 1)) : 0];`;
assert.equal(
  cachedSource.split(cachedBlock).length - 1,
  1,
  'Expected one exact cached pellet-sort block',
);
const oldSource = cachedSource.replace(cachedBlock, oldBlock);
assert.equal(
  oldSource.replace(oldBlock, cachedBlock),
  cachedSource,
  'Baseline differs only in pellet distance caching',
);
// The old strategy exists only in memory. Resolve its imports before importing a transpiled data URL.
const resolvedOldSource = oldSource.replace(
  /from '\.\/(geometry|types)'/g,
  (_match, name) => `from '${new URL(`${name}.ts`, botUrl).href}'`,
);
const compiled = ts.transpileModule(resolvedOldSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    verbatimModuleSyntax: true,
  },
}).outputText;
const { botInput: oldBot } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
const skills = ['easy', 'normal', 'sharp'];
const T0 = 1000000;
const budget = game.manifest.estimatedMinutes * 2 * 60000;
const comparisons = [];
let oldCallMs = 0;
let cachedCallMs = 0;
let decisions = 0;
const started = performance.now();

for (const players of [2, 4, 8]) {
  for (let seed = 1; seed <= 10; seed++) {
    const skill = skills[(seed - 1) % skills.length];
    const roster = Array.from({ length: players }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      avatarId: 'fox',
      connected: true,
      bot: true,
    }));
    let state = game.init({ players: roster, seed, settings: {}, now: T0 });
    const oldRng = createRng(seed ^ 0x5a17beef);
    const cachedRng = createRng(seed ^ 0x5a17beef);
    let now = T0;
    let nextBot = T0 + 1000;
    let events = 0;
    let matchedDecisions = 0;
    const roundsMs = [];
    while (state.phase.id !== 'done') {
      assert.notEqual(state.phase.deadline, null, 'Every nonterminal phase needs a deadline');
      assert.ok(now - T0 <= budget && events < 10000, `Stuck: seed=${seed} n=${players}`);
      now = state.phase.deadline;
      const before = state;
      state = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      events++;
      if (before.phase.id === 'play' && state.phase.id === 'score') roundsMs.push(state.world.time);
      if (state.phase.id !== 'play') continue;
      if (before.phase.id !== 'play') nextBot = state.began + 1000;
      if (now < nextBot) continue;
      for (const player of roster) {
        let oldInput, cachedInput;
        const callOld = () => {
          const begin = performance.now();
          oldInput = oldBot(state, player.id, oldRng, skill);
          oldCallMs += performance.now() - begin;
        };
        const callCached = () => {
          const begin = performance.now();
          cachedInput = cachedBot(state, player.id, cachedRng, skill);
          cachedCallMs += performance.now() - begin;
        };
        // Alternate call order to reduce cache/JIT order bias.
        if (decisions % 2) {
          callCached();
          callOld();
        } else {
          callOld();
          callCached();
        }
        const label = `seed=${seed} n=${players} skill=${skill} t=${state.world.time} id=${player.id}`;
        assert.equal(
          JSON.stringify(cachedInput),
          JSON.stringify(oldInput),
          `${label}: bot input differs`,
        );
        assert.deepEqual(cachedRng.state(), oldRng.state(), `${label}: random draws differ`);
        decisions++;
        matchedDecisions++;
        if (cachedInput === null) continue;
        const parsed = game.inputSchema.safeParse(cachedInput);
        assert.ok(parsed.success, `${label}: invalid input`);
        // Identical inputs drive exactly one reducer trajectory, avoiding duplicate physics work.
        state = game.reduce(state, { type: 'input', now, playerId: player.id, input: parsed.data });
        events++;
      }
      nextBot = now + 1000;
    }
    const results = game.results(state);
    assert.equal(results?.ranking.length, players, 'Results include every seat');
    assert.ok(
      results.ranking.every((row) => Number.isFinite(row.score)),
      'Scores are finite',
    );
    assert.deepEqual(roundsMs, [90000, 90000, 90000]);
    comparisons.push({
      players,
      seed,
      skill,
      matchedDecisions,
      events,
      durationMs: now - T0,
      roundsMs,
      finalStateSha256: hash(state),
      resultsSha256: hash(results),
      scores: state.scores,
      botRng: cachedRng.state(),
    });
  }
}

const report = {
  command: 'node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/bot-benchmark.mjs',
  matches: comparisons.length,
  decisions,
  allInputsAndRngStatesIdentical: true,
  baselineDiff:
    'Only the pellet sort block is replaced with the original repeated-distance comparator.',
  cachedSourceSha256: hash(cachedSource),
  baselineSourceSha256: hash(oldSource),
  oldCallMs,
  cachedCallMs,
  botTimeReductionPercent: (1 - cachedCallMs / oldCallMs) * 100,
  measuredWallMs: performance.now() - started,
  comparisons,
};
writeFileSync(
  new URL('./bot-benchmark.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(
  JSON.stringify({
    matches: report.matches,
    decisions,
    allInputsAndRngStatesIdentical: true,
    oldCallMs,
    cachedCallMs,
    botTimeReductionPercent: report.botTimeReductionPercent,
    measuredWallMs: report.measuredWallMs,
  }),
);
// SDK imports can retain background handles; comparison/report work is finished before exiting.
process.exit(0);
