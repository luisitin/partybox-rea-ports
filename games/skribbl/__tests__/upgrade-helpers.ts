import { vi } from 'vitest';
import {
  applyVip,
  buildResults,
  controllerEnvelope,
  createRng,
  enterPhase,
  envelope,
  isTimerFor,
  onPlayerEvent,
  seedRng,
  z,
} from '@partybox/game-sdk';
import type {
  GameDefinition,
  GameEvent,
  GameStateBase,
  InitContext,
  RecapContext,
  Settings,
} from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game as live } from '../server/index';
import { createSkribblUpgrade } from '../server/upgrade';
interface BaseState extends GameStateBase {
  units: number;
  settings: Settings;
  secret: string;
}
const baseInput = z.object({ type: z.literal('add'), amount: z.number().int().min(1).max(5) });
export type BaseInput = z.infer<typeof baseInput>;
type BaseTv = ReturnType<typeof baseTv>;
type BaseController = ReturnType<typeof baseController>;
function baseTv(state: BaseState) {
  return { ...envelope(state, 'existing-game'), units: state.units };
}
function baseController(state: BaseState, id: string) {
  return { ...controllerEnvelope(state, 'existing-game', id), units: state.units };
}

/** Original injected toy game: tests exercise the adapter without importing private game code. */
export function upgradeFixture() {
  const speech = [{ key: 'existing-reading', voice: 'test', parts: [{ text: 'Keep going.' }] }];
  const hooks = {
    init: vi.fn((ctx: InitContext): BaseState => ({
      phase: { id: 'work', startedAt: ctx.now, deadline: ctx.now + 100 },
      rng: seedRng(ctx.seed),
      players: Object.fromEntries(ctx.players.map((player) => [player.id, player])),
      units: 0,
      secret: 'Only the selected game owns this private field.',
      settings: ctx.settings,
    })),
    reduce: vi.fn((state: BaseState, event: GameEvent<BaseInput>): BaseState => {
      const vip = applyVip(state, event, {
        skip: (s, now) => enterPhase(s, 'done', now, null),
        end: (s, now) => enterPhase(s, 'done', now, null),
      });
      if (vip) return vip;
      if (event.type === 'player') return onPlayerEvent(state, event);
      if (state.phase.paused) return state;
      if (isTimerFor(state, event)) return enterPhase(state, 'done', event.now, null);
      return event.type === 'input'
        ? { ...state, units: state.units + event.input.amount, rng: seedRng(event.input.amount) }
        : state;
    }),
    tvView: vi.fn(baseTv),
    controllerView: vi.fn(baseController),
    results: vi.fn((state: BaseState) =>
      state.phase.id === 'done'
        ? buildResults(state, Object.fromEntries(Object.keys(state.players).map((id) => [id, 0])))
        : null,
    ),
    sampleInput: vi.fn(
      (
        _state: BaseState,
        _id: string,
        rng: ReturnType<typeof createRng>,
        _skill?: 'easy' | 'normal' | 'sharp',
      ): BaseInput | null => ({ type: 'add', amount: rng.int(1, 5) }),
    ),
    ask: vi.fn((_state: BaseState, _id: string) => ({ prompt: 'An original test prompt.' })),
    answer: vi.fn((_state: BaseState, _id: string, _reply: string): BaseInput | null => ({
      type: 'add',
      amount: 2,
    })),
    recap: vi.fn((state: BaseState, _ctx: RecapContext<BaseState>) => ({
      markdown: `${state.units} units`,
    })),
    speech: vi.fn((_state: BaseState) => speech),
    speechCatalog: vi.fn(() => speech),
    options: vi.fn((settings: Settings) => [String(settings.drawSeconds ?? 90)]),
  };
  const base: GameDefinition<BaseState, BaseInput, BaseTv, BaseController> = {
    manifest: {
      ...live.manifest,
      id: 'existing-game',
      name: 'Existing game',
      minPlayers: 3,
      estimatedMinutes: 20,
      howToPlay: ['Choose an action.', 'Add units on your phone.', 'Keep the existing show.'],
      contentLangs: ['en', 'es'],
      maxInputBytes: 6_144,
      settings: [
        {
          key: 'drawSeconds',
          label: 'Existing drawing time',
          type: 'number',
          default: 90,
          min: 30,
          max: 120,
        },
        { key: 'baseSetting', label: 'Existing preference', type: 'boolean', default: true },
      ],
    },
    phases: ['work', 'done'],
    inputSchema: baseInput,
    init: hooks.init,
    reduce: hooks.reduce,
    tvView: hooks.tvView,
    controllerView: hooks.controllerView,
    results: hooks.results,
    recap: hooks.recap,
    speech: hooks.speech,
    speechCatalog: hooks.speechCatalog,
    stagePick: { options: hooks.options },
    bot: { sampleInput: hooks.sampleInput, llm: { ask: hooks.ask, answer: hooks.answer } },
  };
  const ctx: InitContext = {
    players: testPlayers(4),
    settings: { drawSeconds: 110, baseSetting: false },
    now: 10_000,
    seed: 17,
    contentLang: 'en',
    presence: { mode: 'together', phoneOnly: true },
  };
  return { base, hooks, ctx, upgrade: createSkribblUpgrade(base) };
}
