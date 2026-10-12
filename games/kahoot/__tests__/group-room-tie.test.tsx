// Tied room answers are explained only from closed, public aggregate votes.
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import type { PlayerInfo } from '@partybox/game-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { GroupDecision, GroupVerdict } from '../client/GroupParts';
import { STRINGS } from '../client/strings';
import { game } from '../server/index';
import { questionById } from '../server/content';
import type { GroupMode, State } from '../server/types';
import { input, phone, timer, tv } from './helpers';

const T0 = 2_000_000_000_000;
const CUE = 'Tie — random choice among tied answers';
const PLAYERS: PlayerInfo[] = Array.from({ length: 8 }, (_, i) => ({
  id: 'tie-seat-' + (i + 1),
  name: 'Voter ' + (i + 1),
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
afterEach(() => vi.useRealTimers());
function start(seed = 23, mode: GroupMode = 'tv-vote'): State {
  return game.init({
    players: PLAYERS,
    seed,
    now: T0,
    settings: {
      quizMode: mode,
      classicPack: 'sports',
      questions: 5,
      answerSeconds: 10,
      talkSeconds: 5,
      teamCount: 4,
    },
  });
}
function cast(state: State, id: string, choice: number, delay: number): State {
  const stamp = phone(state, id).answerStamp;
  if (!stamp) throw new Error('Room votes need the current canonical question stamp');
  return input(
    state,
    id,
    { type: 'answer', ...stamp, index: choice },
    state.phase.startedAt + delay,
  );
}
function voted(seed: number, tied: boolean, mode: GroupMode = 'tv-vote'): State {
  let state = timer(timer(start(seed, mode)));
  const q = questionById(state.questionIds[state.index]!, state.contentLang);
  if (!q) throw new Error('Fixture needs an actual authored question');
  for (const [i, player] of PLAYERS.entries()) {
    const choice = i >= (tied ? 4 : 5) ? (q.answerIndex + 1) % 4 : q.answerIndex;
    state = cast(state, player.id, choice, 300 + i * 20);
  }
  if (state.phase.id === 'question') state = timer(state);
  return state;
}
function tiedVerdict(correct: boolean): State {
  // Both verdict fixtures come from the real seeded tiebreaker.
  for (let seed = 1; seed <= 64; seed++) {
    const state = voted(seed, true);
    if (phone(state, PLAYERS[0]!.id).outcome?.correct === correct) return state;
  }
  throw new Error('The fixed seed range must exercise both tied room verdicts');
}
function paint(
  state: State,
  surface: 'tv' | 'phone' | 'stage' | 'spectator',
  id = PLAYERS[0]!.id,
): string {
  const spectator = surface === 'spectator';
  const staged = surface === 'stage' || spectator;
  const rendered = { ...state, phoneOnly: staged };
  const playerId = spectator ? 'audience' : id;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime((tv(rendered).revealAt ?? state.phase.startedAt) + 1_000);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={0}>
      {surface === 'tv' ? (
        <Tv view={{ ...tv(rendered), vip: null }} />
      ) : (
        <PhoneOnlyProvider value={staged}>
          <Controller
            view={{ ...phone(rendered, playerId), vip: null }}
            me={state.players[playerId] ?? { id: playerId, name: 'Audience', avatarId: 'owl' }}
            send={() => undefined}
          />
        </PhoneOnlyProvider>
      )}
    </ServerClockProvider>,
  );
}

describe('closed room vote tie explanations', () => {
  it.each([true, false])(
    'explains a tied shared verdict (correct=%s) once per surface',
    (correct) => {
      const state = tiedVerdict(correct);
      const decision = tv(state).group?.decision;
      expect(decision).toBeDefined();
      const oppositeVoter = PLAYERS.find((player) => state.picks[player.id]?.index !== decision);
      if (!oppositeVoter) throw new Error('Tie fixture needs a vote for the unchosen answer');
      expect(phone(state, oppositeVoter.id).outcome?.correct).toBe(correct);
      for (const surface of ['tv', 'phone', 'stage', 'spectator'] as const) {
        const html = paint(state, surface, oppositeVoter.id);
        expect(html.match(/data-room-tie="true"/g)).toHaveLength(1);
        expect(html).toContain(CUE);
        if (surface === 'phone' || surface === 'stage') {
          expect(html).toContain(correct ? 'The room got it right!' : 'The room got it wrong');
          expect(html).toContain('Your vote:');
          expect(html).not.toContain('personal points');
        }
      }
    },
  );

  it('omits the cue for a clear result, no votes, or team scoring', () => {
    const empty = timer(timer(timer(start())));
    expect(tv(empty).group).not.toHaveProperty('decision');
    expect(paint(empty, 'tv')).toContain('No room answer — nobody voted');
    for (const state of [voted(23, false), empty, voted(23, true, 'teams')])
      for (const surface of ['tv', 'phone', 'stage', 'spectator'] as const)
        expect(paint(state, surface)).not.toContain('data-room-tie');
  });

  it('does not expose a tie before reveal even if closed aggregates are supplied accidentally', () => {
    const talking = timer(start());
    const answering = timer(talking);
    for (const state of [talking, answering]) {
      expect(tv(state)).not.toHaveProperty('answerDistribution');
      expect(tv(state).group).not.toHaveProperty('decision');
      expect(phone(state, PLAYERS[0]!.id)).not.toHaveProperty('answerDistribution');
      for (const surface of ['tv', 'phone', 'stage', 'spectator'] as const)
        expect(paint(state, surface)).not.toContain('data-room-tie');
      const stage = tv(state);
      const own = phone(state, PLAYERS[0]!.id);
      const group = stage.group;
      if (!group) throw new Error('Room mode needs its public mode identity');
      const accidental = {
        group: { ...group, decision: 0 },
        answerDistribution: { counts: [4, 4, 0, 0], missed: 0 },
      };
      expect(renderToStaticMarkup(<GroupDecision view={{ ...stage, ...accidental }} />)).toBe('');
      expect(
        renderToStaticMarkup(<GroupVerdict view={{ ...own, ...accidental }} besideTv />),
      ).not.toContain('data-room-tie');
    }
  });

  it('provides Spanish copy without adding voter identities to the explanation', () => {
    expect(STRINGS.es?.[CUE]).toBe('Empate — elección al azar entre respuestas empatadas');
    const html = paint(tiedVerdict(true), 'phone');
    const cue = html.match(/<p data-room-tie="true">(.*?)<\/p>/)?.[1];
    expect(cue).toBe(CUE);
    for (const player of PLAYERS) expect(cue).not.toContain(player.name);
  });
});
