// ADR-087: what the TV and the phones see while a minigame runs. Pure and total: never throws, and
// the wrapped game's own view is passed through untouched (it already hides what it must).
import type { AnyGameDefinition } from '@partybox/shared';
import type {
  MinigameControllerView,
  MinigamePlayerView,
  MinigameState,
  MinigameTeamView,
  MinigameView,
} from './types';

const SIDES = [
  { id: 'a', name: 'Sun', mark: '▲', color: 'var(--pb-team-sun)' },
  { id: 'b', name: 'Moon', mark: '●', color: 'var(--pb-team-moon)' },
] as const;

const sideOf = (mg: MinigameState, id: string): 'a' | 'b' | null => {
  const at = mg.teams.findIndex((t) => t.includes(id));
  return at === 0 ? 'a' : at === 1 ? 'b' : null;
};

function teamViews(mg: MinigameState): MinigameTeamView[] {
  if (mg.mode === 'ffa') return [];
  return mg.teams
    .slice(0, 2)
    .map((members, i) => ({ ...(SIDES[i] ?? SIDES[0]), members: [...members] }));
}

function playerViews(mg: MinigameState): MinigamePlayerView[] {
  return mg.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatarId: p.avatarId,
    connected: p.connected,
    bot: p.bot === true,
    ready: mg.ready.includes(p.id),
    team: sideOf(mg, p.id),
  }));
}

function innerOf(game: AnyGameDefinition, state: unknown, playerId: string | null): unknown {
  if (!state) return null;
  try {
    return playerId === null ? game.tvView(state) : game.controllerView(state, playerId);
  } catch {
    return null;
  }
}

function base(game: AnyGameDefinition, mg: MinigameState): MinigameView {
  const sp = game.manifest.minigame;
  return {
    gameId: mg.gameId,
    name: game.manifest.name,
    icon: game.manifest.icon,
    mode: mg.mode,
    stage: mg.stage,
    teams: teamViews(mg),
    players: playerViews(mg),
    help: mg.help,
    hasDemo: sp?.practice === true,
    howTo: sp?.howTo ?? ['', ''],
    controls: sp?.controls ?? [],
    // In play the chip counts to the nominal end; the hard cap behind it is the wrapper's own.
    stageEnds:
      mg.stage === 'play' && mg.playStartedAt !== null && sp
        ? mg.playStartedAt + sp.seconds * 1000
        : mg.stageEnds,
    prize: mg.prize,
    inner: null,
    demo: null,
    result: mg.result,
  };
}

/** The shared screen: the card, the howto with its demo, the count, the game, the result. */
export function minigameTv(game: AnyGameDefinition, mg: MinigameState): MinigameView {
  const v = base(game, mg);
  if (mg.stage === 'play' || mg.stage === 'finish') v.inner = innerOf(game, mg.inner, null);
  if (mg.stage === 'howto') v.demo = innerOf(game, mg.demo, null);
  return v;
}

/** One phone's screen. A player the minigame does not know gets the TV's view with `me` empty. */
export function minigameController(
  game: AnyGameDefinition,
  mg: MinigameState,
  playerId: string,
): MinigameControllerView {
  const v = base(game, mg);
  const known = mg.players.some((p) => p.id === playerId);
  if (known && (mg.stage === 'play' || mg.stage === 'finish'))
    v.inner = innerOf(game, mg.inner, playerId);
  if (known && mg.stage === 'howto') v.demo = innerOf(game, mg.demo, playerId);
  return {
    ...v,
    me: { id: playerId, ready: mg.ready.includes(playerId), team: sideOf(mg, playerId) },
  };
}
