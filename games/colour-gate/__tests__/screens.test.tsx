// SSR is the artifact generator, and pins the screen decisions independently of a browser.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { COLOURS, clockText, colourOf, gateMovement } from '../client/presentation';
import phoneCss from '../client/Controller.module.css';
import tvCss from '../client/Tv.module.css';
import laneCss from '../client/StageLane.module.css';
import sdkStageCss from '../../../packages/game-sdk/src/tv/Stage.module.css';
import sdkBigTextCss from '../../../packages/game-sdk/src/tv/BigText.module.css';
import sdkScreenCss from '../../../packages/game-sdk/src/controller/Screen.module.css';
import sdkButtonCss from '../../../packages/game-sdk/src/controller/PrimaryButton.module.css';
import { game } from '../server/index';
import type { State } from '../server/types';
import playJson from '../fixtures/play.json';
import scoreJson from '../fixtures/score.json';
import doneJson from '../fixtures/done.json';

const NOW = 1_900_000_000_000;
const media = new URL('../../../jobs/P18-colour-gate/media/', import.meta.url);
const fixtures: Record<string, State> = {
  play: playJson as unknown as State,
  score: scoreJson as unknown as State,
  done: doneJson as unknown as State,
};

/** Match the CSS module names in Vitest's SSR markup; no server or runtime network is needed. */
function moduleCss(path: string, names: Record<string, string>): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/\.([A-Za-z_][\w-]*)/g, (selector, name: string) =>
      names[name] ? `.${names[name]}` : selector,
    )
    .replace(/:global\(([^)]+)\)/g, '$1')
    .replace(/global\(([^)]+)\)/g, '$1');
}

const styles = [
  readFileSync(new URL('../../../design/tokens.css', import.meta.url), 'utf8'),
  moduleCss('../../../packages/game-sdk/src/tv/Stage.module.css', sdkStageCss),
  moduleCss('../../../packages/game-sdk/src/tv/BigText.module.css', sdkBigTextCss),
  moduleCss('../../../packages/game-sdk/src/controller/Screen.module.css', sdkScreenCss),
  moduleCss('../../../packages/game-sdk/src/controller/PrimaryButton.module.css', sdkButtonCss),
  moduleCss('../client/Tv.module.css', tvCss),
  moduleCss('../client/Controller.module.css', phoneCss),
  moduleCss('../client/StageLane.module.css', laneCss),
].join('\n');

function rebase(fixture: State, phoneOnly = false): State {
  const state = structuredClone(fixture);
  const shift = NOW - (state.began + state.world.checked);
  state.began += shift;
  state.endsAt += shift;
  state.phase.startedAt += shift;
  if (state.phase.deadline !== null) state.phase.deadline += shift;
  delete state.phase.paused;
  state.phoneOnly = phoneOnly;
  for (const player of Object.values(state.players)) player.canSeeTv = true;
  return state;
}

function capture(name: string, markup: string, tv: boolean): void {
  const width = tv ? 1920 : 390;
  const height = tv ? 1080 : 844;
  const base = `
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; }
    body { font-family: var(--pb-font-family); font-size: var(--pb-font-body); color: var(--pb-text); background: var(--pb-bg); line-height: 1.4; }
    h1, h2 { margin: 0; }
    h2 { font-size: var(--pb-font-h2); }
    button { font-family: inherit; border: 0; }
    #device { display: flex; flex-direction: column; width: ${width}px; height: ${height}px; overflow: hidden; }
    #capture { display: flex; flex: 1; min-height: 0; overflow: hidden; }
    .captureHeader { display: flex; align-items: center; justify-content: space-between; min-height: calc(var(--pb-touch) * 2); padding: var(--pb-space-4); font-weight: 900; font-size: var(--pb-font-body); background: var(--pb-surface); }
  `;
  mkdirSync(media, { recursive: true });
  writeFileSync(
    new URL(`${name}.html`, media),
    `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'phone'}" data-motion="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colour Gate · ${name}</title><style>${styles}\n${base}</style></head><body><div id="device">${tv ? '' : '<header class="captureHeader"><span>PB · Colour Gate</span><span>Player 1</span></header>'}<main id="capture">${markup}</main></div></body></html>`,
    'utf8',
  );
}

