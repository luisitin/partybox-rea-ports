// Seeded group lifecycle traces freeze every snapshot and replay exactly the same valid events.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill, GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { CLASSIC_PACK_IDS } from '../content/classic-schema';
import { game } from '../server/index';
import { groupStandings, teamOf } from '../server/teams';
import type { Input, State } from '../server/types';
import { controllerView, tvView } from '../server/views';
import type { LightningControllerView, LightningTvView } from '../server/views';
import { T0 } from './run';

const frozen = new WeakSet<object>();
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !frozen.has(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
    frozen.add(value);
  }
  return value;
}
function assertJson(value: unknown): void {
  if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0)))
    throw new Error(`Non-JSON number ${value}`);
  if (value === undefined || ['function', 'bigint', 'symbol'].includes(typeof value))
    throw new Error(`Non-JSON value ${typeof value}`);
  if (value && typeof value === 'object')
    for (const child of Object.values(value)) assertJson(child);
}
function omitted(value: unknown, keys: ReadonlySet<string>): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key)) throw new Error(`Private group view field ${key}`);
    omitted(child, keys);
  }
}
const NEVER = new Set([
  'rng',
  'questionIds',
  'picks',
  'teamScores',
  'teamGains',
  'roomDecision',
  'answerClosesAt',
  'questionReadableUntil',
  'wagerClosesAt',
  'wagerReadableUntil',
]);
const BEFORE_REVEAL = new Set([
  'correctIndex',
  'pickIndex',
  'answerDistribution',
  'explanation',
  'decision',
]);
const SKILLS: readonly BotSkill[] = ['easy', 'normal', 'sharp'];

function assertView(state: State, view: LightningTvView | LightningControllerView): void {
  assertJson(view);
  const json = JSON.stringify(view);
  if (json !== JSON.stringify(JSON.parse(json)))
    throw new Error('Group view loses data across JSON');
  if (Buffer.byteLength(json, 'utf8') >= 256 * 1024) throw new Error('Unbounded group view');
  omitted(view, NEVER);
  if (state.phase.id === 'question' || state.phase.id === 'talk') omitted(view, BEFORE_REVEAL);
  if (state.phase.id === 'talk' && Object.hasOwn(view, 'answerStamp'))
    throw new Error('Discussion must not publish an answer stamp before the clock opens');
  const final =
    state.phase.id === 'podium' ||
    (state.phase.id === 'reveal' && state.index === state.questionIds.length - 1);
  if (final) {
    if (Object.hasOwn(view, 'standings') || Object.hasOwn(view, 'rows'))
      throw new Error('Unrevealed final standings leaked');
    if (view.players.some((player) => Object.hasOwn(player, 'score')))
      throw new Error('Envelope leaked final totals');
    const teams = view.group?.teams ?? [];
    if (state.phase.id === 'reveal' && teams.length !== 0)
      throw new Error('Final chart leaked team totals');
    if (state.phase.id === 'podium') {
      const allowed = groupStandings(state).filter(
        (team) => team.rank >= (state.podiumRank ?? 1) && team.rank <= 3,
      );
      if (JSON.stringify(teams) !== JSON.stringify(allowed))
        throw new Error('Group podium leaked a future team or dropped a revealed tier');
      if (view.podium?.entries.some((row) => !allowed.some((team) => team.id === row.playerId)))
        throw new Error('Podium rows include an unrevealed team');
    }
    if ('me' in view) {
      const team = teamOf(state, view.me.id);
      const unveiled =
        team && state.phase.id === 'podium' && teams.some((candidate) => candidate.id === team.id);
      const expected = team
        ? (state.teamScores?.[team.id] ?? 0) - (unveiled ? 0 : (state.teamGains?.[team.id] ?? 0))
        : 0;
      if (view.myScore !== expected)
        throw new Error('Personal score leaked an unrevealed team total');
      if (team && !unveiled && Object.hasOwn(view, 'myRank'))
        throw new Error('Personal rank leaked a future podium tier');
    }
  }
  if ('stage' in view && view.stage) assertView(state, view.stage);
}

