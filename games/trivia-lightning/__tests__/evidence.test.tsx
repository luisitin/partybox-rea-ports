// Reproducible phase fixtures and real React SSR, styled with the actual CSS module mappings.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { questionSchema } from '../content/schema';
import type { State } from '../server/types';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import controllerCss from '../client/Controller.module.css';
import tvCss from '../client/Tv.module.css';
import trackCss from '../client/RaceTrack.module.css';
import podiumCss from '../client/Podium.module.css';
import phoneStageCss from '../client/PhoneStage.module.css';
import stageCss from '../../../packages/game-sdk/src/tv/Stage.module.css';
import avatarCss from '../../../packages/game-sdk/src/ui/Avatar.module.css';

const kit = testKit(game, {
  players: testPlayers(8),
  settings: { questions: 12 },
  t0: 1700000000000,
});
function fixtures(): Record<string, State> {
  let race = kit.start({ seed: 23 });
  for (let i = 0; i < 8; i++) {
    const id = `p${i + 1}`;
    for (let n = 0; n < i + 1; n++) {
      const q = race.deck[race.runners[id]!.answered]!;
      race = kit.input(
        race,
        id,
        { type: 'answer', index: n, questionId: q.id, choice: q.correctIndex },
        race.clock + 50,
      );
      race = kit.timer(race, race.clock);
      race = kit.input(race, id, { type: 'next', index: n + 1 }, race.clock + 50);
    }
  }
  race = kit.input(
    race,
    'p8',
    { type: 'power', power: 'freeze', target: 'p1', charge: 2 },
    race.clock + 50,
  );
  const podium = kit.vip(race, 'skip', race.clock + 100);
  const podium2 = kit.timer(podium);
  const podium3 = kit.timer(podium2);
  const done = kit.timer(podium3);
  const feedback = kit.input(
    race,
    'p2',
    { type: 'answer', index: 2, questionId: race.deck[2]!.id, choice: race.deck[2]!.correctIndex },
    race.clock + 100,
  );
  const tie = kit.vip(kit.start(), 'end', kit.t0 + 1000);
  const tiedStart: State = {
    ...kit.start(),
    players: Object.fromEntries(
      Object.entries(kit.start().players).map(([id, player]) => [
        id,
        { ...player, name: `Alexandria Challenger ${id}` },
      ]),
    ),
  };
  let tiePodium = kit.vip(tiedStart, 'skip', kit.t0 + 1000);
  let remainingTieBeats = 3;
  while (tiePodium.phase.id === 'podium' && tiePodium.podiumStep < 3 && remainingTieBeats > 0) {
    tiePodium = kit.timer(tiePodium);
    remainingTieBeats -= 1;
  }
  let finished = kit.start({ settings: { questions: 6 } });
  for (let n = 0; n < 6; n++) {
    const q = finished.deck[n]!;
    finished = kit.input(
      finished,
      'p1',
      { type: 'answer', index: n, questionId: q.id, choice: q.correctIndex },
      finished.clock + 50,
    );
    if (n < 5)
      finished = kit.input(finished, 'p1', { type: 'next', index: n + 1 }, finished.clock + 50);
  }
  const longest = Object.values(PACKS)
    .flatMap((p) => p.questions)
    .sort((a, b) => b.prompt.length - a.prompt.length)[0]!;
  const long: State = { ...kit.start(), deck: [longest, ...kit.start().deck.slice(1)] };
  const stress: State = {
    ...long,
    deck: [
      questionSchema.parse({
        ...longest,
        prompt:
          'Which carefully described scientific object matches the following detailed description most closely?',
        options: [
          'A carefully described scientific object',
          'A completely different scientific object',
          'An unrelated natural object or substance',
          'Another plausible scientific explanation',
        ],
        explanation:
          'This deliberately long explanation checks that readable answer feedback fits with the score, progress, next control and earned powers on a tiny phone.',
      }),
      ...long.deck.slice(1),
    ],
  };
  const stressFeedback = kit.input(
    stress,
    'p1',
    {
      type: 'answer',
      index: 0,
      questionId: stress.deck[0]!.id,
      choice: stress.deck[0]!.correctIndex,
    },
    stress.clock + 100,
  );
  const ranking: State = {
    ...stress,
    players: Object.fromEntries(
      Object.entries(stress.players).map(([id, player]) => [
        id,
        { ...player, name: `Alexandria Challenger ${id}` },
      ]),
    ),
    deck: stress.deck.map((q, i) =>
      i === 0 ? long.deck[0]! : i === 3 ? { ...stress.deck[0]!, id: q.id } : q,
    ),
    runners: Object.fromEntries(
      Object.entries(stress.runners).map(([id, runner]) => [
        id,
        id === 'p1'
          ? { ...runner, answered: 12 }
          : id === 'p2' || id === 'p3'
            ? { ...runner, answered: 3, correct: 3, streak: 3, score: 360, energy: 1 }
            : id === 'p7'
              ? { ...runner, answered: 6, correct: 6, streak: 6, score: 840, energy: 1 }
              : runner,
      ]),
    ),
  };
  return {
    race,
    podium,
    'podium-2': podium2,
    'podium-3': podium3,
    done,
    feedback,
    finished,
    tie,
    'tie-podium': tiePodium,
    long,
    stress,
    'stress-feedback': stressFeedback,
    ranking,
  };
}
// Static content is imported once, so fixture generation has no filesystem dependency on questions.
import { PACKS } from '../server/content';

