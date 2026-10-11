// View-building helpers: the envelope every view must carry (docs/GAME_CONTRACT.md "Views").
import type {
  ControllerView,
  GameStateBase,
  PlayerStatus,
  ViewEnvelope,
  ViewPlayer,
} from '@partybox/shared';
import { compareCodeUnits } from './compare';

export interface EnvelopeOptions {
  /** Per-player chip state; defaults to 'active'. */
  statusOf?: (playerId: string) => PlayerStatus;
  /** Shown on chips when provided. */
  scores?: Record<string, number>;
  /** Audit #13 / I-774 B: what the VIP's Skip / Next does now, in words (`vipSkipLabel`). */
  skipLabel?: string | undefined;
  /** T-0147: a new screen within the same phase id (`screen`), e.g. the card a reveal is on. */
  screen?: string | undefined;
  /**
   * The countdown the shells draw (`deadline`), when it is not the phase's own deadline. A phase that
   * re-arms a short beat to judge its board (a minigame's tick) passes its round's end here, so the
   * shells count the round, not the beat ("HURRY! 1 s" on every tick). Undefined: `phase.deadline`.
   */
  deadline?: number | null | undefined;
  /**
   * The phase instance the countdown belongs to (`phaseAt`), when the engine's `startedAt` moves on beats
   * the countdown must not restart on: a shell starts a fresh bar whenever `phaseAt` changes. A wrapper that
   * re-arms its own phase on every inner beat passes a stamp taken once per stage, never the stage's end: a pause
   * moves the end on, and a bar keyed on the end would restart at every resume.
   * Undefined: `phase.beatAt` when a VIP skip while paused named one (ADR-101), else `phase.startedAt`.
   */
  phaseAt?: number | undefined;
}

/** `players[]` for the envelope, in a stable order (by id) so TVs agree. */
export function viewPlayers(state: GameStateBase, options: EnvelopeOptions = {}): ViewPlayer[] {
  return Object.values(state.players)
    .sort((a, b) => compareCodeUnits(a.id, b.id))
    .map((p) => {
      const player: ViewPlayer = {
        id: p.id,
        name: p.name,
        avatarId: p.avatarId,
        connected: p.connected,
        status: options.statusOf ? options.statusOf(p.id) : 'active',
      };
      if (options.scores) player.score = options.scores[p.id] ?? 0;
      return player;
    });
}

/** The common part of a TV view. Spread your own fields after it. */
export function envelope(
  state: GameStateBase,
  gameId: string,
  options: EnvelopeOptions = {},
): ViewEnvelope {
  return {
    gameId,
    phaseId: state.phase.id,
    phaseAt: options.phaseAt ?? state.phase.beatAt ?? state.phase.startedAt,
    deadline: options.deadline !== undefined ? options.deadline : state.phase.deadline,
    paused: state.phase.paused !== undefined,
    ...(state.phase.paused ? { clockHeldAt: state.phase.paused.at } : {}),
    players: viewPlayers(state, options),
    ...(options.skipLabel ? { vipSkipLabel: options.skipLabel } : {}),
    ...(options.screen !== undefined ? { screen: options.screen } : {}),
  };
}

/** The common part of a controller view: envelope + `me`. Unknown ids are spectators. */
export function controllerEnvelope(
  state: GameStateBase,
  gameId: string,
  playerId: string,
  options: EnvelopeOptions = {},
): ControllerView {
  return {
    ...envelope(state, gameId, options),
    me: { id: playerId, role: Object.hasOwn(state.players, playerId) ? 'player' : 'spectator' },
  };
}

/** One reader line a view hands the speaking device: play `url` at server time `at` (`ms` long),
 *  once per phase instance (`useSay` in `@partybox/game-sdk/ui`). */
export interface SayItem {
  key: string;
  url: string;
  at: number;
  ms: number;
}
