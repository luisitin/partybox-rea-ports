// Full group phases are rendered through production views/components in every supported surface.
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider, ServerClockProvider, PlayerChips, Timer } from '@partybox/game-sdk/ui';
import type { PlayerInfo } from '@partybox/game-sdk';
import { afterEach, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { tv as tvModule } from '../client/tv-entry';
import { game } from '../server/index';
import { questionById } from '../server/content';
import type { State, Input, GroupMode } from '../server/types';
import { input, phone, timer, tv, vip } from './helpers';
import { standalone, stateDigest } from './upgrade-evidence';
import type { Surface, UpgradeFrame } from './upgrade-evidence';
import { writeGroupEvidence } from './group-evidence';

const T0 = 2_000_000_000_000;
const SURFACES: readonly Surface[] = ['tv', 'phone-tv', 'phone-only', 'remote', 'spectator'];
const frames: UpgradeFrame[] = [];
const fixtures: Record<string, State> = {};
afterEach(() => vi.useRealTimers());
const seats: PlayerInfo[] = Array.from({ length: 8 }, (_, i) => ({
  id: `seat-${i + 1}`,
  name: `${String(i + 1).padStart(2, '0')} Maximiliana Guadalupe Washington`.slice(0, 40),
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
function start(mode: GroupMode, teams: number): State {
  return game.init({
    players: seats,
    settings: {
      quizMode: mode,
      classicPack: 'sports',
      questions: 5,
      answerSeconds: 10,
      teamCount: teams,
      talkSeconds: 5,
    },
    seed: 42,
    now: T0,
  });
}
function played(initial: State): State[] {
  const states: State[] = [];
  let state = initial;
  for (let step = 0; step < 100; step++) {
    states.push(state);
    if (state.phase.id === 'done') return states;
    const phase = state.phase.id;
    if (phase === 'question') {
      const at = state.phase.startedAt;
      const q = questionById(state.questionIds[state.index]!, state.contentLang)!;
      for (const [index, player] of Object.values(state.players).entries()) {
        if (state.phase.id !== 'question') break;
        const team =
          state.teams?.findIndex((candidate) => candidate.members.includes(player.id)) ?? 0;
        const correct =
          state.settings.quizMode === 'tv-vote'
            ? index < 5
            : team === 0
              ? state.index > 0 || index === 0
              : state.index < 4 - team;
        const stamp = phone(state, player.id).answerStamp;
        if (!stamp) throw new Error('Group answer has no canonical stamp');
        state = input(
          state,
          player.id,
          { type: 'answer', ...stamp, index: correct ? q.answerIndex : (q.answerIndex + 1) % 4 },
          at + 300 + index * 100,
        );
      }
    }
    if (state.phase.id === phase) state = timer(state);
  }
  throw new Error('Group fixture trace did not finish');
}
interface PaintOptions {
  playerId?: string;
  vipSkip?: boolean;
  surfaces?: readonly Surface[];
}
function paint(
  name: string,
  source: State,
  at = source.phase.startedAt + 100,
  options: PaintOptions = {},
): void {
  fixtures[`group-${name}`] = source;
  if (source.phase.id === 'talk' && !fixtures.talk) fixtures.talk = source;
  for (const surface of options.surfaces ?? SURFACES) {
    const id = surface === 'spectator' ? 'audience' : (options.playerId ?? 'seat-1');
    const only = surface === 'phone-only' || surface === 'spectator';
    const state: State = {
      ...source,
      phoneOnly: only,
      players: Object.fromEntries(
        Object.entries(source.players).map(([key, player]) => [
          key,
          { ...player, canSeeTv: surface !== 'remote' || key !== id },
        ]),
      ),
    };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at);
    const publicView = tv(state);
    const controller = phone(state, id);
    const html = renderToStaticMarkup(
      <ServerClockProvider offsetMs={0}>
        {surface === 'tv' ? (
          <Tv view={{ ...publicView, vip: null }} skip={() => undefined} />
        ) : (
          <PhoneOnlyProvider value={controller.phoneOnly === true}>
            <Controller
              view={{ ...controller, vip: null }}
              me={state.players[id] ?? { id, name: 'Spectator', avatarId: 'owl' }}
              send={(_input: Input) => undefined}
              skip={options.vipSkip ? () => undefined : undefined}
            />
          </PhoneOnlyProvider>
        )}
      </ServerClockProvider>,
    );
    if (options.surfaces && surface === 'phone-tv' && source.phase.id === 'reveal') {
      const footer = html.match(/<div[^>]*data-group-player-bar="true"[\s\S]*?<\/div>/)?.[0];
      expect(footer, name + ' identity footer').toBeDefined();
      const team = controller.group?.teams.find((row) => row.id === controller.group?.myTeamId);
      if (team) {
        expect(footer).toContain(
          'aria-label="' +
            team.score +
            (controller.group?.mode === 'teams' ? ' team points"' : ' room points"'),
        );
      } else {
        expect(footer).toContain(
          controller.group?.mode === 'teams'
            ? 'Team score after the podium'
            : 'Room score after the podium',
        );
        expect(footer).toMatch(/aria-hidden="true"[^>]*>—<\/b>/);
        expect(footer).not.toMatch(/aria-label="\d+ (?:team|room) points"/);
      }
    }
    expect(html, `${name}-${surface}`).not.toMatch(/NaN|undefined|Infinity/);
    expect(html).toMatch(/<(?:h[123]|p)\b/);
    if (surface === 'spectator' || source.phase.id === 'talk')
      expect(html).not.toContain('<button');
    if (only || surface === 'remote')
      expect(html).not.toMatch(/look at the TV|watch the TV|see the TV/i);
    const chrome =
      surface === 'tv'
        ? renderToStaticMarkup(
            <ServerClockProvider offsetMs={0}>
              <div className="evidence-strip">
                <div
                  className={`evidence-chips ${tvModule.stripHidden?.includes(publicView.phaseId) ? 'evidence-chips-hidden' : ''}`}
                >
                  {!tvModule.stripHidden?.includes(publicView.phaseId) ? (
                    <PlayerChips
                      players={publicView.players}
                      showScores={source.phase.id === 'done'}
                      size="sm"
                    />
                  ) : null}
                </div>
                <div className="evidence-timer">
                  {publicView.timerMode === 'normal' && publicView.deadline !== null ? (
                    <Timer
                      deadline={publicView.deadline}
                      phaseKey={publicView.phaseId}
                      phaseAt={publicView.phaseAt}
                      paused={publicView.paused}
                      clockHeldAt={publicView.clockHeldAt}
                      size="lg"
                    />
                  ) : null}
                </div>
              </div>
              <div className="evidence-bar" />
            </ServerClockProvider>,
          )
        : '<div class="evidence-phone-countdown"><span class="evidence-phone-track"></span></div>';
    const frame: UpgradeFrame = {
      name: `groups-${name}-${surface}`,
      surface,
      width: surface === 'tv' ? 1920 : 390,
      height: surface === 'tv' ? 1080 : 844,
      at,
      stateHash: stateDigest(state),
      html,
      chrome,
    };
    expect(standalone(frame)).not.toMatch(/:global\(|\bglobal\(/);
    frames.push(frame);
  }
}
it('renders every canonical group phase and role, plus paused/locked/long-name flows', async () => {
  frames.length = 0;
  for (const mode of ['teams', 'tv-vote'] as const) {
    const states = played(start(mode, 4));
    for (const phase of ['intro', 'talk', 'question', 'reveal', 'done']) {
      const state = states.find((s) => s.phase.id === phase);
      if (!state) throw new Error(`Missing ${mode} ${phase}`);
      paint(`${mode}-${phase}`, state);
      if (phase === 'reveal')
        paint(`${mode}-standings`, state, (tv(state).leaderboardAt ?? state.phase.startedAt) + 100);
    }
    for (const podium of states.filter((s) => s.phase.id === 'podium'))
      paint(`${mode}-podium-${podium.podiumRank}`, podium);
    const question = states.find((s) => s.phase.id === 'question')!;
    const stamp = phone(question, 'seat-1').answerStamp!;
    const locked = input(
      question,
      'seat-1',
      { type: 'answer', ...stamp, index: 0 },
      question.phase.startedAt + 300,
    );
    paint(`${mode}-locked`, locked, question.phase.startedAt + 400);
    paint(
      `${mode}-paused`,
      vip(locked, 'pause', question.phase.startedAt + 500),
      question.phase.startedAt + 10000,
    );
    const firstReveal = states.find((s) => s.phase.id === 'reveal')!;
    const firstBoardAt = (tv(firstReveal).leaderboardAt ?? firstReveal.phase.startedAt) + 100;
    paint(mode + '-standings-vip', firstReveal, firstBoardAt, {
      vipSkip: true,
      surfaces: ['phone-tv'],
    });
    if (mode === 'teams') {
      // The same team has one correct and one wrong answer, so both receipts show 50%.
      const incorrectTeammate = firstReveal.teams
        ?.find((team) => team.members.includes('seat-1'))
        ?.members.find((id) => phone(firstReveal, id).outcome?.correct === false);
      if (!incorrectTeammate) throw new Error('The first team needs an incorrect teammate receipt');
      expect(phone(firstReveal, 'seat-1').outcome?.correct).toBe(true);
      expect(phone(firstReveal, incorrectTeammate).outcome?.correct).toBe(false);
      expect(
        phone(firstReveal, incorrectTeammate).group?.teams.find((team) =>
          team.members.includes(incorrectTeammate),
        )?.correctPercent,
      ).toBe(50);
      paint('teams-standings-wrong', firstReveal, firstBoardAt, {
        playerId: incorrectTeammate,
        surfaces: ['phone-tv'],
      });
    }
    const final = states.filter((s) => s.phase.id === 'reveal').at(-1)!;
    paint(`${mode}-last-reveal`, final);
    const readyAt = phone(final, 'seat-1').nextAt;
    if (readyAt === undefined) throw new Error('Final reveal needs its authored podium-ready beat');
    expect(phone(final, 'seat-1').group?.teams).toHaveLength(0);
    expect(phone(final, 'seat-1').myRank).toBeUndefined();
    paint(mode + '-last-reveal-ready', final, readyAt + 100, {
      vipSkip: true,
      surfaces: ['phone-tv'],
    });
  }
  paint(
    'two-teams-talk',
    played(start('teams', 2)).find((s) => s.phase.id === 'talk')!,
  );
  expect(frames.length).toBeGreaterThanOrEqual(90);
  for (const name of [
    'groups-teams-standings-vip-phone-tv',
    'groups-tv-vote-standings-vip-phone-tv',
    'groups-teams-standings-wrong-phone-tv',
    'groups-teams-last-reveal-ready-phone-tv',
    'groups-tv-vote-last-reveal-ready-phone-tv',
  ]) {
    expect(frames.filter((frame) => frame.name === name)).toHaveLength(1);
  }
  if (process.env.P02_WRITE_EVIDENCE === '1') await writeGroupEvidence(frames, fixtures);
});
