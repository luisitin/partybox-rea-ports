// Actual group reducers and filtered views drive SSR; browser fit and tap coverage are separate checks.
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import type { PlayerInfo } from '@partybox/game-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { tv as tvModule } from '../client/tv-entry';
import { classicQuestionById } from '../server/classic';
import { game } from '../server/index';
import type { GroupMode, State } from '../server/types';
import { input, phone, timer, tv, vip } from './helpers';

const T0 = 2_000_000_000_000;
const SHAPES = ['Triangle', 'Diamond', 'Circle', 'Square'];
const PLAYERS: PlayerInfo[] = Array.from({ length: 8 }, (_, index) => ({
  id: `group-seat-${index + 1}`,
  name: `Player ${index + 1} Willow`,
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
const escape = (text: string): string => renderToStaticMarkup(<>{text}</>);
const buttons = (html: string): string[] => html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
afterEach(() => vi.useRealTimers());

function start(mode: GroupMode, phoneOnly = false): State {
  return game.init({
    players: PLAYERS,
    settings: {
      quizMode: mode,
      classicPack: 'general',
      questions: 5,
      answerSeconds: 10,
      talkSeconds: 5,
      teamCount: 4,
    },
    seed: 23,
    now: T0,
    presence: { mode: 'together', phoneOnly },
  });
}

function paint(
  state: State,
  surface: 'tv' | 'phone' | 'stage',
  id = PLAYERS[0]!.id,
  now = state.phase.startedAt + 1_000,
  vipSkip = false,
): string {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  const rendered = surface === 'stage' ? { ...state, phoneOnly: true } : state;
  const view = phone(rendered, id);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={0}>
      {surface === 'tv' ? (
        <Tv view={{ ...tv(rendered), vip: null }} />
      ) : (
        <PhoneOnlyProvider value={surface === 'stage'}>
          <Controller
            view={{ ...view, vip: null }}
            me={state.players[id] ?? { id, name: 'Audience', avatarId: 'owl' }}
            send={() => undefined}
            skip={vipSkip ? () => undefined : undefined}
          />
        </PhoneOnlyProvider>
      )}
    </ServerClockProvider>,
  );
}

function answer(state: State, id: string, index: number, delay: number): State {
  const stamp = phone(state, id).answerStamp;
  if (!stamp) throw new Error('Group question must retain the canonical answer stamp');
  return input(state, id, { type: 'answer', ...stamp, index }, state.phase.startedAt + delay);
}

function question(state: State): NonNullable<ReturnType<typeof classicQuestionById>> {
  const q = classicQuestionById(state.questionIds[state.index]!);
  if (!q) throw new Error('Group play must draw the current canonical authored pack');
  return q;
}

describe.each(['teams', 'tv-vote'] as const)('%s discussion and answer screens', (mode) => {
  it('names the fixed roster, shows public discussion on remote and spectator phones, and offers no discussion input', () => {
    const initial = start(mode);
    const group = tv(initial).group;
    if (!group) throw new Error('Group mode must expose its fixed public roster');
    const intro = paint(initial, 'tv');
    for (const team of group.teams) expect(intro).toContain(escape(team.name));
    for (const player of PLAYERS) expect(intro).toContain(escape(player.name));
    const talking = timer(initial);
    expect(talking.phase.id).toBe('talk');
    const q = tv(talking).question;
    if (!q) throw new Error('Discussion TV must show its upcoming question');
    expect(tv(talking)).not.toHaveProperty('correctIndex');
    expect(phone(talking, PLAYERS[0]!.id)).not.toHaveProperty('answerStamp');
    const privatePhone = paint(talking, 'phone');
    expect(privatePhone).toContain(
      mode === 'teams' ? 'Talk with your team' : 'Discuss the room answer',
    );
    expect(privatePhone).toContain('role="timer"');
    expect(privatePhone).not.toContain(escape(q.text));
    expect(buttons(privatePhone)).toHaveLength(0);
    const ownTeam = phone(talking, PLAYERS[0]!.id).group?.teams.find(
      (team) => team.id === phone(talking, PLAYERS[0]!.id).group?.myTeamId,
    );
    if (!ownTeam) throw new Error('Participants need their team identity during discussion');
    expect(privatePhone).toContain(escape(ownTeam.name));
    for (const member of ownTeam.members) {
      if (mode === 'teams') expect(privatePhone).toContain(escape(talking.players[member]!.name));
      else expect(privatePhone).not.toContain(escape(talking.players[member]!.name));
    }
    const remote = {
      ...talking,
      players: {
        ...talking.players,
        [PLAYERS[0]!.id]: { ...talking.players[PLAYERS[0]!.id]!, canSeeTv: false },
      },
    };
    for (const [html, ownRoster] of [
      [paint(talking, 'tv'), false],
      [paint(talking, 'stage'), mode === 'teams'],
      [paint(remote, 'phone'), mode === 'teams'],
      [paint(talking, 'phone', 'audience'), false],
    ] as const) {
      expect(html).toContain(escape(q.text));
      for (const choice of q.choices) expect(html).toContain(escape(choice));
      for (const player of PLAYERS) {
        if (ownRoster && ownTeam.members.includes(player.id))
          expect(html).toContain(escape(player.name));
        else expect(html).not.toContain(escape(player.name));
      }
      expect(buttons(html)).toHaveLength(0);
      expect(html).not.toMatch(/Look at the TV|Tap your answer|Tap your vote/);
    }
    expect(tvModule.stripHidden).toContain('talk');
  });

  it('keeps a pause-aware TV countdown left, the real response count right, and four choices below', () => {
    const talking = timer(start(mode));
    const discussion = paint(talking, 'tv');
    expect(discussion).toContain('data-group-question="talk"');
    expect(discussion).toMatch(/data-position="left"[\s\S]*?role="timer"/);
    expect(discussion).toMatch(
      /data-position="right"[\s\S]*?aria-label="0 of 8 (?:answered|voted)"/,
    );
    expect(discussion).toContain('data-position="bottom"');
    expect(discussion).not.toContain('aria-label="Teams and players"');
    let answering = timer(talking);
    answering = answer(answering, PLAYERS[0]!.id, 0, 300);
    const live = paint(answering, 'tv');
    expect(live).toContain('data-group-question="question"');
    expect(live).toContain(`aria-label="1 of 8 ${mode === 'tv-vote' ? 'voted' : 'answered'}"`);
    const paused = vip(answering, 'pause', answering.phase.startedAt + 500);
    expect(paint(paused, 'tv')).toMatch(
      /data-paused="true"[^>]*role="timer"[^>]*aria-label="Paused"/,
    );
    expect(tv(paused).timerMode).toBe('hidden');
  });

  it('retains four shape controls, acknowledges the actual vote, and disables pause and disconnected answers', () => {
    let state = timer(timer(start(mode)));
    expect(state.phase.id).toBe('question');
    const q = tv(state).question;
    if (!q) throw new Error('Group question missing');
    const html = paint(state, 'phone');
    expect(buttons(html)).toHaveLength(4);
    for (const shape of SHAPES) expect(html).toContain(`aria-label="${shape}"`);
    expect(html).not.toContain(escape(q.text));
    expect(phone(state, PLAYERS[0]!.id).answerStamp).toMatchObject({
      questionId: q.id,
      questionStartedAt: state.phase.startedAt,
    });
    state = answer(state, PLAYERS[0]!.id, 2, 400);
    const locked = paint(state, 'phone');
    expect(locked).toContain(mode === 'tv-vote' ? 'Your vote is locked in' : 'Answer locked in');
    if (mode === 'tv-vote') expect(locked).not.toContain('Answer locked in');
    expect(buttons(locked).every((button) => button.includes('disabled'))).toBe(true);
    const paused = vip(state, 'pause', state.phase.startedAt + 500);
    const disconnected = {
      ...state,
      players: {
        ...state.players,
        [PLAYERS[1]!.id]: { ...state.players[PLAYERS[1]!.id]!, connected: false },
      },
    };
    expect(
      buttons(paint(paused, 'phone', PLAYERS[1]!.id)).every((button) =>
        button.includes('disabled'),
      ),
    ).toBe(true);
    const offline = paint(disconnected, 'phone', PLAYERS[1]!.id);
    expect(offline).toContain('Disconnected. Waiting to reconnect.');
    expect(buttons(offline).every((button) => button.includes('disabled'))).toBe(true);
    const audience = paint(state, 'phone', 'audience');
    expect(audience).toContain(escape(q.text));
    expect(buttons(audience)).toHaveLength(0);
  });
});

describe('group results preserve honest scoring', () => {
  it('centers native-like team receipts with equal public footer scores for correct and incorrect teammates', () => {
    let state = timer(timer(start('teams')));
    const correct = question(state).answerIndex;
    const initialTeam = phone(state, PLAYERS[0]!.id).group?.teams.find((team) =>
      team.members.includes(PLAYERS[0]!.id),
    );
    const teammate = initialTeam?.members.find((id) => id !== PLAYERS[0]!.id);
    if (!teammate) throw new Error('The team receipt needs two teammates');
    state = answer(state, PLAYERS[0]!.id, correct, 300);
    state = answer(state, teammate, (correct + 1) % 4, 400);
    state = timer(state);
    const boardAt = tv(state).leaderboardAt! + 1;
    const team = phone(state, PLAYERS[0]!.id).group?.teams.find((row) =>
      row.members.includes(PLAYERS[0]!.id),
    );
    if (!team) throw new Error('The public team receipt is missing');
    const html = paint(state, 'phone', PLAYERS[0]!.id, boardAt, true);
    const wrong = paint(state, 'phone', teammate, boardAt);
    expect(html).toContain('data-beside-tv="true"');
    expect(html).toContain('Team results');
    expect(html).toContain('Your team is in place');
    expect(html).toContain(escape(PLAYERS[0]!.name));
    expect(html).toContain('Next question');
    expect(wrong).toContain('Wrong');
    const footerOf = (markup: string): string => {
      const footer = markup.match(/<div[^>]*data-group-player-bar="true"[\s\S]*?<\/div>/)?.[0];
      if (!footer) throw new Error('Participating beside-TV receipt needs an identity footer');
      return footer;
    };
    for (const footer of [footerOf(html), footerOf(wrong)]) {
      expect(footer).toContain(`aria-label="${team.score} team points"`);
      expect(footer).not.toContain('Team score after the podium');
    }
    expect(phone(state, PLAYERS[0]!.id).outcome?.delta).toBeGreaterThan(
      phone(state, teammate).outcome?.delta ?? 0,
    );
    for (const staged of [
      paint(state, 'stage', PLAYERS[0]!.id, boardAt),
      paint(state, 'phone', 'audience', boardAt),
    ]) {
      expect(staged).not.toContain('data-beside-tv="true"');
      expect(staged).not.toContain('data-group-player-bar="true"');
      expect(staged).not.toContain('Team results');
    }
  });
  it('shows a room success even when this player voted for a different answer', () => {
    let state = timer(timer(start('tv-vote')));
    const q = question(state);
    const wrong = (q.answerIndex + 1) % 4;
    state = answer(state, PLAYERS[0]!.id, wrong, 300);
    for (const player of PLAYERS.slice(1)) state = answer(state, player.id, q.answerIndex, 500);
    if (state.phase.id === 'question') state = timer(state);
    expect(state.phase.id).toBe('reveal');
    expect(tv(state).group?.decision).toBe(q.answerIndex);
    expect(phone(state, PLAYERS[0]!.id).myPickIndex).toBe(wrong);
    const own = paint(state, 'phone');
    expect(own).toContain('The room got it right!');
    expect(own).toContain(`Your vote: ${SHAPES[wrong]}`);
    expect(own).not.toContain('personal points');
    for (const html of [paint(state, 'tv'), paint(state, 'stage', 'audience')]) {
      expect(html).toContain('Room answer:');
      expect(html).toContain(escape(q.choices[q.answerIndex]!));
      expect(html).toContain('aria-label="Vote distribution"');
      expect(html).not.toContain('aria-label="Answer distribution"');
    }
  });

  it('separates personal contribution from the averaged team gain and confirms missing votes', () => {
    let state = timer(timer(start('teams')));
    const q = question(state);
    const group = phone(state, PLAYERS[0]!.id).group;
    const ownTeam = group?.teams.find((team) => team.id === group.myTeamId);
    if (!ownTeam) throw new Error('Team roster missing');
    state = answer(state, PLAYERS[0]!.id, q.answerIndex, 300);
    state = timer(state);
    const own = phone(state, PLAYERS[0]!.id);
    const team = own.group?.teams.find((candidate) => candidate.id === own.group?.myTeamId);
    if (!team || !own.outcome) throw new Error('Team reveal receipt missing');
    expect(team.gained).toBeLessThan(own.outcome.delta);
    const html = paint(state, 'phone');
    expect(html).toContain(`+${own.outcome.delta} personal points`);
    expect(html).toContain(`+${team.gained} points`);
    expect(html).toContain('Team points average players who stayed or answered');
    expect(team.correctPercent).toBe(50);
    expect(html).toMatch(
      /<meter\b[^>]*min="0"[^>]*max="100"[^>]*value="50"[^>]*aria-label="50% correct"/,
    );
    const board = paint(state, 'tv', PLAYERS[0]!.id, tv(state).leaderboardAt! + 1);
    expect(board).toContain('data-group-scoreboard="vertical"');
    for (const player of PLAYERS) expect(board).toContain(escape(player.name));
    expect(board).toContain(escape(team.name));
    const idle = timer(timer(timer(start('tv-vote'))));
    expect(idle.phase.id).toBe('reveal');
    expect(paint(idle, 'tv')).toContain('No room answer — nobody voted');
    expect(paint(idle, 'phone')).toContain('You did not vote');
  });
});

describe('team podium only reveals occupied tiers', () => {
  it('omits future team names and totals on every phone, then renders all final teams', () => {
    let state = start('teams');
    const roster = tv(state).group?.teams;
    if (!roster || roster.length !== 4) throw new Error('Test requires four fixed teams');
    let lastReveal: State | undefined;
    for (let steps = 0; steps < 100 && state.phase.id !== 'podium'; steps++) {
      if (state.phase.id === 'question') {
        const correct = question(state).answerIndex;
        for (const [index, team] of roster.entries()) {
          for (const id of team.members) state = answer(state, id, correct, 300 + index * 500);
        }
        if (state.phase.id === 'question') state = timer(state);
        if (tv(state).round?.last) lastReveal = state;
      } else state = timer(state);
    }
    expect(state.phase.id).toBe('podium');
    if (!lastReveal) throw new Error('Final reveal missing');
    expect(tv(lastReveal).group?.teams).toHaveLength(0);
    for (const surface of ['tv', 'phone', 'stage'] as const) {
      const html = paint(lastReveal, surface);
      for (const team of roster) expect(html).not.toContain(escape(team.name));
      expect(html).not.toContain('<meter');
      if (surface === 'phone') {
        expect(html).toContain('Your team');
        const footer = html.match(/<div[^>]*data-group-player-bar="true"[\s\S]*?<\/div>/)?.[0];
        expect(footer).toBeDefined();
        expect(footer).toContain('Team score after the podium');
        expect(footer).toMatch(/aria-hidden="true"[^>]*>—<\/b>/);
        expect(footer).not.toMatch(/aria-label="\d+ team points"/);
        expect(footer).not.toContain('Your team is in place');
      }
    }
    let beats = 0;
    while (state.phase.id === 'podium' && beats++ < 3) {
      const view = tv(state);
      const allowed = new Set(view.group?.teams.map((team) => team.id));
      expect(
        view.group?.teams.every((team) => team.rank >= (view.podium?.rank ?? 1) && team.rank <= 3),
      ).toBe(true);
      for (const surface of ['tv', 'phone', 'stage'] as const) {
        const html = paint(state, surface);
        expect(buttons(html)).toHaveLength(0);
        expect(html).not.toContain('<meter');
        for (const team of roster) {
          if (allowed.has(team.id)) expect(html).toContain(escape(team.name));
          else expect(html).not.toContain(escape(team.name));
        }
      }
      state = timer(state);
    }
    expect(state.phase.id).toBe('done');
    for (const surface of ['tv', 'phone', 'stage'] as const) {
      const html = paint(state, surface);
      for (const team of roster) expect(html).toContain(escape(team.name));
      expect(html).toContain('aria-label="Standings"');
      if (surface === 'tv') {
        expect(html).toContain('data-group-scoreboard="vertical"');
        for (const player of PLAYERS) expect(html).toContain(escape(player.name));
      } else {
        expect(html).not.toContain('data-group-scoreboard="vertical"');
        for (const player of PLAYERS) expect(html).not.toContain(escape(player.name));
      }
    }
  });
});
