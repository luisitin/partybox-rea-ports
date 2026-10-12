// Serial, reproducible own-game lifecycle campaign; no browser or worker fan-out.
// pnpm exec tsx jobs/P08-hole-swallow/properties.ts
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng, seedRng } from '@partybox/game-sdk';
import type { BotSkill, GameEvent, GameResults, Rng } from '@partybox/game-sdk';
import { game } from '../../games/hole-io/server/index';
import { scoresOf } from '../../games/hole-io/server/scoring';
import { HEIGHT, MAX_SINKS, ROUND_MS, SINK_MS, WIDTH } from '../../games/hole-io/server/types';
import type { Input, State } from '../../games/hole-io/server/types';
import { indexProps } from '../../games/hole-io/server/world';

const T0 = 1_000_000;
const MAX_BYTES = 256 * 1024;
export const STRENGTHS: readonly BotSkill[] = ['easy', 'normal', 'sharp'];
export interface TraceConfig {
  seed: number;
  count: number;
  skill: BotSkill;
  mandatory: boolean;
}
interface Stats {
  events: number;
  views: number;
  botChecks: number;
  malformedRejected: number;
  inertChecks: number;
  privateProbeViews: number;
  maxStateBytes: number;
  maxViewBytes: number;
}
interface RecordedStep {
  branch: string;
  label: string;
  event?: GameEvent<Input>;
  fixture?: string;
}
export interface TraceSummary extends TraceConfig, Stats {
  naturalTermination: 'end' | 'skip' | 'clock';
  forcedEliminations: number;
  eventTraceSha256: string;
  finalScoreSum: number;
}
export class ReplayFailure extends Error {
  constructor(
    message: string,
    public readonly config: TraceConfig,
    public readonly trace: RecordedStep[],
  ) {
    super(message);
    this.name = 'ReplayFailure';
  }
}
const json = (value: unknown): string => JSON.stringify(value);
const same = (left: unknown, right: unknown): boolean => json(left) === json(right);
const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function record(value: unknown): Record<string, unknown> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected object');
  return value as Record<string, unknown>;
}

/** Fixed integer PRNG; recorded samples are unique and exclude mandatory seeds. */
export function recordedSeeds(randomCount = 1000): number[] {
  ensure(Number.isInteger(randomCount) && randomCount >= 0, 'Invalid random seed count');
  let word = 0x70f08a31;
  const seen = new Set([1, 2, 3]);
  const values: number[] = [];
  while (values.length < randomCount) {
    word ^= word << 13;
    word ^= word >>> 17;
    word ^= word << 5;
    word >>>= 0;
    if (seen.has(word)) continue;
    seen.add(word);
    values.push(word);
  }
  return values;
}

/** Mandatory seeds run in every configuration; random seeds cycle all 21 configurations. */
export function campaignPlan(randomCount = 1000): TraceConfig[] {
  const configs = Array.from({ length: 7 }, (_, i) => i + 2).flatMap((count) =>
    STRENGTHS.map((skill) => ({ count, skill })),
  );
  return [
    ...[1, 2, 3].flatMap((seed) => configs.map((config) => ({ ...config, seed, mandatory: true }))),
    ...recordedSeeds(randomCount).map((seed, i) => ({
      ...configs[i % configs.length]!,
      seed,
      mandatory: false,
    })),
  ];
}

