// Render every phase in the requested viewports with shell space reserved; preserve HTML for review.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { game } from '../server/index';
import type { State } from '../server/types';
import { Tv } from '../client/Tv';
import { Controller } from '../client/Controller';
import { directionOf } from '../client/controls';
import phoneStyles from '../client/Controller.module.css';
import tvStyles from '../client/Tv.module.css';
import towerStyles from '../client/Tower.module.css';
import stageStyles from '../../../packages/game-sdk/src/tv/Stage.module.css';
import play from '../fixtures/play.json';
import reveal from '../fixtures/reveal.json';
import done from '../fixtures/done.json';

const states = { play, reveal, done } as unknown as Record<string, State>;
const media = 'jobs/P17-helix-drop/media';
mkdirSync(media, { recursive: true });

function moduleCss(file: string, classes: Record<string, string>): string {
  let css = readFileSync(file, 'utf8');
  css = css.replace(/\.([A-Za-z_][\w-]*)/g, (match, local: string) =>
    classes[local] ? `.${classes[local]}` : match,
  );
  return css.replace(/:global\(([^)]+)\)/g, '$1');
}
const css =
  readFileSync('design/tokens.css', 'utf8') +
  [
    ['games/helix-drop/client/Controller.module.css', phoneStyles],
    ['games/helix-drop/client/Tv.module.css', tvStyles],
    ['games/helix-drop/client/Tower.module.css', towerStyles],
    ['packages/game-sdk/src/tv/Stage.module.css', stageStyles],
  ]
    .map(([file, styles]) => moduleCss(file as string, styles as Record<string, string>))
    .join('\n');

function screen(state: State, mode: 'tv' | 'phone' | 'phone-only', id = 'p1'): string {
  const s = { ...state, phoneOnly: mode === 'phone-only' };
  const me = s.players[id] ?? { id, name: 'Spectator', avatarId: 'fox', connected: true };
  const element =
    mode === 'tv' ? (
      <Tv view={{ ...game.tvView(s), vip: null }} />
    ) : (
      <PhoneOnlyProvider value={mode === 'phone-only'}>
        <Controller
          view={{ ...game.controllerView(s, id), vip: null }}
          me={me}
          send={() => undefined}
        />
      </PhoneOnlyProvider>
    );
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={s.phase.startedAt - Date.now()}>{element}</ServerClockProvider>,
  );
}

function save(name: string, mode: 'tv' | 'phone' | 'phone-only', html: string): void {
  const tv = mode === 'tv';
  writeFileSync(
    `${media}/${name}-${mode}.html`,
    `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'controller'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Helix Drop ${name} ${mode}</title><style>${css}\n*{box-sizing:border-box}html,body{margin:0;width:${tv ? 1920 : 390}px;height:${tv ? 1080 : 844}px;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}body{display:flex;flex-direction:column}#shell{height:64px;flex:none;padding:var(--pb-space-3);font-size:var(--pb-font-body);display:flex;align-items:center}#view{flex:1;min-height:0;display:flex;flex-direction:column;padding-bottom:${tv ? 0 : 32}px}svg{max-width:100%}</style></head><body><div id="shell">PartyBox Â· Helix Drop</div><main id="view">${html}</main></body></html>\n`,
  );
}

describe('every phase, both phone room modes and spectators', () => {
  it.each(Object.entries(states))(
    '%s renders the stage, controls and standings honestly',
    (phase, state) => {
      for (const mode of ['tv', 'phone', 'phone-only'] as const) {
        const html = screen(state, mode);
        expect(html).toContain('<svg');
        expect(html).not.toMatch(/Look at the TV|on the TV|One moment/);
        expect(html.includes('Hold left to rotate')).toBe(
          phase === 'play' &&
            mode !== 'tv' &&
            state.runners[0]!.lives > 0 &&
            state.runners[0]!.respawnAt === null,
        );
        if (mode === 'phone-only' || phase !== 'play')
          for (const p of Object.values(state.players)) expect(html).toContain(p.name);
        save(phase, mode, html);
      }
      const spectator = screen(state, 'phone-only', 'spectator');
      expect(spectator).not.toContain('<button');
      if (phase === 'play') expect(spectator).toContain('Watch the dive');
      save(`${phase}-spectator`, 'phone-only', spectator);
    },
  );
  it('neutralises both held sides and renders recovery, exhausted and charged feedback', () => {
    expect(directionOf(false, false)).toBe(0);
    expect(directionOf(true, true)).toBe(0);
    expect(directionOf(true, false)).toBe(-1);
    expect(directionOf(false, true)).toBe(1);
    const s = states.play!;
    const variants = {
      recovery: {
        ...s,
        runners: s.runners.map((r, i) => (i ? r : { ...r, lives: 2, respawnAt: s.checked + 1200 })),
      },
      exhausted: {
        ...s,
        runners: s.runners.map((r, i) => (i ? r : { ...r, lives: 0, respawnAt: null })),
      },
      charged: {
        ...s,
        runners: s.runners.map((r, i) => (i ? r : { ...r, lives: 3, respawnAt: null, chain: 3 })),
      },
    };
    for (const [name, state] of Object.entries(variants))
      for (const mode of ['tv', 'phone', 'phone-only'] as const)
        save(name, mode, screen(state, mode));
    expect(screen(variants.recovery, 'phone-only')).toContain('Best depth stays');
    expect(screen(variants.exhausted, 'phone-only')).not.toContain('<button');
    expect(screen(variants.charged, 'phone-only')).toContain('SMASH charged');
  });
});