const mapping: [string, Record<string, string>][] = [
  ['packages/game-sdk/src/tv/Stage.module.css', stageCss],
  ['packages/game-sdk/src/ui/Avatar.module.css', avatarCss],
  ['games/trivia-lightning/client/Controller.module.css', controllerCss],
  ['games/trivia-lightning/client/Tv.module.css', tvCss],
  ['games/trivia-lightning/client/RaceTrack.module.css', trackCss],
  ['games/trivia-lightning/client/Podium.module.css', podiumCss],
  ['games/trivia-lightning/client/PhoneStage.module.css', phoneStageCss],
];
function css(): string {
  const modules = mapping
    .map(([file, classes]) =>
      readFileSync(resolve(file), 'utf8')
        .replace(/\.([a-zA-Z_][\w-]*)/g, (match, name: string) =>
          classes[name] ? `.${classes[name]}` : match,
        )
        .replace(/:global\(([^)]+)\)/g, '$1'),
    )
    .join('\n');
  return (
    readFileSync(resolve('design/tokens.css'), 'utf8') +
    '\n' +
    modules +
    '\n' +
    `
    * {box-sizing:border-box} html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}
    body{display:flex;flex-direction:column} .chrome{flex:none;height:70px;display:flex;align-items:center;justify-content:space-between;padding:var(--pb-space-3);font-weight:800;border-bottom:1px solid var(--pb-surface-2)}
    .mount{flex:1;min-height:0} .bottom{height:70px;flex:none;display:flex;align-items:center;justify-content:center;color:var(--pb-text-muted);font-size:var(--pb-font-caption)}
    [data-surface=tv] .chrome{height:120px;font-size:var(--pb-font-body);padding:var(--pb-space-5) var(--pb-overscan-x)} [data-surface=tv] .bottom{height:80px}
    [data-surface=tv] .mount{--pb-stage-top:var(--pb-space-5)}
  `
  );
}
function render(node: ReactNode, s: State, phoneOnly = false): string {
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={s.clock - Date.now()}>
      <PhoneOnlyProvider value={phoneOnly}>{node}</PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}
