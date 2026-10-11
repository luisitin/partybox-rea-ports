// Every actual phase, both phone modes and spectators; optionally saves the exact rendered pages.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { defaultSettingsOf, testPlayers, T0 } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { ACCEPTED } from '../server/content';
import type { State } from '../server/types';
import { Controller } from './Controller';
import { Tv } from './Tv';
import { keyboardMarks, clockText, solveTime, roundWinnerIds } from './tiles';
import phoneStyles from './Controller.module.css';
import tvStyles from './Tv.module.css';

const job = 'jobs/P10-word-guess-race';
const modes = ['tv', 'phone', 'phone-only', 'spectator'] as const;
const phases = ['guess', 'reveal', 'done'];

function css(path: string, names: Record<string, string>): string {
  return readFileSync(path, 'utf8')
    .replace(/:global\(([^)]+)\)/g, '$1')
    .replace(/\.([a-zA-Z][\w-]*)/g, (full, name: string) =>
      names[name] ? `.${names[name]}` : full,
    );
}

function page(html: string, surface: 'tv' | 'phone'): string {
  const tokens = readFileSync('design/tokens.css', 'utf8');
  const styles =
    css('games/word-guess-race/client/Tv.module.css', tvStyles) +
    css('games/word-guess-race/client/Controller.module.css', phoneStyles);
  const shell =
    '*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}main{height:100%;display:flex;flex-direction:column}header.shell{height:64px;flex:none;padding:16px;font-size:18px;background:var(--pb-surface)}.viewport{flex:1;min-height:0;display:flex;flex-direction:column} [data-surface=tv] header.shell{height:96px;padding:24px;font-size:36px}';
  return `<!doctype html><html lang="en" data-surface="${surface}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Word Guess Race</title><style>${tokens}\n${styles}\n${shell}</style></head><body><main><header class="shell">PB · HOUSE · Word Guess Race</header><div class="viewport">${html}</div></main></body></html>`;
}

describe.each(phases)('screens: %s', (phase) => {
  it.each(modes)('renders %s with private letters and a complete stage', (mode) => {
    const fixture = JSON.parse(
      readFileSync(`games/word-guess-race/fixtures/${phase}.json`, 'utf8'),
    ) as State;
    const state: State = {
      ...fixture,
      ...(mode === 'phone-only' || mode === 'spectator' ? { phoneOnly: true } : {}),
    };
    const id = mode === 'spectator' ? 'watcher' : Object.keys(state.players)[0]!;
    const clock = state.phase.startedAt + 1000;
    const element =
      mode === 'tv' ? (
        <Tv view={{ ...game.tvView(state), vip: null }} />
      ) : (
        <PhoneOnlyProvider value={mode === 'phone-only' || mode === 'spectator'}>
          <Controller
            view={{ ...game.controllerView(state, id), vip: null }}
            me={state.players[id] ?? { id, name: '', avatarId: 'fox', connected: true }}
            send={() => undefined}
          />
        </PhoneOnlyProvider>
      );
    const html = renderToStaticMarkup(
      <ServerClockProvider offsetMs={clock - Date.now()}>{element}</ServerClockProvider>,
    );
    expect(html).toContain('<h2');
    expect(html).not.toMatch(/Look at the TV|on the TV|One moment/);
    if (mode === 'tv' || mode === 'spectator') {
      for (const entry of Object.values(state.entries)) {
        for (const guess of entry.guesses) {
          if (guess.word !== state.answers[state.round - 1] || phase === 'guess')
            expect(html).not.toContain(guess.word.toUpperCase());
        }
      }
      for (const player of Object.values(state.players)) expect(html).toContain(player.name);
    }
    if (mode === 'spectator') expect(html).not.toContain('<button');
    if (phase === 'guess' && mode !== 'tv' && mode !== 'spectator') {
      expect(html).toContain('Letter keyboard');
      expect(html.match(/<button/g)?.length).toBe(28);
      expect(html).toContain('Guess');
    }
    if (phase === 'guess')
      expect(html).not.toContain(state.answers[state.round - 1]!.toUpperCase());
    else
      expect(html).toContain(
        phase === 'reveal'
          ? state.answers[state.round - 1]!.toUpperCase()
          : mode === 'tv'
            ? 'wins'
            : mode === 'spectator'
              ? 'Final standings'
              : 'finished',
      );
    if (process.env['P10_CAPTURE'] === '1') {
      mkdirSync(join(job, 'media'), { recursive: true });
      writeFileSync(
        join(job, 'media', `${phase}-${mode}.html`),
        page(html, mode === 'tv' ? 'tv' : 'phone'),
        'utf8',
      );
    }
  });
});

