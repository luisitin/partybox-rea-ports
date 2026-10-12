// Discussion discovery uses public fixed membership and factual presence, never answer controls.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { testKit } from '@partybox/game-sdk/testing';
import { translate } from '@partybox/game-sdk/ui';
import { GroupTalk } from '../client/GroupTalk';
import { GroupRoster } from '../client/GroupParts';
import { STRINGS } from '../client/strings';
import { game } from '../server/index';
import { groupTalkMs } from '../server/pacing';
import { readMs, wordCount } from '../server/types';
import type { State } from '../server/types';
import { controllerView, tvView } from '../server/views';
import type { LightningControllerView } from '../server/views';

const kit = testKit(game, { t0: 100_000 });
const names = Array.from(
  { length: 8 },
  (_, i) => String(i + 1).padStart(2, '0') + ' Maximiliana Guadalupe Washington XIII',
);
const escaped = (text: string): string => renderToStaticMarkup(<>{text}</>);
function talking(): State {
  const initial = game.init({
    players: names.map((name, i) => ({
      id: 'p' + i,
      name,
      avatarId: 'fox',
      connected: true,
      canSeeTv: true,
    })),
    settings: {
      quizMode: 'teams',
      classicPack: 'sports',
      teamCount: 2,
      questions: 5,
      talkSeconds: 5,
    },
    seed: 41,
    now: 100_000,
  });
  return {
    ...kit.timer(initial),
    index: 0,
    questionIds: Array(5).fill('sports-09'),
    teams: [
      { id: 'team-1', name: 'Team 1', members: ['p0', 'p1', 'p2', 'p3'] },
      { id: 'team-2', name: 'Team 2', members: ['p4', 'p5', 'p6', 'p7'] },
    ],
    teamScores: { 'team-1': 0, 'team-2': 0 },
  };
}
function paint(view: LightningControllerView, stage = view.showStage): string {
  return renderToStaticMarkup(<GroupTalk view={view} showStage={stage} seconds={5} />);
}
function withPresence(): State {
  let state = talking();
  state = kit.player(state, 'p1', false, undefined, state.phase.startedAt + 100);
  state = kit.player(state, 'p2', false, 'left', state.phase.startedAt + 200);
  return kit.player(state, 'p2', true, undefined, state.phase.startedAt + 300);
}