function html(body: string, surface: 'tv' | 'controller', title: string, name: string): string {
  return `<!doctype html><html lang="en" data-surface="${surface}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css()}</style></head><body><div class="chrome"><span>PB · R3</span><span>${name}</span></div><div class="mount">${body}</div><div class="bottom">${surface === 'tv' ? 'Trivia Lightning · PartyBox stage' : 'Trivia Lightning · Phone controller'}</div></body></html>`;
}
it('renders every phase and input substate, spectators, phone-only and ties', () => {
  const states = fixtures();
  const write = process.env['PB_WRITE_EVIDENCE'] === '1';
  const dir = resolve('jobs/P03-trivia-lightning/media');
  if (write) mkdirSync(dir, { recursive: true });
  if (write) {
    const ranking = states['ranking']!;
    const updated: State = {
      ...ranking,
      runners: {
        ...ranking.runners,
        p3: { ...ranking.runners['p3']!, answered: 7, correct: 7, streak: 7, score: 1000 },
      },
    };
    const unavailable = kit.player(ranking, 'p7', false, undefined, ranking.clock + 50);
    const doubleAccepted = kit.input(
      ranking,
      'p2',
      { type: 'power', power: 'double', charge: 1 },
      ranking.clock + 4550,
    );
    const freezeAccepted = kit.input(
      ranking,
      'p2',
      { type: 'power', power: 'freeze', target: 'p7', charge: 1 },
      ranking.clock + 4550,
    );
    const question = ranking.deck[3]!;
    const answerAccepted = kit.input(
      ranking,
      'p2',
      { type: 'answer', index: 3, questionId: question.id, choice: question.correctIndex },
      ranking.clock + 50,
    );
    const nextAccepted = kit.input(
      answerAccepted,
      'p2',
      { type: 'next', index: answerAccepted.runners['p2']!.answered },
      ranking.clock + 4550,
    );
    writeFileSync(
      resolve(dir, 'interaction-views.json'),
      JSON.stringify(
        Object.fromEntries(
          Object.entries({
            ranking,
            rankingUpdated: updated,
            freezeUnavailable: unavailable,
            doubleAccepted,
            freezeAccepted,
            answerAccepted,
            nextAccepted,
          }).map(([name, state]) => [
            name,
            { ...game.controllerView({ ...state, phoneOnly: true }, 'p2'), vip: null },
          ]),
        ),
        null,
        2,
      ) + '\n',
    );
  }
  for (const [name, s] of Object.entries(states)) {
    if (write && game.phases.includes(name)) {
      mkdirSync(resolve('games/trivia-lightning/fixtures'), { recursive: true });
      writeFileSync(
        resolve(`games/trivia-lightning/fixtures/${name}.json`),
        JSON.stringify(s, null, 2) + '\n',
      );
    }
    const tv = render(<Tv view={{ ...game.tvView(s), vip: null }} />, s);
    expect(tv).not.toContain('correctIndex');
    if (write)
      writeFileSync(resolve(dir, `tv-${name}.html`), html(tv, 'tv', `TV ${name}`, 'Public stage'));
    for (const phoneOnly of [false, true]) {
      for (const id of [name === 'feedback' || name === 'ranking' ? 'p2' : 'p1', 'spectator']) {
        const state = { ...s, phoneOnly };
        const view = { ...game.controllerView(state, id), vip: null };
        const phone = render(
          <Controller
            view={view}
            me={state.players[id] ?? { id, name: 'Spectator', avatarId: 'fox', connected: true }}
            send={() => undefined}
          />,
          state,
          phoneOnly,
        );
        expect(phone).not.toContain('correctIndex');
        if (phoneOnly) expect(phone).not.toMatch(/on the TV|Look at the TV/);
        if (id === 'spectator') expect(phone).not.toMatch(/<button|<select/);
        if (write)
          writeFileSync(
            resolve(dir, `phone-${name}-${phoneOnly ? 'only' : 'tv'}-${id}.html`),
            html(phone, 'controller', `Phone ${name}`, id),
          );
      }
    }
  }
});
