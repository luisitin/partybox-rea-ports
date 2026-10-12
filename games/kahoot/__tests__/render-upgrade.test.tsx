// Current two-mode, all-phase screen evidence; root alone opts into writing and browser capture.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PhoneOnlyProvider,
  PlayerChip,
  PlayerChips,
  ServerClockProvider,
  Timer,
} from '@partybox/game-sdk/ui';
import chipStyles from '../../../packages/game-sdk/src/tv/PlayerChips.module.css';
import type { PlayerInfo } from '@partybox/game-sdk';
import { afterEach, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { tv as tvModule } from '../client/tv-entry';
import { game } from '../server/index';
import { QUESTIONS, QUESTIONS_ES, questionById } from '../server/content';
import { CLASSIC_PACKS } from '../server/classic';
import { enterQuestion } from '../server/phases/question';
import type { State } from '../server/types';
import { input, phone, timer, tv, vip } from './helpers';
import { MEDIA, standalone, stateDigest, writeUpgradeEvidence } from './upgrade-evidence';
import type { Surface, UpgradeFrame } from './upgrade-evidence';

const T0 = 2_000_000_000_000;
const language = vi.hoisted(() => ({ value: 'en' as 'en' | 'es' }));
vi.mock('../../../packages/game-sdk/src/ui/lang', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../packages/game-sdk/src/ui/lang')>();
  return {
    ...actual,
    useLang: () => language.value,
    useT: (table: Parameters<typeof actual.useT>[0]) =>
      Object.assign(
        (en: string, vars?: Readonly<Record<string, string | number>>) =>
          actual.translate(table, language.value, en, vars),
        {
          lang: language.value,
          sent: (value: string) => actual.translateSent(table, language.value, value),
        },
      ),
    ContentLang: (props: Parameters<typeof actual.ContentLang>[0]) =>
      actual.contentMark(language.value, props),
  };
});
const SURFACES: readonly Surface[] = ['tv', 'phone-tv', 'phone-only', 'remote', 'spectator'];
const frames: UpgradeFrame[] = [];
const fixtures: Record<string, State> = {};
afterEach(() => {
  vi.useRealTimers();
  language.value = 'en';
});

function seats(count: number, long = false): PlayerInfo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `seat-${index + 1}`,
    name: long
      ? `${String(index + 1).padStart(2, '0')} Maximiliana Guadalupe Washington`.slice(0, 40)
      : `Guest ${String(index + 1).padStart(2, '0')} Aster`,
    avatarId: 'fox',
    connected: true,
    canSeeTv: true,
  }));
}

function start(mode: 'classic' | 'wager', count = 16, long = false): State {
  return game.init({
    players: seats(count, long),
    settings: {
      quizMode: mode,
      classicPack: 'general',
      category: 'all',
      questions: 5,
      answerSeconds: 10,
    },
    seed: 42,
    now: T0,
    presence: { mode: 'together', phoneOnly: false },
  });
}

function played(
  mode: 'classic' | 'wager',
  tied = false,
  initial = start(mode),
  allIn = false,
): State[] {
  const states: State[] = [];
  let state = initial;
  for (let step = 0; step < 80; step++) {
    states.push(state);
    if (state.phase.id === 'done') return states;
    if (state.phase.id === 'question') {
      const q = questionById(state.questionIds[state.index] ?? '', state.contentLang);
      if (!q) throw new Error('Real evidence question missing');
      const at = state.phase.startedAt;
      for (const [index, player] of Object.values(state.players).entries()) {
        const correct = tied || index < 4;
        const choice = correct ? q.answerIndex : (q.answerIndex + 1) % 4;
        const delay = tied ? 400 : ([300, 800, 1300, 1300][index] ?? 1600);
        const stamp = phone(state, player.id).answerStamp;
        state = input(
          state,
          player.id,
          mode === 'classic' && stamp
            ? { type: 'answer', ...stamp, index: choice }
            : { type: 'pick', index: choice },
          at + delay,
        );
      }
    } else if (state.phase.id === 'wager') {
      const at = state.phase.startedAt;
      for (const [index, player] of Object.values(state.players).entries())
        state = input(
          state,
          player.id,
          { type: 'wager', percent: allIn ? 100 : index % 2 ? 50 : 100 },
          at + 300 + index * 50,
        );
    }
    if (state.phase.id !== 'done' && state.phase.id === states[states.length - 1]!.phase.id)
      state = timer(state);
  }
  throw new Error('Evidence match did not terminate');
}