function phone(state: State, id: string, phoneOnly: boolean): string {
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={{ ...game.controllerView(state, id), vip: null }}
        me={state.players[id] ?? { id, name: 'Spectator', avatarId: 'fox' }}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe.each(Object.entries(fixtures))('screens: %s', (phase, fixture) => {
  it('renders the TV stage and every player at 1920×1080', () => {
    const state = rebase(fixture);
    const markup = renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
    for (const player of Object.values(state.players)) expect(markup).toContain(player.name);
    expect(markup).not.toContain('<canvas');
    if (phase === 'play') expect(markup.match(/<svg\b/g)).toHaveLength(8);
    capture(`tv-${phase}`, markup, true);
  });

  it.each([false, true])('renders the player controller: phoneOnly=%s', (phoneOnly) => {
    const state = rebase(fixture, phoneOnly);
    const markup = phone(state, 'p1', phoneOnly);
    expect(markup).not.toMatch(/Look at the TV|on the TV|Find your.*TV/i);
    if (phase === 'play') {
      expect(markup).toContain('Tap to rise');
      expect(markup.includes('<svg')).toBe(phoneOnly);
      expect(markup).toContain('Gold Circle');
      expect(markup).toContain('Gate now');
    } else {
      expect(markup).not.toContain('Tap to rise');
      for (const player of Object.values(state.players)) expect(markup).toContain(player.name);
    }
    capture(`phone-${phoneOnly ? 'only' : 'tv'}-${phase}`, markup, false);
  });

  it('gives a spectator the stage without gameplay controls', () => {
    const state = rebase(fixture);
    const markup = phone(state, 'spectator', false);
    expect(markup).not.toContain('<button');
    if (phase === 'play') expect(markup).toContain('<svg');
    for (const player of Object.values(state.players)) expect(markup).toContain(player.name);
    capture(`phone-spectator-${phase}`, markup, false);
  });

  it('makes a remote phone its own stage even beside a TV', () => {
    const state = rebase(fixture);
    state.players.p1!.canSeeTv = false;
    const markup = phone(state, 'p1', false);
    expect(game.controllerView(state, 'p1').phoneStage).toBe(true);
    if (phase === 'play') expect(markup).toContain('<svg');
    expect(markup).not.toMatch(/Look at the TV|on the TV/i);
    capture(`phone-remote-${phase}`, markup, false);
  });
});

describe('screen feedback', () => {
  it.each([-1, 1])(
    'the direction arrow follows a tile travelling with phase direction %s',
    (direction) => {
      const tileX = (elapsed: number): number => {
        const phase = 2 + (direction * elapsed) / 800;
        return 90 - (phase - Math.floor(phase)) * 36;
      };
      const visibleMovement = tileX(220) - tileX(200);
      expect(gateMovement(direction)).toBe(visibleMovement < 0 ? 'left' : 'right');
    },
  );

  it('shows a checkpoint retry, preserving progress and disabling the action', () => {
    const state = rebase(fixtures.play!, true);
    const runner = state.world.runners.find((r) => r.id === 'p1')!;
    runner.respawnAt = state.world.checked + 1200;
    const markup = phone(state, 'p1', true);
    expect(markup).toContain('RETRYING');
    expect(markup).toContain('checkpoint kept');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain(`${runner.gates} gates`);
    capture('phone-only-retry', markup, false);
    capture(
      'tv-retry',
      renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />),
      true,
    );
  });

  it('uses colour plus a different symbol and label for every collision colour', () => {
    expect(new Set(COLOURS.map((colour) => colour.symbol)).size).toBe(4);
    expect(new Set(COLOURS.map((colour) => colour.shape)).size).toBe(4);
    expect(COLOURS.map((colour) => colour.token)).toEqual([
      '--pb-player-1',
      '--pb-player-2',
      '--pb-player-3',
      '--pb-player-4',
    ]);
    expect(colourOf(-1)).toBe(COLOURS[3]);
    expect(clockText(-1)).toBe('0:00');
    expect(clockText(1001)).toBe('0:02');
  });
});