it('retains the strongest keyboard clue and formats the clock without negative seconds', () => {
  expect(
    keyboardMarks([
      { word: 'apple', marks: ['correct', 'present', 'absent', 'absent', 'absent'] },
      { word: 'angel', marks: ['absent', 'absent', 'absent', 'absent', 'absent'] },
    ]),
  ).toMatchObject({ a: 'correct', p: 'present' });
  expect(clockText(-100)).toBe('0:00');
  expect(clockText(61001)).toBe('1:02');
});

describe.each(['solved', 'exhausted', 'paused'] as const)('phone boundary: %s', (boundary) => {
  it.each(['phone', 'phone-only'] as const)(
    'keeps a complete %s stage with eight long names',
    (mode) => {
      const players = testPlayers(8).map((player, index) => ({
        ...player,
        name: `Alexandria Wonderland ${index + 1}`,
      }));
      let state = game.init({
        players,
        now: T0,
        seed: 146,
        settings: defaultSettingsOf(game),
        ...(mode === 'phone-only'
          ? { presence: { mode: 'together' as const, phoneOnly: true } }
          : {}),
      });
      const id = players[0]!.id;
      const wrong = ACCEPTED.filter((word) => word !== state.answers[0]).slice(0, 6);
      const words = boundary === 'solved' ? [...wrong.slice(0, 5), state.answers[0]!] : wrong;
      for (const [index, word] of words.entries()) {
        state = game.reduce(state, {
          type: 'input',
          playerId: id,
          input: { type: 'guess', word, round: 1 },
          now: T0 + (index + 1) * 1000,
        });
        if (boundary === 'paused' && index === 2) break;
      }
      if (boundary === 'paused')
        state = game.reduce(state, { type: 'vip', action: 'pause', now: T0 + 4000 });
      expect(state.phase.id).toBe('guess');
      const html = renderToStaticMarkup(
        <ServerClockProvider offsetMs={T0 + 7000 - Date.now()}>
          <PhoneOnlyProvider value={mode === 'phone-only'}>
            <Controller
              view={{ ...game.controllerView(state, id), vip: null }}
              me={players[0]!}
              send={() => undefined}
            />
          </PhoneOnlyProvider>
        </ServerClockProvider>,
      );
      expect(html).not.toContain('<button');
      expect(html).toContain('Race standings');
      for (const player of players) expect(html).toContain(player.name);
      expect(html).toContain(
        boundary === 'solved'
          ? 'Solved in 6'
          : boundary === 'exhausted'
            ? 'Six chances used'
            : 'Your word stays private',
      );
      if (process.env['P10_CAPTURE'] === '1')
        writeFileSync(join(job, 'media', `${boundary}-${mode}.html`), page(html, 'phone'), 'utf8');
    },
  );
});

it('makes millisecond speed differences and the round winner visible independently of match rank', () => {
  expect(solveTime(40101)).toBe('40.101s');
  expect(solveTime(40109)).toBe('40.109s');
  const state = JSON.parse(
    readFileSync('games/word-guess-race/fixtures/reveal.json', 'utf8'),
  ) as State;
  const view = { ...game.tvView(state), vip: null };
  const winners = roundWinnerIds(view);
  expect(winners.length).toBeGreaterThan(0);
  // A different match leader must not erase the current round's result.
  view.ranks = Object.fromEntries(
    view.grids.map((grid) => [grid.id, winners.includes(grid.id) ? 2 : 1]),
  );
  const html = renderToStaticMarkup(<Tv view={view} />);
  expect(html).toContain('Round win');
  expect(html).toContain(winners.length === 1 ? 'wins this round!' : 'share the round win');
  for (const grid of view.grids.filter((grid) => grid.solved))
    expect(html).toContain(solveTime(grid.elapsedMs!));
});
