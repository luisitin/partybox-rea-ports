// Verification only: real reducer, views, SDK providers and game components.
import { createRoot } from 'react-dom/client';
import {
  DraftScopeProvider,
  PhoneOnlyProvider,
  ServerClockProvider,
  SoundProvider,
} from '@partybox/game-sdk/ui';
import type { GameEvent } from '@partybox/game-sdk';
import { Controller } from '../../../games/kahoot/client/Controller';
import { Tv } from '../../../games/kahoot/client/Tv';
import { game } from '../../../games/kahoot/server/index';
import type { Input, QuizMode, State } from '../../../games/kahoot/server/types';
import '../../../design/tokens.css';

const names = [
  'Alexandria Montgomery',
  'Christopher Wellington',
  'Francesca van der Linden',
  'Theodore Fitzpatrick',
  'Gabriella Summerfield',
  'Sebastian Rutherford',
  'Anastasia Winterbourne',
  'Maximilian Kensington',
];
const players = names.map((name, index) => ({
  id: `p${index + 1}`,
  name,
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
const root = createRoot(document.getElementById('root')!);
let offset = 0;
const now = () => Date.now() + offset;
let mode: QuizMode = 'teams';
let phoneOnly = false;
let id = 'p1';
let tv = false;
let phoneMount = 0;
let held = false;
let autoTimer: ReturnType<typeof setTimeout> | undefined;
let state = initialState();
let shown = state;
const cues: string[] = [];
const sent: Input[] = [];
const play = (cue: string) => cues.push(cue);

function initialState(): State {
  return game.init({
    players,
    settings: { mode, pack: 'general', rounds: 5, seconds: 10, teamCount: 4, talkSeconds: 5 },
    seed: 44,
    now: now(),
    presence: { mode: 'together', phoneOnly },
  });
}

function publish(): void {
  document.documentElement.dataset.surface = tv ? 'tv' : 'controller';
  root.render(
    <ServerClockProvider offsetMs={offset}>
      <PhoneOnlyProvider value={phoneOnly}>
        <DraftScopeProvider value={`P02-ROOM|${id}|kahoot|${shown.phase.id}`}>
          <SoundProvider play={play}>
            {tv ? (
              <Tv view={{ ...game.tvView(shown), vip: null }} />
            ) : (
              <Controller
                key={phoneMount}
                view={{ ...game.controllerView(shown, id), vip: null }}
                me={
                  shown.players[id] ?? { id, name: 'Spectator', avatarId: 'fox', connected: true }
                }
                send={send}
              />
            )}
          </SoundProvider>
        </DraftScopeProvider>
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}

function scheduleTimer(): void {
  clearTimeout(autoTimer);
  autoTimer = undefined;
  const { id: phaseId, startedAt, deadline, paused } = state.phase;
  if (paused || deadline === null || phaseId === 'done') return;
  autoTimer = setTimeout(
    () => {
      // Stale timer identities still go through the game's real timer guard.
      commit({ type: 'timer', phaseId, startedAt, now: Math.max(now(), deadline) });
    },
    Math.max(0, deadline - now()),
  );
}

function commit(event: GameEvent<Input>): void {
  state = game.reduce(state, event);
  if (!held) shown = state;
  scheduleTimer();
  publish();
}

function send(input: Input): void {
  sent.push(input);
  commit({ type: 'input', playerId: id, input, now: now() });
}

function answer(playerId: string, choice: number): void {
  commit({
    type: 'input',
    playerId,
    input: { type: 'answer', round: state.round, choice },
    now: now(),
  });
}

function timer(): void {
  if (state.phase.deadline === null) throw new Error('No current timer');
  offset += Math.max(0, state.phase.deadline - now());
  commit({ type: 'timer', phaseId: state.phase.id, startedAt: state.phase.startedAt, now: now() });
}

// Private keys are available only to the scripted solver, never handed to render/views.
const key = () => state.deck[state.round - 1]!.correct;
function finishAnswers(pattern = 'correct'): void {
  const correct = key();
  for (const [index, player] of players.entries()) {
    if (state.phase.id !== 'question' || state.answers[player.id]) continue;
    const choice = pattern === 'mixed' && index % 3 === 1 ? (correct + 1) % 4 : correct;
    answer(player.id, choice);
  }
}

function start(nextMode: QuizMode, only = false): void {
  clearTimeout(autoTimer);
  mode = nextMode;
  phoneOnly = only;
  if (id !== 'p1') phoneMount++;
  id = 'p1';
  tv = false;
  held = false;
  offset = 0;
  sent.length = 0;
  state = initialState();
  shown = state;
  scheduleTimer();
  publish();
}

(window as any).p02 = {
  start,
  key,
  hold(value: boolean) {
    held = value;
  },
  ack() {
    held = false;
    shown = state;
    publish();
  },
  advance(ms: number) {
    offset += ms;
    scheduleTimer();
    publish();
  },
  // Accelerate the server clock near its authored deadline; a real timeout fires it.
  deadlineSoon(ms = 80) {
    if (state.phase.deadline === null) throw new Error('No current timer');
    offset += state.phase.deadline - now() - ms;
    scheduleTimer();
    publish();
  },
  timer,
  pause() {
    commit({ type: 'vip', action: 'pause', now: now() });
  },
  resume() {
    commit({ type: 'vip', action: 'resume', now: now() });
  },
  answer,
  finishAnswers,
  vote(choices: number[]) {
    choices.forEach((choice, index) => answer(`p${index + 1}`, choice));
  },
  remount() {
    phoneMount++;
    publish();
  },
  rejoinNewQuestion() {
    // The disconnected phone missed done/lobby/discussion; publish only the later question.
    clearTimeout(autoTimer);
    held = false;
    sent.length = 0;
    state = initialState();
    if (state.phase.id === 'talk' && state.phase.deadline !== null) {
      offset += Math.max(0, state.phase.deadline - now());
      state = game.reduce(state, {
        type: 'timer',
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
        now: now(),
      });
    }
    shown = state;
    phoneMount++;
    scheduleTimer();
    publish();
  },
  showPhone(playerId = 'p1') {
    if (id !== playerId) phoneMount++;
    id = playerId;
    tv = false;
    publish();
  },
  showTv() {
    tv = true;
    publish();
  },
  until(phase: string) {
    for (let step = 0; step < 40 && state.phase.id !== phase; step++) {
      if (state.phase.id === 'question') finishAnswers('mixed');
      else if (state.phase.id === 'done') break;
      else timer();
    }
    if (state.phase.id !== phase) throw new Error(`Could not reach ${phase}`);
  },
  info() {
    return {
      phase: state.phase,
      round: state.round,
      openedAt: state.openedAt,
      answerMs: state.answerMs,
      answers: state.answers,
      verdicts: state.verdicts,
      scores: state.scores,
      teams: state.teams,
      teamScores: state.teamScores,
      teamGains: state.teamGains,
      decision: state.decision,
      phone: game.controllerView(state, id),
      tv: game.tvView(state),
      sent: [...sent],
      cues: [...cues],
      now: now(),
    };
  },
};
scheduleTimer();
publish();