describe('discussion discovers only the participating phone’s own fixed team', () => {
  it.each(['beside-tv', 'phone-only', 'remote'] as const)(
    '%s can recover teammates after missing intro',
    (surface) => {
      const original = talking();
      expect(names.every((name) => name.length === 40)).toBe(true);
      const state: State =
        surface === 'phone-only'
          ? { ...original, phoneOnly: true }
          : surface === 'remote'
            ? {
                ...original,
                players: { ...original.players, p0: { ...original.players.p0!, canSeeTv: false } },
              }
            : original;
      const view = controllerView(state, 'kahoot', 'p0');
      const html = paint(view);
      for (let i = 0; i < 4; i++) expect(html).toContain(escaped(names[i]!));
      for (let i = 4; i < 8; i++) expect(html).not.toContain(escaped(names[i]!));
      expect(html).toContain('Team 1');
      expect(html).not.toContain('Team 2');
      expect(html).not.toContain('<button');
      expect(view).not.toHaveProperty('answerStamp');
      expect(view).not.toHaveProperty('correctIndex');
      expect(view.group).not.toHaveProperty('decision');
      if (surface === 'beside-tv') {
        expect(html).not.toContain('<details');
        expect(html).not.toContain(escaped(view.question!.text));
      } else {
        expect(html).toMatch(/<details[^>]*data-team-discovery="true"/);
        expect(html).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/);
        expect(html).toContain('Team 1 · Teammates');
        expect(html).toContain('Back to question');
        expect(html).toContain('data-talk-question="true"');
        expect(html).toContain(escaped(view.question!.text));
      }
    },
  );
  it('does not fall back to all rosters when myTeamId is absent, invalid or mismatched', () => {
    const view = controllerView(talking(), 'kahoot', 'p0');
    const { myTeamId: _id, ...withoutId } = view.group!;
    for (const group of [
      withoutId,
      { ...withoutId, myTeamId: 'missing' },
      { ...withoutId, myTeamId: 'team-2' },
    ]) {
      const html = paint({ ...view, group }, true);
      for (const name of names) expect(html).not.toContain(escaped(name));
      expect(html).not.toContain('<details');
    }
    const missingMine = renderToStaticMarkup(
      <GroupRoster group={withoutId} players={view.players} mine presence />,
    );
    for (const name of names) expect(missingMine).not.toContain(escaped(name));
    expect(missingMine).toContain('data-count="0"');
  });
  it('labels temporary absence and reconnected permanent departure from distinct public facts', () => {
    const state = withPresence();
    expect(state.teams).toEqual(talking().teams);
    const view = controllerView(state, 'kahoot', 'p0');
    expect(view.players.find((p) => p.id === 'p2')?.connected).toBe(true);
    expect(view.group?.leftMembers).toEqual(['p2']);
    const html = paint(view, true);
    expect(html).toMatch(/data-group-member="p1"[\s\S]*?data-presence="away"/);
    expect(html).toMatch(/data-group-member="p2"[\s\S]*?data-presence="left"/);
    expect(html).toContain('Away');
    expect(html).toContain('Left');
    expect(html).not.toContain('<button');
    const missing = { ...view, players: view.players.filter((p) => p.id !== 'p3') };
    expect(paint(missing, true)).toContain('Unavailable');
    expect(translate(STRINGS, 'es', 'Away')).toBe('Ausente');
    expect(translate(STRINGS, 'es', 'Left')).toBe('Salió');
    expect(translate(STRINGS, 'es', 'Unavailable')).toBe('No disponible');
    expect(translate(STRINGS, 'es', '{team} · Teammates', { team: 'Team 1' })).toBe(
      'Team 1 · Compañeros',
    );
    expect(translate(STRINGS, 'es', 'Back to question')).toBe('Volver a la pregunta');
  });
  it('spectators and departed phones watch instead of being told to answer', () => {
    const state = withPresence();
    for (const id of ['audience', 'p2']) {
      const view = controllerView(state, 'kahoot', id);
      expect(view.participating).toBe(false);
      const html = paint(view);
      expect(html).toContain('Watching team discussion');
      expect(html).toContain('Players discuss now.');
      expect(html).not.toContain('Talk with your team');
      expect(html).not.toContain('Everyone answers when the clock ends.');
      expect(html).not.toContain('<details');
      expect(html).not.toContain('<button');
      for (const name of names) expect(html).not.toContain(escaped(name));
    }
    const room: State = { ...state, settings: { ...state.settings, quizMode: 'tv-vote' } };
    expect(paint(controllerView(room, 'kahoot', 'audience'))).toContain('Watching room discussion');
    expect(translate(STRINGS, 'es', 'Watching team discussion')).toBe(
      'Viendo la conversación del equipo',
    );
    expect(translate(STRINGS, 'es', 'Watching room discussion')).toBe(
      'Viendo la conversación de la sala',
    );
  });
  it('publishes departure metadata only for already public teams, never future final or podium rows', () => {
    const state = withPresence();
    expect(tvView(state, 'kahoot').group?.leftMembers).toEqual(['p2']);
    const final: State = {
      ...state,
      index: 4,
      phase: { id: 'reveal', startedAt: 200_000, deadline: 250_000 },
      teamScores: { 'team-1': 2000, 'team-2': 1000 },
    };
    expect(tvView(final, 'kahoot').group?.teams).toEqual([]);
    expect(tvView(final, 'kahoot').group).not.toHaveProperty('leftMembers');
    expect(controllerView(final, 'kahoot', 'p0').group).not.toHaveProperty('leftMembers');
    const podium: State = {
      ...final,
      phase: { id: 'podium', startedAt: 250_000, deadline: 300_000 },
      podiumRank: 2,
    };
    expect(tvView(podium, 'kahoot').group?.teams.map((team) => team.id)).toEqual(['team-2']);
    expect(tvView(podium, 'kahoot').group).not.toHaveProperty('leftMembers');
  });
  it('budgets the largest visible pane instead of summing the question and hidden roster', () => {
    const state = withPresence();
    // Actual sports-09 question/options contribute 12 words and four answer-shape marks.
    // Spanish open pane: header 4 + clock 1 + Back 4 + team 2 + four five-word
    // names + two presence markers + rule 8 + waiting status 7 = 48 words.
    // Closed question pane = 40, English open = 44, and both TV variants are shorter.
    expect(groupTalkMs(state)).toBe(readMs(48));
    expect(groupTalkMs(state)).toBeGreaterThan(groupTalkMs(talking()));
    const duplicatedQuestionAndRoster =
      wordCount(
        'Habla con tu equipo 5 Volver a la pregunta Team 1 ' +
          names.slice(0, 4).join(' ') +
          ' Ausente Salió Conversen ahora. Todos responden cuando termine el reloj. Las respuestas se abren después de conversar',
      ) + 16;
    expect(groupTalkMs(state)).toBeLessThan(readMs(duplicatedQuestionAndRoster));
  });
});
