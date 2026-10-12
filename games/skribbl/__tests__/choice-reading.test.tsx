import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readingMs, wordCount } from '@partybox/game-sdk';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { testPlayers } from '@partybox/game-sdk/testing';
import { Controller } from '../client/Controller';
import { DECKS } from '../server/content';
import { game } from '../server/index';
import { CHOOSE_MS } from '../server/types';
import { T0 } from './helpers';

const tiers = ['easy', 'medium', 'hard'] as const;
const previousHeading = 'Pick your secret word';
const previousInstruction = 'Pick a picture you can draw. Keep it secret!';

/** Highest word counts bound every eligible hand; longer strings break ties for fit review. */
function longestRead(words: readonly string[]): string[] {
  return [...words].sort((a, b) => wordCount(b) - wordCount(a) || b.length - a.length);
}

function worstHand(difficulty: string): string[] {
  return difficulty === 'mixed'
    ? tiers.map((tier) => longestRead(DECKS[tier]!)[0]!)
    : longestRead(DECKS[difficulty]!).slice(0, 3);
}

function renderChoose(difficulty: string, choices: string[], phoneOnly: boolean): string {
  const state = {
    ...game.init({
      players: testPlayers(8),
      settings: { difficulty },
      seed: 42,
      now: T0,
      presence: { mode: 'together' as const, phoneOnly },
    }),
    choices,
  };
  const view = { ...game.controllerView(state, state.drawer), vip: null };
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={T0 - Date.now()}>
      <PhoneOnlyProvider value={phoneOnly}>
        <Controller view={view} me={state.players[state.drawer]!} send={() => undefined} />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}

function plainText(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Core action copy is the rendered artist h2, the instruction immediately before the secret
 * choices group, and the three button words. Turn/clock metadata, accessible group labels and
 * numeric button indexes repeat across turns and are excluded from this new-action reading.
 */
function actionCopy(markup: string): { heading: string; instruction: string; words: string[] } {
  const heading = /<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(markup)?.[1];
  const groupAt = markup.indexOf('aria-label="Secret word choices"');
  expect(groupAt).toBeGreaterThan(-1);
  const paragraphs = [...markup.slice(0, groupAt).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)];
  const instruction = paragraphs.at(-1)?.[1];
  const buttons = [...markup.slice(groupAt).matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)];
  expect(heading).toBeDefined();
  expect(instruction).toBeDefined();
  expect(buttons).toHaveLength(3);
  return {
    heading: plainText(heading!),
    instruction: plainText(instruction!),
    words: buttons.map((button) =>
      plainText(button[1]!.replace(/<span\b[^>]*aria-hidden="true"[^>]*>\s*\d+\s*<\/span>/g, '')),
    ),
  };
}

describe('the artist can read every eligible hand before the choice timeout', () => {
  it.each([...tiers, 'mixed'])(
    'fits the longest %s action copy on a phone with a TV and a phone-only stage',
    (difficulty) => {
      const choices = worstHand(difficulty);
      expect(new Set(choices).size).toBe(3);
      const metrics: {
        phoneOnly: boolean;
        words: number;
        milliseconds: number;
        savedMs: number;
      }[] = [];
      for (const phoneOnly of [false, true]) {
        const copy = actionCopy(renderChoose(difficulty, choices, phoneOnly));
        expect(copy.heading).toBe('Pick a word');
        expect(copy.instruction).toBe('Keep it secret!');
        expect(copy.words).toEqual(choices);
        const text = [copy.heading, copy.instruction, ...copy.words].join(' ');
        const milliseconds = readingMs(wordCount(text), { ui: true });
        const previousText = [previousHeading, previousInstruction, ...copy.words].join(' ');
        const previousMs = readingMs(wordCount(previousText), { ui: true });
        expect(milliseconds).toBeLessThanOrEqual(CHOOSE_MS);
        expect(previousMs).toBeGreaterThan(CHOOSE_MS);
        expect(previousMs).toBeGreaterThan(milliseconds);
        if (difficulty === 'hard' || difficulty === 'mixed') {
          // Keeping the old four-word heading still costs 8,011 ms after shortening the instruction.
          const instructionOnly = [previousHeading, copy.instruction, ...copy.words].join(' ');
          expect(readingMs(wordCount(instructionOnly), { ui: true })).toBeGreaterThan(CHOOSE_MS);
        }
        metrics.push({
          phoneOnly,
          words: wordCount(text),
          milliseconds,
          savedMs: previousMs - milliseconds,
        });
      }
      console.info(
        'Artist choice reading budget:',
        JSON.stringify({ difficulty, choices, metrics }),
      );
    },
  );
});
