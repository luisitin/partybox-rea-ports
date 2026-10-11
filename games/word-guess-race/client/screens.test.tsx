// Every actual phase, both phone modes and spectators; optionally saves the exact rendered pages.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { game } from '../server/index';
import type { State } from '../server/types';
import { Controller } from './Controller';
import { Tv } from './Tv';
import { keyboardMarks, clockText } from './tiles';
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