describe.each(['teams', 'tv-vote'] as const)('%s hidden acceptance', (mode) => {
  it('lets only the answering owner distinguish two accepted shape choices before reveal', () => {
    for (const count of [2, 4, 8]) {
      const players = testPlayers(count).map((player, index) => ({
        ...player,
        canSeeTv: index % 2 !== 0,
      }));
      let state = game.init({
        players,
        seed: 42,
        now: T0,
        settings: { quizMode: mode, questions: 5 },
      });
      for (let steps = 0; steps < 5 && state.phase.id !== 'question'; steps++)
        state = game.reduce(state, {
          type: 'timer',
          now: state.phase.deadline!,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt,
        });
      expect(state.phase.id).toBe('question');
      const owner = players[0]!.id;
      const stamp = controllerView(state, game.manifest.id, owner).answerStamp;
      if (!stamp) throw new Error('Open group question needs canonical input stamps');
      const left = game.reduce(freeze(state), {
        type: 'input',
        playerId: owner,
        now: state.phase.startedAt + 500,
        input: { type: 'answer', ...stamp, index: 0 },
      });
      const right = game.reduce(freeze(state), {
        type: 'input',
        playerId: owner,
        now: state.phase.startedAt + 500,
        input: { type: 'answer', ...stamp, index: 1 },
      });
      expect(left.phase.id).toBe('question');
      expect(controllerView(left, game.manifest.id, owner).myPickIndex).toBe(0);
      expect(controllerView(right, game.manifest.id, owner).myPickIndex).toBe(1);
      expect(JSON.stringify(tvView(left, game.manifest.id))).toBe(
        JSON.stringify(tvView(right, game.manifest.id)),
      );
      for (const id of [
        ...players.slice(1).map((player) => player.id),
        'audience',
        '__proto__',
        'constructor',
      ])
        expect(JSON.stringify(controllerView(left, game.manifest.id, id))).toBe(
          JSON.stringify(controllerView(right, game.manifest.id, id)),
        );
    }
  });
});

