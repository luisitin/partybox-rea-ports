// Styled phase captures from a real seeded eight-bot match; no browser runs in Vitest.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import type { State } from '../server/types';

const LONG_NAMES = [
  'Alexandria Montgomery',
  'Benedict Cunningham',
  'Cassandra Wellington',
  'Dominic Featherstone',
  'Elisabeth Rutherford',
  'Frederick Kensington',
  'Gabriella Worthington',
  'Harrison Chamberlain',
];

function pageHtml(body: string, title: string, css: string, tv: boolean): string {
  return `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'phone'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family);font-size:16px}body{display:flex;flex-direction:column}main{display:flex;min-height:0;flex:1}button,input{font-family:inherit}h1,h2,h3,p{line-height:1.25}.shell{height:${tv ? 0 : 80}px;flex:none;padding:var(--pb-space-4);font-size:var(--pb-font-body);color:var(--pb-text-muted)}
    </style><body>${tv ? '' : '<div class="shell">PB · BONK · Connected</div>'}<main>${body}</main>${tv ? '' : '<div class="shell">Bonk.io · phone shell reserved space</div>'}</body></html>`;
}

it('renders all phases and room roles with the real public views', async () => {
  const players = testPlayers(8, { bots: 8 });
  const kit = testKit(game, { players, t0: 1_000_000 });
  const rng = createRng(73);
  const ready = kit.start({ seed: 73 });
  let state = kit.timer(ready);
  const opening = state;
  let play = state;
  let finalOut: State | undefined;
  let score: State | undefined;
  let decisionRound = 0;
  let nextDecision = 0;
  for (let events = 0; game.results(state) === null; events++) {
    if (events > 10_000) throw new Error('Artifact match did not terminate');
    const at = state.phase.deadline;
    if (at === null) throw new Error('Untimed nonterminal fixture');
    if (state.phase.id === 'play' && decisionRound !== state.round) {
      decisionRound = state.round;
      nextDecision = 0;
    }
    if (state.phase.id === 'play' && state.checked >= nextDecision) {
      const snapshot = state;
      const now = state.began + state.checked;
      const decisions = rng
        .shuffle(players)
        .map((p) => ({ id: p.id, input: game.bot.sampleInput(snapshot, p.id, rng, 'normal') }));
      for (const { id, input } of decisions) if (input) state = kit.input(state, id, input, now);
      nextDecision += 200;
    }
    state = kit.timer(state, at);
    if (state.phase.id === 'play' && state.round === 1 && state.checked <= 8_000) play = state;
    if (
      state.phase.id === 'play' &&
      state.round === state.rounds &&
      state.world.balls.some((ball) => !ball.alive)
    )
      finalOut = state;
    if (state.phase.id === 'score') score = state;
  }
  if (!score) throw new Error('No scored round in artifact match');
  const fixtures: Record<string, State> = { ready, play, score, done: state };
  const build = process.env['PB_BUILD_ARTIFACTS'] === '1';
  const media = resolve('jobs/P23-bonk-io/media');
  if (build) {
    mkdirSync(media, { recursive: true });
    mkdirSync(resolve('games/bonk-io/fixtures'), { recursive: true });
  }
  const cssPaths = [
    ...readdirSync(resolve('games/bonk-io/client'))
      .filter((name) => name.endsWith('.module.css'))
      .map((name) => `../client/${name}`),
    '../../../packages/game-sdk/src/controller/Screen.module.css',
    '../../../packages/game-sdk/src/tv/Stage.module.css',
  ];
  const css =
    readFileSync(resolve('design/tokens.css'), 'utf8') +
    '\n' +
    (
      await Promise.all(
        cssPaths.map(async (path) => {
          const names = (await import(path)).default as Record<string, string>;
          return readFileSync(resolve('games/bonk-io/__tests__', path), 'utf8')
            .replace(/\.([a-zA-Z][\w-]*)/g, (match, name: string) =>
              names[name] ? `.${names[name]}` : match,
            )
            .replace(/global\(([^)]+)\)/g, '$1');
        }),
      )
    ).join('\n');
  function render(fixture: State, mode: string, label: string): void {
    const tv = mode === 'tv';
    const only = mode.includes('only');
    const spectator = mode.includes('spectator');
    const id = spectator
      ? 'audience'
      : (fixture.world.balls.find((b) => (mode.includes('out') ? !b.alive : b.alive))?.id ??
        players[0]!.id);
    let staged: State = {
      ...fixture,
      ...(only ? { phoneOnly: true as const } : {}),
      ...(mode === 'phone-remote'
        ? { players: { ...fixture.players, [id]: { ...fixture.players[id]!, canSeeTv: false } } }
        : {}),
    };
    const now =
      fixture.phase.id === 'play' ? fixture.began + fixture.checked : fixture.phase.startedAt;
    if (mode.includes('paused')) staged = kit.vip(staged, 'pause', now);
    if (mode.endsWith('left')) staged = kit.player(staged, id, false, 'left', now);
    const body = renderToStaticMarkup(
      <ServerClockProvider offsetMs={now - Date.now()}>
        <PhoneOnlyProvider value={only}>
          {tv ? (
            <Tv view={{ ...game.tvView(staged), vip: null }} />
          ) : (
            <Controller
              view={{ ...game.controllerView(staged, id), vip: null }}
              me={staged.players[id] ?? { id, name: 'Audience', avatarId: 'fox' }}
              send={() => undefined}
            />
          )}
        </PhoneOnlyProvider>
      </ServerClockProvider>,
    );
    expect(body).toMatch(/<h[12]/);
    if (spectator || mode.endsWith('left')) expect(body).not.toContain('<button');
    if (only || mode === 'phone-remote')
      expect(body).not.toMatch(/on the TV|watch the TV|look at the TV/i);
    if (build)
      writeFileSync(
        resolve(media, `${label}-${mode}.html`),
        pageHtml(body, `${label} ${mode}`, css, tv),
      );
  }
  for (const [phase, fixture] of Object.entries(fixtures)) {
    expect(fixture.phase.id).toBe(phase);
    if (build)
      writeFileSync(
        resolve(`games/bonk-io/fixtures/${phase}.json`),
        JSON.stringify(fixture, null, 2) + '\n',
      );
    for (const mode of [
      'tv',
      'phone',
      'phone-only',
      'phone-remote',
      'phone-spectator',
      'phone-only-spectator',
      ...(phase === 'play'
        ? ['phone-paused', 'phone-only-paused', 'phone-left', 'phone-only-left']
        : []),
    ])
      render(fixture, mode, phase);
  }
  const out: State = {
    ...play,
    world: {
      ...play.world,
      balls: play.world.balls.map((b, i) => (i === 0 ? { ...b, alive: false, cause: 'fall' } : b)),
    },
  };
  render(out, 'phone-out', 'play');
  render(out, 'phone-only-out', 'play');
  if (!finalOut) throw new Error('No final-round eliminated player in artifact match');
  render(finalOut, 'tv', 'play-final-out');
  render(finalOut, 'phone-out', 'play-final-out');
  render(finalOut, 'phone-only-out', 'play-final-out');
  const long = (fixture: State): State => ({
    ...fixture,
    players: Object.fromEntries(
      Object.entries(fixture.players).map(([id, p], i) => [
        id,
        { ...p, name: LONG_NAMES[i] ?? p.name },
      ]),
    ),
  });
  render(long(fixtures.done!), 'phone-only', 'done-long');
  render(long(fixtures.done!), 'phone-only-spectator', 'done-long');
  render(long(opening), 'tv', 'play-long');
  const crowded: State = {
    ...opening,
    world: {
      ...opening.world,
      balls: opening.world.balls.map((b, i) =>
        i < 2 ? { ...b, x: 440 + i * 56, y: 350, heavy: true } : b,
      ),
    },
  };
  render(crowded, 'tv', 'play-crowded');
  render(crowded, 'phone-only-spectator', 'play-crowded');
  const above: State = {
    ...opening,
    world: {
      ...opening.world,
      balls: opening.world.balls.map((ball, index) =>
        index < 2
          ? { ...ball, x: 480 + index * 80, y: index === 0 ? -80 : -10, heavy: index === 1 }
          : ball,
      ),
    },
  };
  render(above, 'tv', 'play-above-arena');
  render(above, 'phone-only-spectator', 'play-above-arena');
  const skipped = kit.vip(opening, 'skip', opening.began + 40);
  expect(skipped.phase.id).toBe('score');
  expect(skipped.world.balls.filter((ball) => ball.alive)).toHaveLength(8);
  render(skipped, 'tv', 'score-skipped');
  render(skipped, 'phone-only', 'score-skipped');
  const hazard = kit.timer(opening, opening.began + 20_000);
  expect(hazard.phase.id).toBe('play');
  expect(game.tvView(hazard).hazard).toBe(true);
  render(hazard, 'tv', 'play-hazard');
  render(hazard, 'phone-only', 'play-hazard');
}, 30_000);
