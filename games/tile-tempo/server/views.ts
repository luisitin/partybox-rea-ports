// Public race statistics; the unrevealed sequence and PRNG never leave the server.
import { controllerEnvelope, envelope, hasPlayer } from '@partybox/game-sdk';
import type { ControllerView, PlayerStatus, TvView } from '@partybox/game-sdk';
import { scoresOf } from './scoring';
import type { State } from './types';

export interface Standing {
  id: string;
  name: string;
  avatarId: string;
  connected: boolean;
  tiles: number;
  speed: number;
  out: boolean;
  rank: number;
}
interface RaceView {
  began: number;
  endsAt: number;
  elapsed: number;
  scores: Record<string, number>;
  standings: Standing[];
}
export interface TileTempoTvView extends TvView, RaceView {}
export interface TileTempoControllerView extends ControllerView, RaceView {
  row: number;
  notes: number[];
  alive: boolean;
  rank: number | null;
  wrongColumn: number | null;
  phoneStage: boolean;
}
function statusOf(state: State): (id: string) => PlayerStatus {
  return (id) => (state.phase.id === 'play' && !state.runs[id]?.out ? 'active' : 'waiting');
}
function raceView(state: State): RaceView {
  const scores = scoresOf(state);
  return {
    began: state.began,
    endsAt: state.endsAt,
    elapsed: state.elapsed,
    scores,
    standings: Object.values(state.players).map((player): Standing => {
      const run = state.runs[player.id]!;
      // A failed run's speed freezes at the last tap; idle clocks never create NaN.
      const ms = run.out && run.lastAt !== null ? run.lastAt - state.began : state.elapsed;
      return {
        id: player.id,
        name: player.name,
        avatarId: player.avatarId,
        connected: player.connected,
        tiles: run.tiles,
        speed: ms > 0 ? Math.round((run.tiles * 10_000) / ms) / 10 : 0,
        out: run.out,
        rank: 1 + Object.values(scores).filter((n) => n > run.tiles).length,
      };
    }),
  };
}
function deadline(state: State): number | null {
  return state.phase.id === 'play' ? state.endsAt : state.phase.deadline;
}
export function tvView(state: State): TileTempoTvView {
  return {
    ...envelope(state, 'tile-tempo', { statusOf: statusOf(state) }),
    timerMode: 'hidden',
    deadline: deadline(state),
    ...raceView(state),
  };
}
export function controllerView(state: State, id: string): TileTempoControllerView {
  const player = hasPlayer(state, id);
  const run = player ? state.runs[id] : undefined;
  const alive = !!run && !run.out;
  const shared = raceView(state);
  return {
    ...controllerEnvelope(state, 'tile-tempo', id, { statusOf: statusOf(state) }),
    deadline: deadline(state),
    timerMode: 'hidden',
    ...shared,
    row: run?.tiles ?? 0,
    notes:
      player && alive && (state.phase.id === 'ready' || state.phase.id === 'play')
        ? state.sequence.slice(run!.tiles, run!.tiles + 4)
        : [],
    alive,
    rank: player ? shared.standings.find((p) => p.id === id)!.rank : null,
    wrongColumn: run?.wrongColumn ?? null,
    phoneStage: state.phoneOnly || (player && state.players[id]?.canSeeTv === false),
  };
}