function paint(
  name: string,
  base: State,
  at: number,
  surfaces: readonly Surface[] = SURFACES,
  locked = false,
): void {
  for (const surface of surfaces) {
    let state: State = {
      ...base,
      phoneOnly: surface === 'phone-only',
      players: Object.fromEntries(
        Object.entries(base.players).map(([id, player]) => [
          id,
          { ...player, canSeeTv: surface !== 'remote' || id !== 'seat-1' },
        ]),
      ),
    };
    if (locked && state.phase.id === 'question') {
      const stamp = phone(state, 'seat-1').answerStamp;
      state = input(
        state,
        'seat-1',
        stamp ? { type: 'answer', ...stamp, index: 0 } : { type: 'pick', index: 0 },
        state.phase.startedAt + 400,
      );
    }
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at);
    const id = surface === 'spectator' ? 'audience' : 'seat-1';
    const controller = phone(state, id);
    const publicView = tv(state);
    // Existing wager components deliberately delegate clocks to the shell. Keep that real
    // contract visible rather than silently giving those screenshots no running clock.
    const html = renderToStaticMarkup(
      <ServerClockProvider offsetMs={0}>
        {surface === 'tv' ? (
          <Tv view={{ ...publicView, vip: null }} skip={() => undefined} />
        ) : (
          <PhoneOnlyProvider value={controller.phoneOnly === true}>
            <Controller
              view={{ ...controller, vip: 'seat-1' }}
              me={state.players[id] ?? { id, name: 'Spectator Willow', avatarId: 'owl' }}
              send={() => undefined}
              skip={surface === 'spectator' ? undefined : () => undefined}
            />
          </PhoneOnlyProvider>
        )}
      </ServerClockProvider>,
    );
    expect(html, `${name}-${surface}`).not.toMatch(/NaN|undefined|Infinity/);
    expect(html).toMatch(/<(?:h[123]|p)\b/);
    if (surface === 'spectator') expect(html).not.toContain('<button');
    if (surface === 'phone-only' || surface === 'remote' || surface === 'spectator')
      expect(html).not.toMatch(/look at the TV|watch the TV|see the TV/i);
    const frame = {
      name: `upgrade-${name}-${surface}`,
      surface,
      width: surface === 'tv' ? 1920 : 390,
      height: surface === 'tv' ? 1080 : 844,
      at,
      stateHash: stateDigest(state),
      html,
      chrome:
        surface === 'tv'
          ? renderToStaticMarkup(
              <ServerClockProvider offsetMs={0}>
                <div className="evidence-strip">
                  <div
                    className={`evidence-chips ${tvModule.stripHidden?.includes(publicView.phaseId) ? 'evidence-chips-hidden' : ''}`}
                  >
                    {!tvModule.stripHidden?.includes(publicView.phaseId) ? (
                      <>
                        <div data-chips-named>
                          <PlayerChips
                            players={publicView.players}
                            showScores={
                              state.settings.quizMode !== 'classic' || state.phase.id === 'done'
                            }
                            size="sm"
                          />
                        </div>
                        <div data-chips-faces hidden>
                          <ul
                            className={`${chipStyles.list} ${chipStyles.row}`}
                            aria-label="players"
                          >
                            {publicView.players.map((player) => (
                              <li key={player.id} className={chipStyles.item}>
                                <PlayerChip
                                  name=""
                                  avatarId={player.avatarId}
                                  connected={player.connected}
                                  status={player.status}
                                  compact
                                  size="sm"
                                  score={
                                    state.settings.quizMode !== 'classic' ||
                                    state.phase.id === 'done'
                                      ? player.score
                                      : undefined
                                  }
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
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
          : renderToStaticMarkup(
              <div className="evidence-phone-countdown">
                <span className="evidence-phone-track" />
                {controller.paused ? (
                  <span>⏸ Paused</span>
                ) : controller.timerMode !== 'quiet' && controller.deadline !== null ? (
                  <span>{Math.max(0, Math.ceil((controller.deadline - at) / 1000))}s</span>
                ) : null}
              </div>,
            ),
    };
    expect(standalone(frame)).not.toMatch(/:global\(|\bglobal\(/);
    frames.push(frame);
  }
}

function first(states: State[], phase: State['phase']['id'], final = false): State {
  const state = states.find(
    (s) =>
      s.phase.id === phase &&
      ((phase !== 'question' && phase !== 'reveal') || tv(s).round?.final === final),
  );
  if (!state) throw new Error(`Missing ${phase} ${final ? 'final' : 'ordinary'} evidence phase`);
  return state;
}

function atEnd(state: State): number {
  return state.phase.deadline === null ? state.phase.startedAt + 5000 : state.phase.deadline - 1;
}

function longestQuestion(ids: readonly string[], lang?: 'en' | 'es'): string {
  return [...ids].sort((a, b) => {
    const size = (id: string): number => {
      const q = questionById(id, lang);
      return q
        ? q.question.length +
            q.choices.reduce((sum, option) => sum + option.length, 0) +
            ('explanation' in q ? q.explanation.length : 0)
        : 0;
    };
    return size(b) - size(a);
  })[0]!;
}

/** Move a chosen shipped question without introducing a duplicate into the drawn match. */
function selectQuestion(state: State, index: number, id: string): State {
  const questionIds = [...state.questionIds];
  const displaced = questionIds[index];
  if (!displaced) throw new Error('Evidence question slot missing');
  const previous = questionIds.indexOf(id);
  if (previous !== -1) questionIds[previous] = displaced;
  questionIds[index] = id;
  expect(new Set(questionIds).size).toBe(questionIds.length);
  return { ...state, questionIds };
}

it('renders fresh classic and wager phases on every supported stage surface', () => {
  const classic = played('classic');
  const wager = played('wager');
  for (const [mode, states] of [
    ['classic', classic],
    ['wager', wager],
  ] as const) {
    const intro = first(states, 'intro');
    const question = first(states, 'question');
    const reveal = first(states, 'reveal');
    const done = first(states, 'done');
    for (const [phase, state] of Object.entries({ intro, question, reveal, done })) {
      fixtures[`${mode}-${phase}`] = state;
      if (mode === 'wager') fixtures[phase] = state;
    }
    paint(`${mode}-intro`, intro, atEnd(intro));
    paint(`${mode}-question`, question, question.phase.startedAt + 1000);
    paint(
      `${mode}-question-locked`,
      question,
      question.phase.startedAt + 1000,
      ['phone-tv', 'phone-only', 'remote'],
      true,
    );
    paint(`${mode}-reveal-chart`, reveal, (tv(reveal).revealAt ?? reveal.phase.startedAt) + 1000);
    paint(`${mode}-reveal-standings`, reveal, atEnd(reveal));
    paint(`${mode}-done`, done, atEnd(done));
  }
  const lastClassic = classic.find((s) => s.phase.id === 'reveal' && tv(s).round?.last);
  if (!lastClassic) throw new Error('No last classic reveal');
  paint('classic-last-reveal', lastClassic, atEnd(lastClassic));
  fixtures['classic-last-reveal'] = lastClassic;
  for (const podium of classic.filter((s) => s.phase.id === 'podium')) {
    paint(`classic-podium-${podium.podiumRank}`, podium, atEnd(podium));
    fixtures[`classic-podium-${podium.podiumRank}`] = podium;
    fixtures['podium'] ??= podium;
  }
  const tied = played('classic', true).find((s) => s.phase.id === 'podium');
  if (!tied) throw new Error('Tied classic podium missing');
  fixtures['classic-podium-all-tied'] = tied;
  const longTied = { ...tied, players: Object.fromEntries(seats(16, true).map((p) => [p.id, p])) };
  paint('classic-podium-all-tied-long-names', longTied, atEnd(longTied));
  const stakes = first(wager, 'wager');
  fixtures['wager'] = stakes;
  paint('wager-stakes', stakes, stakes.phase.startedAt + 1000);
  const finalQuestion = first(wager, 'question', true);
  const finalReveal = first(wager, 'reveal', true);
  fixtures['wager-final-question'] = finalQuestion;
  fixtures['wager-final-reveal'] = finalReveal;
  paint('wager-final-question', finalQuestion, finalQuestion.phase.startedAt + 1000);
  paint('wager-final-reveal', finalReveal, atEnd(finalReveal));
  paint('wager-final-reveal-held', finalReveal, finalReveal.phase.startedAt + 1000, [
    'tv',
    'phone-only',
    'spectator',
  ]);
  const classicQuestion = first(classic, 'question');
  const paused = vip(classicQuestion, 'pause', classicQuestion.phase.startedAt + 2000);
  paint('classic-paused-question', paused, paused.phase.paused!.at + 60000, ['tv', 'phone-only']);
  const departed = game.reduce(classicQuestion, {
    type: 'player',
    playerId: 'seat-1',
    connected: false,
    gone: 'left',
    now: classicQuestion.phase.startedAt + 1000,
  });
  paint('classic-departed-question', departed, departed.phase.startedAt + 2000, ['phone-only']);
});

it('renders shipped longest classic and bilingual wager text with sixteen long names', () => {
  const classicIds = Object.values(CLASSIC_PACKS).flatMap((p) => p.questions.map((q) => q.id));
  for (const [mode, lang, id] of [
    ['classic', 'en', longestQuestion(classicIds)],
    ['wager', 'en', longestQuestion(QUESTIONS.map((q) => q.id))],
    [
      'wager',
      'es',
      longestQuestion(
        QUESTIONS_ES.map((q) => q.id),
        'es',
      ),
    ],
  ] as const) {
    const initial = start(mode, 16, true);
    const selected = {
      ...selectQuestion(initial, 0, id),
      contentLang: lang,
    };
    const question = enterQuestion(selected, initial.phase.deadline!);
    language.value = lang;
    paint(`${mode}-${lang}-longest-question`, question, question.phase.startedAt + 1000, [
      'tv',
      'phone-only',
      'spectator',
    ]);
    let reveal = question;
    if (mode === 'wager') {
      const answer = questionById(id, lang)?.answerIndex;
      if (answer === undefined) throw new Error('Longest wager answer missing');
      for (const player of Object.values(question.players))
        reveal = input(
          reveal,
          player.id,
          { type: 'pick', index: answer },
          question.phase.startedAt + 400,
        );
    }
    if (reveal.phase.id === 'question') reveal = timer(reveal);
    expect(reveal.phase.id).toBe('reveal');
    paint(
      `${mode}-${lang}-longest-reveal`,
      reveal,
      (tv(reveal).revealAt ?? reveal.phase.startedAt) + 1000,
      ['tv', 'phone-only', 'spectator'],
    );
    if (mode === 'wager') {
      paint(`${mode}-${lang}-longest-standings`, reveal, atEnd(reveal), ['phone-tv']);
    }
  }
  language.value = 'es';
  const classic = timer(start('classic'));
  paint('classic-spanish-ui-english-content', classic, classic.phase.startedAt + 1000, [
    'tv',
    'phone-tv',
    'phone-only',
    'spectator',
  ]);
});

it('renders legal forty-character final names with five-digit bets and totals from actual play', () => {
  const players = seats(16).map((player, index) => ({
    ...player,
    name: `${String(index + 1).padStart(2, '0')}${'W'.repeat(38)}`,
  }));
  const initial = game.init({
    players,
    settings: { quizMode: 'wager', category: 'all', questions: 20, answerSeconds: 10 },
    seed: 42,
    now: T0,
    presence: { mode: 'together', phoneOnly: false },
  });
  const match = played('wager', true, initial, true);
  const final = first(match, 'reveal', true);
  const rows = tv(final).rows;
  expect(rows).toHaveLength(16);
  for (const row of rows ?? []) {
    expect(row.name).toHaveLength(40);
    expect(row.wagerAmount).toBeGreaterThanOrEqual(10000);
    expect(row.wagerAmount).toBeLessThan(100000);
    expect(row.delta).toBe(row.wagerAmount);
    expect(row.score).toBeGreaterThanOrEqual(10000);
    expect(row.score).toBeLessThan(100000);
  }
  const name = 'wager-final-wide-names-five-digits';
  paint(name, final, atEnd(final), ['tv', 'phone-only', 'spectator', 'remote']);
  for (const frame of frames.filter((frame) => frame.name.startsWith(`upgrade-${name}-`))) {
    expect(frame.html.match(/<li\b/g)).toHaveLength(16);
    expect(frame.html).not.toContain('role="radio"');
    for (const player of players) {
      expect(frame.html).toContain(`title="${player.name}"`);
      if (frame.surface !== 'tv') expect(frame.html).toContain(`aria-label="${player.name} · `);
    }
  }
  fixtures['wager-final-wide-names-five-digits'] = final;
});

it('keeps eight and sixteen crowded TV race receipts identifiable after a long match', () => {
  for (const [count, size] of [
    [8, 'eight'],
    [16, 'sixteen'],
  ] as const) {
    const initial = game.init({
      players: seats(count),
      settings: { quizMode: 'wager', category: 'all', questions: 20, answerSeconds: 10 },
      seed: 42,
      now: T0,
      presence: { mode: 'together', phoneOnly: false },
    });
    const reveals = played('wager', true, initial).filter(
      (state) => state.phase.id === 'reveal' && !tv(state).round?.final,
    );
    const race = reveals[reveals.length - 1];
    if (!race) throw new Error('Crowded ordinary race missing');
    for (const row of tv(race).rows ?? []) {
      expect(row.streak).toBeGreaterThanOrEqual(10);
      expect(row.elapsedMs).toBe(400);
      expect(row.score).toBeGreaterThanOrEqual(10000);
    }
    const name = `wager-race-${size}`;
    paint(name, race, (tv(race).revealAt ?? race.phase.startedAt) + 1000, ['tv']);
    const frame = frames[frames.length - 1]!;
    expect(frame.html.match(/data-player=/g)).toHaveLength(count);
    for (const player of seats(count)) expect(frame.html).toContain(`title="${player.name}"`);
    expect(frame.html).toContain('0.4 s');
    expect(frame.html).toContain('⚡');
    fixtures[name] = race;
  }
});

it('fits the longest translated race together with twenty-answer streaks from real play', () => {
  for (const lang of ['en', 'es'] as const) {
    const id = longestQuestion(
      (lang === 'es' ? QUESTIONS_ES : QUESTIONS).map((q) => q.id),
      lang,
    );
    const initial = game.init({
      players: seats(16, true),
      settings: { quizMode: 'wager', category: 'all', questions: 20, answerSeconds: 10 },
      seed: 42,
      now: T0,
      contentLang: lang,
      presence: { mode: 'together', phoneOnly: false },
    });
    const index = initial.settings.questions - 1;
    const selected = selectQuestion(initial, index, id);
    const race = played('wager', true, selected).find(
      (state) => state.phase.id === 'reveal' && state.index === index,
    );
    if (!race) throw new Error('Longest high-streak race missing');
    expect(race.questionIds[race.index]).toBe(id);
    expect(tv(race).round?.final).toBe(false);
    expect(tv(race).rows).toHaveLength(16);
    for (const row of tv(race).rows ?? []) {
      expect(row.streak).toBe(20);
      expect(row.elapsedMs).toBe(400);
      expect(row.score).toBeGreaterThanOrEqual(10000);
    }
    language.value = lang;
    const name = `wager-${lang}-longest-high-streak-race`;
    paint(name, race, (tv(race).revealAt ?? race.phase.startedAt) + 1000, ['tv']);
    const frame = frames[frames.length - 1]!;
    expect(frame.html.match(/data-player=/g)).toHaveLength(16);
    expect(frame.html.match(/🔥20/g)).toHaveLength(16);
    for (const player of seats(16, true)) expect(frame.html).toContain(`title="${player.name}"`);
    fixtures[name] = race;
  }
});

it('fits the tall receipt layouts used by one and four-player TV rooms', () => {
  for (const count of [1, 4]) {
    const states = played('wager', true, start('wager', count));
    const race = first(states, 'reveal');
    const final = first(states, 'reveal', true);
    paint(`wager-small-${count}-race`, race, (tv(race).revealAt ?? race.phase.startedAt) + 1000, [
      'tv',
    ]);
    paint(`wager-small-${count}-final`, final, atEnd(final), ['tv']);
  }
});

it('fits paired and tripled first-place ties with legal forty-character wide names', () => {
  for (const count of [2, 3]) {
    const initial = start('classic', count);
    const players = Object.fromEntries(
      Object.values(initial.players).map((player, index) => [
        player.id,
        { ...player, name: `${String(index + 1).padStart(2, '0')}${'W'.repeat(38)}` },
      ]),
    );
    const state = played('classic', true, { ...initial, players }).find(
      (s) => s.phase.id === 'podium',
    );
    if (!state) throw new Error('Tied podium missing');
    expect(tv(state).podium?.entries).toHaveLength(count);
    paint(`classic-podium-wide-tie-${count}`, state, atEnd(state), ['tv']);
  }
});

function captureFrames(): UpgradeFrame[] {
  return frames.filter((frame) => {
    const name = frame.name.slice('upgrade-'.length, -(frame.surface.length + 1));
    const basic =
      frame.surface === 'tv' || frame.surface === 'phone-tv' || frame.surface === 'phone-only';
    const stage = frame.surface === 'tv' || frame.surface === 'phone-only';
    if (name === 'wager-final-wide-names-five-digits') return true;
    if (/^classic-podium-wide-tie-/.test(name)) return true;
    if (/^wager-small-/.test(name) || /^wager-(?:en|es)-longest-standings$/.test(name)) return true;
    if (/^wager-race-(?:eight|sixteen)$/.test(name)) return frame.surface === 'tv';
    if (/^(?:classic|wager)-(?:intro|question|reveal-chart|done)$/.test(name))
      return (
        basic ||
        (name === 'classic-question' &&
          (frame.surface === 'remote' || frame.surface === 'spectator')) ||
        (name === 'wager-question' && frame.surface === 'remote')
      );
    if (/^(?:classic|wager)-reveal-standings$/.test(name)) return stage;
    if (/^classic-(?:last-reveal|podium-[123]|podium-all-tied-long-names)$/.test(name))
      return basic;
    if (/^wager-(?:stakes|final-question|final-reveal)$/.test(name))
      return basic || (name === 'wager-final-reveal' && frame.surface === 'spectator');
    if (/^(?:classic|wager)-question-locked$/.test(name))
      return frame.surface === 'phone-tv' || frame.surface === 'phone-only';
    if (name.includes('longest')) return stage;
    if (name === 'classic-paused-question' || name === 'classic-departed-question') return true;
    return (
      (name === 'classic-question' &&
        (frame.surface === 'remote' || frame.surface === 'spectator')) ||
      (name === 'wager-question' && frame.surface === 'remote') ||
      (name === 'wager-final-reveal' && frame.surface === 'spectator')
    );
  });
}

it('writes current HTML and manifest only when the root requests fresh evidence', () => {
  expect(frames.length).toBeGreaterThanOrEqual(90);
  expect(new Set(frames.map((frame) => frame.name)).size).toBe(frames.length);
  expect(new Set(Object.values(fixtures).map((state) => state.phase.id))).toEqual(
    new Set(game.phases),
  );
  const captures = captureFrames();
  expect(captures.length).toBeGreaterThanOrEqual(65);
  expect(captures.length).toBeLessThanOrEqual(91);
  expect(timer(fixtures['classic-podium-1']!)).toEqual(fixtures['classic-done']);
  expect(timer(fixtures['wager-final-reveal']!)).toEqual(fixtures['wager-done']);
  if (process.env.PB_WRITE_EVIDENCE === '1') writeUpgradeEvidence(captures, fixtures);
  else if (existsSync(resolve(MEDIA, 'evidence-source.json'))) {
    const source = JSON.parse(readFileSync(resolve(MEDIA, 'evidence-source.json'), 'utf8')) as {
      implementation: string;
      frames: number;
    };
    expect(source.implementation).toBe('kahoot-lightning-round-upgrade');
    expect(source.frames).toBe(captures.length);
  }
});
