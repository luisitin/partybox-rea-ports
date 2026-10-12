import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import type { State } from '../server/types';
import { drawing, guesser, kit } from '../__tests__/helpers';
import { Roster } from './Roster';

function render(state: State, final = false): string {
  const view = game.tvView(state);
  return renderToStaticMarkup(<Roster board={view} players={view.players} final={final} />);
}

function row(markup: string, name: string): string {
  return (markup.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? []).find((item) =>
    item.includes(`title="${name}"`),
  )!;
}

describe('roster connection status', () => {
  it('marks a disconnected unsolved seat Offline instead of Guessing, then restores Guessing', () => {
    const start = drawing();
    const id = guesser(start);
    const dropped = kit.player(start, id, false, undefined, start.began + 1000);
    const offline = row(render(dropped), start.players[id]!.name);
    expect(offline).toContain('role="img" aria-label="Offline">○</span>');
    expect(offline).toContain('<span aria-hidden="true">Offline</span>');
    expect(offline).not.toContain('Guessing');
    const rejoined = kit.player(dropped, id, true, undefined, start.began + 1500);
    const online = row(render(rejoined), start.players[id]!.name);
    expect(online).toContain('aria-label="Guessing">·</span>');
    expect(online).not.toContain('>Offline<');
  });

  it('retains the solved check and earned points when a solver disconnects', () => {
    const start = drawing();
    const id = guesser(start);
    const solved = kit.input(start, id, { type: 'guess', text: start.word }, start.began + 6000);
    const dropped = kit.player(solved, id, false, undefined, start.began + 7000);
    const markup = render(dropped);
    const offline = row(markup, start.players[id]!.name);
    expect(offline).toContain('data-solved="true"');
    expect(offline).toContain('aria-label="Solved · Offline">✓</span>');
    expect(offline).toContain('>Offline<');
    expect(offline).toMatch(/<b\b[^>]*>860<\/b>/);
    expect(markup.match(/<li\b/g)).toHaveLength(Object.keys(start.players).length);
    expect(dropped.scores).toEqual(solved.scores);
  });

  it('keeps the artist identity visible after their departure ends the drawing turn', () => {
    const start = drawing();
    const dropped = kit.player(start, start.drawer, false, undefined, start.began + 1000);
    expect(dropped.phase.id).toBe('reveal');
    const offline = row(render(dropped), start.players[start.drawer]!.name);
    expect(offline).toContain('aria-label="Artist · Offline">✎</span>');
    expect(offline).toContain('>Offline<');
  });

  it('keeps disconnected winners in final standings without stale connection or drawing labels', () => {
    const start = drawing();
    const id = guesser(start);
    const ended = kit.vip(start, 'end', start.began + 1000);
    const dropped = kit.player(ended, id, false, undefined, start.began + 1500);
    const final = { ...dropped, scores: { ...dropped.scores, [id]: 1000 } };
    const markup = render(final, true);
    const winner = row(markup, start.players[id]!.name);
    expect(winner).toContain('aria-label="Winner, place 1">★</span>');
    expect(winner).toMatch(/<b\b[^>]*>1000<\/b>/);
    expect(markup.match(/<li\b/g)).toHaveLength(Object.keys(start.players).length);
    expect(markup).not.toContain('>Offline<');
    expect(markup).not.toMatch(/aria-label="(?:Artist|Solved|Guessing|Offline)/);
  });
});