const PRIVATE_FIELDS = new Set([
  'rng',
  'cells',
  'dx',
  'dy',
  'inputAt',
  'lastMoveAt',
  'began',
  'immuneUntil',
  'gainAt',
  'respawnAt',
]);
export function assertPublicView(value: unknown, elapsed: number): number {
  const encoded = json(value);
  ensure(typeof encoded === 'string', 'Public view is not JSON');
  const bytes = Buffer.byteLength(encoded);
  ensure(bytes <= MAX_BYTES, 'Public payload exceeds 256 KiB: ' + bytes);
  function walk(node: unknown, path: string): void {
    if (typeof node === 'number') ensure(Number.isFinite(node), 'Nonfinite public number at ' + path);
    if (node === null || typeof node !== 'object') {
      ensure(
        node === undefined || ['string', 'number', 'boolean'].includes(typeof node),
        'Non-JSON public value at ' + path,
      );
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      ensure(!PRIVATE_FIELDS.has(key), 'Private field in public view: ' + path + '.' + key);
      walk(child, path + '.' + key);
    }
  }
  walk(value, '$');
  const city = record(record(value).city);
  ensure(Array.isArray(city.props) && Array.isArray(city.holes), 'Incomplete public city');
  for (const prop of city.props) {
    const p = record(prop);
    ensure(typeof p.availableAt === 'number' && p.availableAt <= elapsed, 'Future prop availability leaked');
  }
  ensure(Array.isArray(city.sinks) && city.sinks.length <= MAX_SINKS, 'Unbounded public sinks');
  for (const sink of city.sinks) {
    const s = record(sink);
    ensure(
      typeof s.consumedAt === 'number' && s.consumedAt <= elapsed && elapsed - s.consumedAt < SINK_MS,
      'Future/expired public sink',
    );
    ensure(!Object.hasOwn(s, 'availableAt'), 'Sink contains recycle clock');
  }
  return bytes;
}
export function assertScoreMonotonic(
  previous: Readonly<Record<string, number>>,
  next: Readonly<Record<string, number>>,
): void {
  ensure(same(Object.keys(previous).sort(), Object.keys(next).sort()), 'Score roster changed');
  for (const [id, oldScore] of Object.entries(previous))
    ensure(Number.isInteger(next[id]) && next[id]! >= oldScore, 'Banked score decreased: ' + id);
}
export function assertResultsConsistent(
  scores: Readonly<Record<string, number>>,
  result: GameResults | null,
): void {
  ensure(result !== null, 'Missing terminal results');
  ensure(same(scores, result.scores), 'Results do not contain banked totals');
  const ids = Object.keys(scores);
  ensure(result.ranking.length === ids.length, 'Incomplete ranking');
  ensure(
    new Set(result.ranking.map((row) => row.playerId)).size === ids.length,
    'Duplicate/missing ranking identity',
  );
  for (const row of result.ranking) {
    ensure(Object.hasOwn(scores, row.playerId), 'Nonstarter in ranking');
    const expectedRank = 1 + Object.values(scores).filter((score) => score > scores[row.playerId]!).length;
    ensure(row.rank === expectedRank, 'Incorrect competition rank: ' + row.playerId);
  }
  const expectedWinners = ids.filter((id) => !ids.some((other) => scores[other]! > scores[id]!)).sort();
  ensure(same([...result.winnerIds].sort(), expectedWinners), 'Wrong joint winners');
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
function initial(config: TraceConfig): State {
  return game.init({
    players: Array.from({ length: config.count }, (_, i) => ({
      id: 'p' + (i + 1),
      name: ('Alexandria Montgomery Wellington ' + (i + 1) + ' XIII').slice(0, 40),
      avatarId: i % 2 ? 'owl' : 'fox',
      connected: true,
      canSeeTv: i % 2 === 0,
      bot: true,
    })),
    seed: config.seed,
    now: T0,
    settings: {},
    presence: { mode: 'together', phoneOnly: config.seed % 2 === 0 },
  });
}
export function runLifecycleTrace(config: TraceConfig): TraceSummary {
  const stats: Stats = {
    events: 0, views: 0, botChecks: 0, malformedRejected: 0, inertChecks: 0,
    privateProbeViews: 0, maxStateBytes: 0, maxViewBytes: 0,
  };
  const trace: RecordedStep[] = [];
  const ids = Array.from({ length: config.count }, (_, i) => 'p' + (i + 1));
  const rng = createRng(config.seed ^ 0x38a07f12);
  let branch = 'natural';
  let state = initial(config);
  const naturalTermination = (['clock', 'end', 'skip'] as const)[config.seed % 3]!;
  function check(s: State, before?: State): void {
    const bytes = Buffer.byteLength(json(s));
    stats.maxStateBytes = Math.max(stats.maxStateBytes, bytes);
    ensure(bytes <= MAX_BYTES, 'State exceeds 256 KiB');
    ensure(Number.isInteger(s.world.elapsed) && s.world.elapsed >= 0 && s.world.elapsed <= ROUND_MS, 'Invalid elapsed');
    ensure(s.world.elapsed % 100 === 0, 'Physics left fixed grid');
    ensure(same(s.scores, scoresOf(s.world)), 'State scores disagree with intake');
    if (before) {
      assertScoreMonotonic(scoresOf(before.world), scoresOf(s.world));
      for (const old of before.world.holes.filter((hole) => !hole.alive)) {
        const h = s.world.holes.find((hole) => hole.id === old.id);
        ensure(h !== undefined && !h.alive, 'Eliminated seat resurrected');
        ensure(h.score === old.score && h.mass === old.mass, 'Dead seat collected intake');
        ensure(h.x === old.x && h.y === old.y, 'Dead seat moved');
      }
    }
    for (const h of s.world.holes) {
      ensure(Number.isInteger(h.score) && h.score >= 0 && h.mass >= 0 && h.mass <= h.score, 'Invalid intake');
      ensure(Number.isFinite(h.x) && Number.isFinite(h.y), 'Nonfinite physics');
      ensure(h.x >= 0 && h.x <= WIDTH && h.y >= 0 && h.y <= HEIGHT, 'Hole outside city');
      if (s.left?.includes(h.id)) ensure(!h.alive, 'Permanent leaver still alive');
    }
    const tv = game.tvView(s);
    stats.views++;
    stats.maxViewBytes = Math.max(stats.maxViewBytes, assertPublicView(tv, s.world.elapsed));
    const publicCity = json(tv.city);
    for (const id of [...ids, 'spectator']) {
      const controller = game.controllerView(s, id);
      stats.views++;
      stats.maxViewBytes = Math.max(stats.maxViewBytes, assertPublicView(controller, s.world.elapsed));
      ensure(json(controller.city) === publicCity, 'Public city differs across identities');
      if (id === 'spectator') {
        ensure(controller.me.role === 'spectator' && controller.mine === null && !controller.participating, 'Spectator gained participation');
      } else {
        const hole = s.world.holes.find((h) => h.id === id)!;
        if (!hole.alive || s.left?.includes(id))
          ensure(!controller.participating && controller.stage, 'Eliminated seat lacks leader stage');
      }
    }
    if (s.phase.id === 'done') {
      assertResultsConsistent(scoresOf(s.world), game.results(s));
      for (const id of ids) {
        const expected = 1 + s.world.holes.filter((h) => h.score > s.scores[id]!).length;
        ensure(game.controllerView(s, id).rank === expected, 'Controller/result rank mismatch');
      }
    } else ensure(game.results(s) === null, 'Results published before done');
  }
  function dispatch(label: string, event: GameEvent<Input>, inert = false): void {
    trace.push({ branch, label, event });
    const previous = state;
    const snapshot = json(previous);
    freeze(previous);
    freeze(event);
    const next = game.reduce(previous, event);
    ensure(json(previous) === snapshot, 'Reducer mutated frozen source state');
    if (inert) {
      stats.inertChecks++;
      ensure(same(next, previous), 'Rejected event changed state: ' + label);
    }
    state = next;
    stats.events++;
    check(state, previous);
  }
  function timerAt(now: number, label: string): void {
    dispatch(label, { type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt });
  }
  function move(id: string, now: number, x: number, y: number, label: string, inert = false): void {
    dispatch(label, { type: 'input', playerId: id, now, input: { type: 'move', x, y } }, inert);
  }
  function botWave(now: number): void {
    for (const id of ids) {
      const snapshot = json(state);
      const input = game.bot.sampleInput(state, id, rng, config.skill);
      stats.botChecks++;
      ensure(json(state) === snapshot, 'Bot mutated state');
      if (input === null) continue;
      const parsed = game.inputSchema.safeParse(input);
      ensure(parsed.success, 'Invalid bot payload');
      dispatch('bot-' + config.skill, { type: 'input', playerId: id, now, input: parsed.data });
    }
  }
  function privateProbe(): void {
    const varied: State = {
      ...state,
      rng: seedRng(config.seed ^ 0x67301ac5),
      world: {
        ...state.world,
        cells: {},
        holes: state.world.holes.map((h) => ({ ...h, dx: 0.123, dy: -0.456, inputAt: 12345, lastMoveAt: 12345 })),
      },
    };
    ensure(same(game.tvView(state), game.tvView(varied)), 'TV encodes private RNG/steering/index');
    stats.privateProbeViews += 2;
    for (const id of [...ids, 'spectator']) {
      ensure(
        same(game.controllerView(state, id), game.controllerView(varied, id)),
        'Controller encodes private RNG/steering/index: ' + id,
      );
      stats.privateProbeViews += 2;
    }
  }
  try {
    check(state);
    privateProbe();
    dispatch('stale-timer-instance', {
      type: 'timer', now: T0 + 500, phaseId: 'play', startedAt: state.phase.startedAt - 1,
    }, true);
    dispatch('wrong-timer-phase', {
      type: 'timer', now: T0 + 500, phaseId: 'not-a-phase', startedAt: state.phase.startedAt,
    }, true);
    botWave(T0);
    timerAt(T0 + 1100, 'early-natural-growth');
    move('p1', T0 + 1100, 0.7, 0.3, 'accepted-direction');
    move('p1', T0 + 1099, -1, -1, 'stale-move', true);
    move('spectator', T0 + 1100, 1, 1, 'spectator-move', true);
    move('__proto__', T0 + 1100, 1, 1, 'unknown-prototype-id', true);
    // The transport boundary parses raw values; reduce receives validated Input only.
    const malformed: unknown[] = [
      null, {}, { type: 'fire' }, { type: 'move', x: 2, y: 0 },
      { type: 'move', x: -2, y: 0 }, { type: 'move', x: '1', y: 0 },
      { type: 'move', x: 0, y: null },
    ];
    for (let i = 0; i < malformed.length; i++) {
      trace.push({ branch, label: 'malformed-schema-rejection-' + i });
      ensure(!game.inputSchema.safeParse(malformed[i]).success, 'Schema accepted malformed input ' + i);
      stats.malformedRejected++;
    }
    dispatch('disconnect', { type: 'player', playerId: 'p1', connected: false, now: T0 + 1200 });
    ensure(state.world.holes[0]!.dx === 0 && state.world.holes[0]!.dy === 0, 'Disconnect did not stop steering');
    move('p1', T0 + 1200, 1, 1, 'disconnected-move', true);
    timerAt(T0 + 1400, 'offline-physics');
    const bank = state.scores.p1;
    dispatch('reconnect', { type: 'player', playerId: 'p1', connected: true, now: T0 + 1400 });
    ensure(state.scores.p1 === bank && state.world.holes[0]!.alive, 'Temporary reconnect reset living seat');
    dispatch('pause', { type: 'vip', action: 'pause', now: T0 + 1500 });
    const pausedWorld = json(state.world);
    const pausedBegan = state.began;
    const pausedEnd = state.endsAt;
    const hold = 2000 + rng.int(0, 8000);
    timerAt(T0 + 1500 + hold, 'paused-timer');
    ensure(json(state.world) === pausedWorld, 'Paused timer advanced physics');
    move('p1', T0 + 1500 + hold, 1, 0, 'paused-input', true);
    privateProbe();
    dispatch('resume', { type: 'vip', action: 'resume', now: T0 + 1500 + hold });
    ensure(state.began === pausedBegan + hold && state.endsAt === pausedEnd + hold, 'Resume shifted shared clocks incorrectly');
    ensure(json(state.world) === pausedWorld, 'Resume advanced paused physics');
    let now = T0 + hold + 1900;
    timerAt(now, 'resumed-physics');
    const leaver = ids.at(-1)!;
    dispatch('permanent-leave', { type: 'player', playerId: leaver, connected: false, gone: 'left', now });
    dispatch('left-reconnect', { type: 'player', playerId: leaver, connected: true, now });
    ensure(state.left?.includes(leaver) && !state.world.holes.find((h) => h.id === leaver)!.alive, 'Leave lost after reconnect');
    move(leaver, now, 1, 1, 'left-move', true);
    ensure(game.bot.sampleInput(state, leaver, rng, config.skill) === null, 'Left bot still acts');
    stats.botChecks++;
    for (let i = 0; i < 6; i++) {
      botWave(now);
      now += rng.int(200, 900);
      timerAt(now, 'random-natural-timer-' + i);
    }
    privateProbe();
    if (naturalTermination === 'end') {
      dispatch('natural-end', { type: 'vip', action: 'end', now: now + 200 });
    } else if (naturalTermination === 'skip') {
      dispatch('natural-skip', { type: 'vip', action: 'skip', now: now + 200 });
      ensure(state.phase.id === 'reveal', 'Skip did not reveal');
      timerAt(state.phase.deadline!, 'reveal-deadline');
    } else {
      timerAt(state.endsAt + rng.int(0, 400), 'shared-clock-deadline');
      ensure(state.phase.id === 'reveal' && state.world.elapsed === ROUND_MS, 'Shared clock failed to clip round');
      timerAt(state.phase.deadline!, 'reveal-deadline');
    }
    ensure(state.phase.id === 'done', 'Natural lifecycle did not terminate');
    const finalScoreSum = Object.values(state.scores).reduce((sum, score) => sum + score, 0);
    timerAt(state.phase.startedAt + 100_000, 'terminal-timer');
    move('p1', state.phase.startedAt + 100_000, 1, 0, 'terminal-move', true);
    // A labeled synthetic valid arena guarantees predation coverage independently of bot paths.
    branch = 'forced-predation';
    const fixture = initial(config);
    fixture.world = {
      ...fixture.world, props: [], cells: indexProps([]), sinks: [],
      holes: fixture.world.holes.map((h, i) => ({
        ...h, mass: i === 0 ? 246 : 0, score: i === 0 ? 246 : 0, immuneUntil: 0,
        x: i < 2 ? WIDTH / 2 : WIDTH / 6 + ((i - 2) % 3) * WIDTH / 3,
        y: i < 2 ? HEIGHT / 2 : i < 5 ? HEIGHT / 5 : HEIGHT * 4 / 5,
      })),
    };
    fixture.scores = scoresOf(fixture.world);
    state = fixture;
    trace.push({ branch, label: 'fixture-initialization', fixture: 'empty props; p1 growth246; p1/p2 same center; others distant; protection expired' });
    check(state);
    timerAt(T0 + 200, 'guaranteed-swallow');
    const prey = state.world.holes.find((h) => h.id === 'p2')!;
    ensure(!prey.alive && prey.eliminatedBy === 'p1' && prey.eliminatedAt !== null, 'Fixture did not eliminate prey');
    const forcedEliminations = state.world.holes.filter((h) => !h.alive).length;
    move('p2', T0 + 200, 1, 1, 'eliminated-move-settled-now', true);
    const deadBank = state.scores.p2;
    dispatch('eliminated-reconnect', { type: 'player', playerId: 'p2', connected: true, now: T0 + 200 });
    ensure(!state.world.holes.find((h) => h.id === 'p2')!.alive && state.scores.p2 === deadBank, 'Dead reconnect revived/reset seat');
    ensure(game.bot.sampleInput(state, 'p2', rng, config.skill) === null, 'Eliminated bot still acts');
    stats.botChecks++;
    privateProbe();
    dispatch('fixture-pause', { type: 'vip', action: 'pause', now: T0 + 300 });
    const frozenPhysics = json(state.world);
    timerAt(T0 + 10_000, 'fixture-held-timer');
    ensure(json(state.world) === frozenPhysics, 'Held fixture advanced physics');
    dispatch('fixture-end-during-pause', { type: 'vip', action: 'end', now: T0 + 10_000 });
    ensure(state.phase.id === 'done' && json(state.world) === frozenPhysics, 'Paused end credited extra play');
    return {
      ...config, ...stats, naturalTermination, forcedEliminations,
      eventTraceSha256: sha256(json(trace)), finalScoreSum,
    };
  } catch (error) {
    throw new ReplayFailure(error instanceof Error ? error.message : String(error), config, trace);
  }
}

function filesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(folder, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }).sort();
}
export function sourceHashes(repoRoot: string): Record<string, string> {
  const paths = [
    ...filesUnder(resolve(repoRoot, 'games/hole-io')).filter((path) =>
      /\.(ts|tsx|css|json)$/.test(path) &&
      !path.includes('/fidelity/') && !path.includes('\\fidelity\\') &&
      !path.includes('/fixtures/') && !path.includes('\\fixtures\\') &&
      !path.includes('/__tests__/') && !path.includes('\\__tests__\\') &&
      !/\.test\./.test(path),
    ),
    ...filesUnder(resolve(repoRoot, 'packages/game-sdk/src')).filter((path) =>
      /\.(ts|tsx)$/.test(path) && !/\.test\./.test(path) &&
      !path.includes('/__tests__/') && !path.includes('\\__tests__\\'),
    ),
    resolve(repoRoot, 'jobs/P08-hole-swallow/properties.ts'),
    resolve(repoRoot, 'pnpm-lock.yaml'),
  ];
  return Object.fromEntries(paths.sort().map((path) => [
    relative(repoRoot, path).replaceAll('\\', '/'), sha256(readFileSync(path)),
  ]));
}
export function runCampaign(randomCount = 1000): {
  plan: TraceConfig[];
  summaries: TraceSummary[];
  failures: { config: TraceConfig; error: string; trace: RecordedStep[] }[];
} {
  const plan = campaignPlan(randomCount);
  const summaries: TraceSummary[] = [];
  const failures: { config: TraceConfig; error: string; trace: RecordedStep[] }[] = [];
  for (const config of plan) {
    try {
      summaries.push(runLifecycleTrace(config));
      if (summaries.length % 100 === 0)
        process.stderr.write('Lifecycle traces ' + summaries.length + '/' + plan.length + '\n');
    } catch (error) {
      failures.push({
        config, error: error instanceof Error ? error.message : String(error),
        trace: error instanceof ReplayFailure ? error.trace : [],
      });
      break;
    }
  }
  return { plan, summaries, failures };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const startedAtUtc = new Date().toISOString();
  const startedMs = Date.now();
  const before = sourceHashes(repoRoot);
  const campaign = runCampaign();
  const after = sourceHashes(repoRoot);
  const unchanged = same(before, after);
  const distribution = Array.from({ length: 7 }, (_, i) => i + 2).flatMap((count) =>
    STRENGTHS.map((skill) => ({
      count, skill,
      planned: campaign.plan.filter((row) => row.count === count && row.skill === skill).length,
      passed: campaign.summaries.filter((row) => row.count === count && row.skill === skill).length,
    })),
  );
  const total = (key: keyof Stats): number => campaign.summaries.reduce((sum, row) => sum + row[key], 0);
  const report = {
    status: campaign.failures.length === 0 && unchanged ? 'passed' : 'failed',
    command: 'pnpm exec tsx jobs/P08-hole-swallow/properties.ts',
    startedAtUtc, completedAtUtc: new Date().toISOString(), durationMs: Date.now() - startedMs,
    mandatorySeeds: [1, 2, 3], randomSeeds: recordedSeeds(),
    randomSeedAlgorithm: 'xorshift32 starting0x70f08a31; unique samples excluding1,2,3',
    uniqueSeeds: new Set(campaign.plan.map((row) => row.seed)).size,
    plannedTraces: campaign.plan.length, passedTraces: campaign.summaries.length,
    distribution, sourceHashesBefore: before, sourceHashesAfter: after, sourceHashesUnchanged: unchanged,
    coverage: {
      events: total('events'), views: total('views'), privateProbeViews: total('privateProbeViews'),
      botChecks: total('botChecks'), malformedSchemaRejections: total('malformedRejected'),
      inertInputChecks: total('inertChecks'),
      forcedPredationTraces: campaign.summaries.filter((row) => row.forcedEliminations > 0).length,
      end: campaign.summaries.filter((row) => row.naturalTermination === 'end').length,
      skip: campaign.summaries.filter((row) => row.naturalTermination === 'skip').length,
      clock: campaign.summaries.filter((row) => row.naturalTermination === 'clock').length,
      maxStateBytes: Math.max(0, ...campaign.summaries.map((row) => row.maxStateBytes)),
      maxViewBytes: Math.max(0, ...campaign.summaries.map((row) => row.maxViewBytes)),
    },
    limits: [
      'Malformed raw payloads are rejected at inputSchema transport boundary; reduce receives typed validated Input.',
      'Forced predation is an explicitly labeled synthetic valid-state branch, not a natural bot encounter.',
      'Successful traces record deterministic event hashes; failures retain full replay events.',
      'This supplements own-game SDK/property/simulation checks and does not measure network/browser play.',
    ],
    failures: campaign.failures, traces: campaign.summaries,
  };
  writeFileSync(new URL('./properties-results.json', import.meta.url), json(report) + '\n', 'utf8');
  process.stdout.write(json({
    status: report.status, traces: report.passedTraces, uniqueSeeds: report.uniqueSeeds,
    events: report.coverage.events, views: report.coverage.views,
    sourceHashesUnchanged: unchanged, failures: report.failures.length,
  }) + '\n');
  if (report.status !== 'passed') process.exitCode = 1;
}