it('replays seeds1,2,3 plus1000 seeded random group traces with immutable bounded views and three bot strengths', () => {
  const sampling = createRng(20261012 ^ 0x503032);
  const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => sampling.int(4, 0x3fffffff))];
  let events = 0;
  let views = 0;
  let botChecks = 0;
  let maxStateBytes = 0;
  const phases = new Set<string>();
  const eventKinds = new Set<string>();
  for (const mode of ['teams', 'tv-vote'] as const)
    for (const seed of seeds) {
      const random = createRng(seed ^ 0x67726f75);
      const players = testPlayers(2 + (seed % 7)).map((player, index) => ({
        ...player,
        canSeeTv: index % 3 !== 0,
      }));
      const ids = [...players.map((player) => player.id), 'audience', '__proto__', 'constructor'];
      const context = {
        players,
        seed,
        now: T0,
        settings: {
          quizMode: mode,
          questions: 5,
          answerSeconds: 5,
          classicPack: CLASSIC_PACK_IDS[seed % CLASSIC_PACK_IDS.length]!,
        },
        presence: { mode: 'together' as const, phoneOnly: seed % 3 === 0 },
      };
      let state = game.init(context);
      let replay = game.init(context);
      let now = T0;
      const validate = (): void => {
        assertJson(state);
        const json = JSON.stringify(state);
        if (json !== JSON.stringify(replay))
          throw new Error(`Non-deterministic ${mode} replay at seed ${seed}, event ${events}`);
        const bytes = Buffer.byteLength(json, 'utf8');
        if (bytes >= 256 * 1024) throw new Error('Unbounded group state');
        maxStateBytes = Math.max(maxStateBytes, bytes);
        assertView(state, tvView(state, game.manifest.id));
        views++;
        for (const id of ids) {
          assertView(state, controllerView(state, game.manifest.id, id));
          views++;
        }
        phases.add(state.phase.id);
        for (const skill of SKILLS) {
          for (const id of [players[0]!.id, 'audience', '__proto__', 'constructor']) {
            const input = game.bot.sampleInput(
              freeze(state),
              id,
              createRng(seed ^ botChecks),
              skill,
            );
            if (input !== null && !game.inputSchema.safeParse(input).success)
              throw new Error(`Invalid ${skill} bot input in ${state.phase.id}`);
            if (
              input !== null &&
              (state.phase.id !== 'question' || state.phase.paused || !state.players[id]?.connected)
            )
              throw new Error('Group bot answered outside its live window');
            botChecks++;
          }
        }
      };
      const apply = (event: GameEvent<Input>): void => {
        const before = state;
        const original = JSON.stringify(before);
        state = game.reduce(freeze(state), event);
        replay = game.reduce(freeze(replay), event);
        if (JSON.stringify(before) !== original)
          throw new Error('Reducer mutated a frozen group snapshot');
        events++;
        eventKinds.add(
          event.type === 'vip'
            ? `vip:${event.action}`
            : event.type === 'player'
              ? event.gone
                ? 'player:gone'
                : 'player:presence'
              : event.type,
        );
        validate();
      };
      validate();
      // Cycling kinds once before random kinds guarantees every lifecycle category per trace.
      for (let step = 0; step < 40; step++) {
        now += random.int(0, 500);
        const kind = step < 10 ? step : random.int(0, 9);
        const id = random.pick(ids);
        switch (kind) {
          case 0:
            now = Math.max(now, state.phase.deadline ?? now);
            apply({
              type: 'timer',
              now,
              phaseId: state.phase.id,
              startedAt: state.phase.startedAt,
            });
            break;
          case 1:
            apply({
              type: 'timer',
              now,
              phaseId: 'obsolete',
              startedAt: state.phase.startedAt - 1,
            });
            break;
          case 2:
            apply({ type: 'vip', now, action: 'pause' });
            break;
          case 3:
            apply({ type: 'vip', now, action: 'resume' });
            break;
          case 4:
            apply({ type: 'vip', now, action: 'skip' });
            break;
          case 5:
            apply({ type: 'player', now, playerId: id, connected: random.chance(0.5) });
            break;
          case 6:
            apply({ type: 'player', now, playerId: id, connected: false, gone: 'left' });
            break;
          case 7:
            apply({ type: 'speech', now, key: 'unrequested', ms: -1 });
            break;
          case 8:
            apply({ type: 'speechStart', now, key: 'unrequested' });
            break;
          default: {
            const value: Input = {
              type: 'answer',
              questionId: state.questionIds[Math.max(0, state.index)] ?? 'obsolete',
              questionStartedAt: state.phase.startedAt - (random.chance(0.5) ? 1 : 0),
              index: random.int(0, 3),
            };
            if (!game.inputSchema.safeParse(value).success)
              throw new Error('Trace generated schema-invalid input');
            apply({ type: 'input', now, playerId: id, input: value });
          }
        }
      }
      // Real timer traversal proves adversarial disconnect/pause traces still reach a complete game.
      if (state.phase.paused) apply({ type: 'vip', action: 'resume', now });
      for (let steps = 0; steps < 150 && state.phase.id !== 'done'; steps++) {
        if (state.phase.id === 'question') {
          for (const player of players) {
            if (state.phase.id !== 'question') break;
            const value = game.bot.sampleInput(state, player.id, random, random.pick(SKILLS));
            if (value === null) continue;
            now = Math.max(now, state.phase.startedAt) + 100;
            apply({ type: 'input', now, playerId: player.id, input: value });
          }
        }
        if (state.phase.id === 'done') break;
        if (state.phase.deadline === null)
          throw new Error('Lifecycle drain hit a phase without a deadline');
        now = Math.max(now, state.phase.deadline);
        apply({ type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt });
      }
      if (state.phase.id !== 'done' || game.results(state) === null)
        throw new Error(`Group trace did not finish: ${mode}, seed ${seed}`);
    }
  expect([...phases]).toEqual(
    expect.arrayContaining(['intro', 'talk', 'question', 'reveal', 'podium', 'done']),
  );
  expect([...eventKinds]).toEqual(
    expect.arrayContaining([
      'timer',
      'input',
      'vip:pause',
      'vip:resume',
      'vip:skip',
      'player:presence',
      'player:gone',
      'speech',
      'speechStart',
    ]),
  );
  if (process.env.P02_WRITE_EVIDENCE === '1') {
    const media = resolve(import.meta.dirname, '../../../jobs/P02-quiz-rush-teams/media');
    mkdirSync(media, { recursive: true });
    writeFileSync(
      resolve(media, 'property-groups.json'),
      JSON.stringify(
        {
          modes: ['teams', 'tv-vote'],
          seedsPerMode: seeds.length,
          seeds,
          counts: '2..8',
          events,
          views,
          botChecks,
          maxStateBytes,
          phases: [...phases].sort(),
          eventKinds: [...eventKinds].sort(),
          checks: [
            'deep-frozen state and bot inputs',
            'double reducer deterministic replay',
            'finite bounded JSON round trips',
            'question/talk answer and decision secrecy',
            'unknown/prototype spectators',
            'future team/envelope/personal podium totals omitted',
            'schema-valid easy/normal/sharp bots',
            'lifecycle trace reaches done',
          ],
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
  }
}, 600_000);
