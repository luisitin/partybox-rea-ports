import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readingMs, wordCount } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server';
import type { State } from '../server/types';

const T0 = 1_000_000;

function visibleWords(html: string): number {
  // Count each rendered text node separately, so adjacent numeric cells remain readable tokens.
  return [...html.matchAll(/>([^<>]+)</g)].reduce((n, match) => n + wordCount(match[1]!), 0);
}

function renderedFloor(state: State): number {
  const tv = renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
  const counts = [visibleWords(tv)];
  for (const phoneOnly of [false, true]) {
    for (const id of [...Object.keys(state.players), 'spectator']) {
      counts.push(
        visibleWords(
          renderToStaticMarkup(
            <PhoneOnlyProvider value={phoneOnly}>
              <Controller
                view={{ ...game.controllerView(state, id), vip: null }}
                me={{ id, name: state.players[id]?.name ?? 'Spectator', avatarId: 'fox' }}
                send={() => undefined}
              />
            </PhoneOnlyProvider>,
          ),
        ),
      );
    }
  }
  return readingMs(Math.max(...counts), { ui: true });
}

describe('result screens retain their full reading time', () => {
  it.each([2, 8])(
    'holds every rendered result for %i seats, including long names and full boards',
    (count) => {
      const players = testPlayers(count).map((p, i) => ({
        ...p,
        name: count === 8 ? `Player ${i + 1} With A Very Long Friendly Living Room Name` : p.name,
      }));
      const kit = testKit(game, { t0: T0, players, seed: 19 });
      const initial = kit.start();
      const full: State = {
        ...initial,
        racers: Object.fromEntries(
          Object.entries(initial.racers).map(([id, racer], i) => [
            id,
            { ...racer, board: Array<number>(16).fill(2 ** (i + 1)), score: i * 128 },
          ]),
        ),
      };
      const reveal = kit.timer(full);
      const deadline = reveal.phase.deadline!;
      expect(reveal.phase.id).toBe('reveal');
      expect(deadline - reveal.phase.startedAt).toBeGreaterThanOrEqual(renderedFloor(reveal));
      expect(deadline - reveal.phase.startedAt).toBeGreaterThan(8000);
      expect(kit.timer(reveal, deadline - 1)).toBe(reveal);
      expect(kit.timer(reveal, deadline).phase.id).toBe('done');
      expect(game.tvView(reveal)).not.toHaveProperty('spawns');
      expect(game.controllerView(reveal, players[0]!.id)).not.toHaveProperty('rng');
    },
  );

  it('uses the same result hold after a target finish and preserves it across pause/resume', () => {
    const kit = testKit(game, { t0: T0, players: testPlayers(2), seed: 19 });
    const initial = kit.start();
    const ready: State = {
      ...initial,
      racers: {
        ...initial.racers,
        p1: { ...initial.racers.p1!, board: [1024, 1024, ...Array<number>(14).fill(0)] },
      },
    };
    const reveal = kit.input(ready, 'p1', { type: 'move', dir: 'left', move: 0 }, T0 + 500);
    expect(reveal.reason).toBe('target');
    expect(reveal.phase.deadline! - reveal.phase.startedAt).toBeGreaterThanOrEqual(
      renderedFloor(reveal),
    );
    const paused = kit.vip(reveal, 'pause', T0 + 1000);
    expect(kit.timer(paused)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', T0 + 6000);
    expect(resumed.phase.deadline).toBe(reveal.phase.deadline! + 5000);
    expect(kit.timer(resumed, resumed.phase.deadline! - 1)).toBe(resumed);
    expect(kit.timer(resumed).phase.id).toBe('done');
  });
});
