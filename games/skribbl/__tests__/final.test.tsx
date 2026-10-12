import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { testPlayers } from '@partybox/game-sdk/testing';
import { Controller } from '../client/Controller';
import { Roster } from '../client/Roster';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import type { State } from '../server/types';
import { kit } from './helpers';

function finished(points: number[]): State {
  let state = kit.start({ players: testPlayers(8) });
  state = kit.input(state, state.drawer, { type: 'choose', index: 0 });
  state = kit.vip(state, 'end');
  const ids = Object.keys(state.players);
  return {
    ...state,
    scores: Object.fromEntries(ids.map((id, index) => [id, points[index] ?? 0])),
    // Final standings retain the last drawing; its artist/solver roles must not label the result.
    solved: Object.fromEntries(ids.filter((id) => id !== state.drawer).map((id) => [id, 860])),
  };
}

function rows(markup: string): string[] {
  return markup.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? [];
}

function expectAllScores(markup: string, state: State): void {
  const standings = rows(markup);
  expect(standings).toHaveLength(8);
  const scores = standings.map((row) => Number(/<b\b[^>]*>(\d+)<\/b>/.exec(row)?.[1]));
  expect(scores).toEqual(Object.values(state.scores).sort((a, b) => b - a));
  for (const player of Object.values(state.players)) expect(markup).toContain(player.name);
}

function surface(state: State, kind: 'tv' | 'phone' | 'phone-only' | 'spectator'): string {
  const id = kind === 'spectator' ? 'spectator' : Object.keys(state.players)[0]!;
  const controller = game.controllerView(state, id);
  const me = state.players[id] ?? {
    id,
    name: 'Spectator',
    avatarId: 'fox',
    connected: true,
  };
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={state.clock - Date.now()}>
      <PhoneOnlyProvider value={kind === 'phone-only'}>
        {kind === 'tv' ? (
          <Tv view={{ ...game.tvView(state), vip: null }} />
        ) : (
          <Controller view={{ ...controller, vip: null }} me={me} send={() => undefined} />
        )}
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}

describe('final standings', () => {
  it('marks every joint winner and ranks tied lower scores equally', () => {
    const state = finished([900, 900, 800, 700, 700, 500, 400, 0]);
    const view = game.tvView(state);
    // final also sorts a standalone roster even if its caller does not request ranked.
    const markup = renderToStaticMarkup(<Roster board={view} players={view.players} final />);
    const standings = rows(markup);
    expect(markup).toContain('aria-label="Final standings"');
    expect(standings.filter((row) => row.includes('data-winner="true"'))).toHaveLength(2);
    expect(markup.match(/aria-label="Joint winner, place 1"/g)).toHaveLength(2);
    expect(markup.match(/>Joint winner<\/span>/g)).toHaveLength(2);
    expect(markup.match(/aria-label="Place 4"/g)).toHaveLength(2);
    for (const rank of [3, 6, 7, 8]) expect(markup).toContain(`aria-label="Place ${rank}"`);
    expect(markup).not.toMatch(/aria-label="(?:Artist|Solved|Guessing)"/);
    expectAllScores(markup, state);
  });

  it('identifies a single winner by name, visible label and accessible star', () => {
    const state = finished([0, 100, 300, 500, 700, 900, 1100, 1500]);
    const markup = surface(state, 'tv');
    const winner = Object.values(state.players)[7]!;
    expect(markup).toContain(`${winner.name} wins!`);
    expect(markup).toContain('role="img" aria-label="Winner, place 1">★</span>');
    expect(markup.match(/>Winner<\/span>/g)).toHaveLength(1);
    expect(markup).not.toContain('Joint winner');
    expectAllScores(markup, state);
  });

  it.each(['tv', 'phone', 'phone-only', 'spectator'] as const)(
    'shows all eight final scores without stale drawing roles on %s',
    (kind) => {
      const state = finished([1250, 1250, 1100, 900, 800, 700, 300, 0]);
      const markup = surface(state, kind);
      expect(markup).toContain('A tie at the top!');
      expect(markup.match(/>Joint winner<\/span>/g)).toHaveLength(2);
      expect(markup).not.toMatch(/aria-label="(?:Artist|Solved|Guessing)"/);
      expect(markup).not.toContain('Artist:');
      expect(markup).not.toContain('guessed it');
      expect(markup).not.toContain('data-solved="true"');
      expectAllScores(markup, state);
    },
  );

  it('calls all eight players joint winners when their final totals are equal', () => {
    const state = finished(Array<number>(8).fill(0));
    const markup = surface(state, 'phone-only');
    expect(markup.match(/>Joint winner<\/span>/g)).toHaveLength(8);
    expect(markup.match(/aria-label="Joint winner, place 1"/g)).toHaveLength(8);
    expect(markup).not.toMatch(/aria-label="Place [2-8]"/);
    expectAllScores(markup, state);
  });

  it('keeps artist and solved markers during an ordinary turn reveal', () => {
    const state = finished([900, 800, 700, 600, 500, 400, 300, 0]);
    const view = game.tvView(state);
    const markup = renderToStaticMarkup(<Roster board={view} players={view.players} ranked />);
    expect(markup).toContain('aria-label="Artist"');
    expect(markup.match(/aria-label="Solved"/g)).toHaveLength(7);
    expect(markup).not.toContain('Winner');
  });
});
