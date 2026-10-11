// Fixture-based SSR for review captures. Clock rebasing preserves relative physics history.
import type { JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../games/dino-dash/client/Controller';
import { Tv } from '../../games/dino-dash/client/Tv';
import { game } from '../../games/dino-dash/server/index';
import type { State } from '../../games/dino-dash/server/types';

export interface CaptureCase {
  name: string;
  surface: 'tv' | 'phone';
  phoneOnly: boolean;
  viewer: string;
  reduced: boolean;
  state: State;
}

export function rebase(state: State, now: number): State {
  const shift = now - state.began - state.world.checked;
  return {
    ...state,
    began: state.began + shift,
    endsAt: state.endsAt + shift,
    phase: {
      ...state.phase,
      startedAt: state.phase.startedAt + shift,
      deadline: state.phase.deadline === null ? null : state.phase.deadline + shift,
      ...(state.phase.paused ? { paused: { at: state.phase.paused.at + shift } } : {}),
    },
  };
}

export function captureCases(fixtures: Record<string, State>): CaptureCase[] {
  const cases: CaptureCase[] = [];
  for (const [phase, state] of Object.entries(fixtures)) {
    const viewer = Object.keys(state.players)[0] ?? 'spectator';
    cases.push({
      name: `${phase}-tv`,
      surface: 'tv',
      phoneOnly: false,
      viewer,
      reduced: false,
      state,
    });
    for (const phoneOnly of [false, true]) {
      const mode = phoneOnly ? 'phone-only' : 'with-tv';
      cases.push({
        name: `${phase}-${mode}`,
        surface: 'phone',
        phoneOnly,
        viewer,
        reduced: false,
        state,
      });
      cases.push({
        name: `${phase}-${mode}-spectator`,
        surface: 'phone',
        phoneOnly,
        viewer: 'spectator',
        reduced: false,
        state,
      });
    }
  }
  const play = fixtures.play;
  if (play) {
    const viewer = Object.keys(play.players)[0] ?? 'spectator';
    const base: CaptureCase = {
      name: '',
      surface: 'phone',
      phoneOnly: true,
      viewer,
      reduced: false,
      state: play,
    };
    cases.push({ ...base, name: 'play-phone-only-reduced', reduced: true });
    cases.push({
      ...base,
      name: 'play-phone-only-paused',
      state: { ...play, phase: { ...play.phase, paused: { at: play.began + play.world.checked } } },
    });
    cases.push({
      ...base,
      name: 'play-phone-only-dead',
      state: {
        ...play,
        world: {
          ...play.world,
          runners: play.world.runners.map((r) =>
            r.id === viewer ? { ...r, died: play.world.checked } : r,
          ),
        },
      },
    });
    cases.push({
      ...base,
      name: 'play-remote-with-tv',
      phoneOnly: false,
      state: {
        ...play,
        players: { ...play.players, [viewer]: { ...play.players[viewer]!, canSeeTv: false } },
      },
    });
    const longNames = {
      ...play,
      players: Object.fromEntries(
        Object.entries(play.players).map(([id, p], n) => [
          id,
          { ...p, name: `Player ${n + 1} With A Long Display Name` },
        ]),
      ),
    };
    cases.push({ ...base, name: 'play-phone-only-long-names', state: longNames });
    cases.push({
      ...base,
      name: 'play-tv-long-names',
      surface: 'tv',
      phoneOnly: false,
      state: longNames,
    });
  }
  return cases;
}

export function CaptureSurface({ spec }: { spec: CaptureCase }): JSX.Element {
  const state = { ...spec.state, phoneOnly: spec.phoneOnly };
  const content =
    spec.surface === 'tv' ? (
      <Tv view={{ ...game.tvView(state), vip: null }} />
    ) : (
      <PhoneOnlyProvider value={spec.phoneOnly}>
        <Controller
          view={{ ...game.controllerView(state, spec.viewer), vip: null }}
          me={state.players[spec.viewer] ?? { id: spec.viewer, name: 'Spectator', avatarId: 'owl' }}
          send={() => undefined}
        />
      </PhoneOnlyProvider>
    );
  return (
    <div className="capture-shell">
      <header className="capture-header">
        <b>PartyBox</b>
        <span>Dino Dash · 8 players</span>
      </header>
      <main id="game-viewport">{content}</main>
      <footer className="capture-footer" />
    </div>
  );
}

export function renderCapture(spec: CaptureCase, now = Date.now()): string {
  const rebased = { ...spec, state: rebase(spec.state, now) };
  return renderToStaticMarkup(<CaptureSurface spec={rebased} />);
}
