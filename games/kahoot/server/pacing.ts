// Classic reading budgets mirror the separate chart, standings and podium layouts.
import { categoryLabel, drawLabel, questionById } from './content';
import { classicPackLabel } from './classic';
import { readMs, wordCount, isFinalIndex, isLastIndex, quizModeOf } from './types';
import type { State } from './types';
import { revealedPodiumEntries } from './standings';
import { labelOf } from '../content/schema';

function current(state: State) {
  return questionById(state.questionIds[Math.max(0, state.index)] ?? '', state.contentLang);
}
function questionWords(state: State): number {
  const q = current(state);
  return q ? wordCount(q.question) + q.choices.reduce((n, text) => n + wordCount(text), 0) : 0;
}
function rosterWords(state: State, numbers: number): number {
  return Object.values(state.players).reduce((n, p) => n + wordCount(p.name) + numbers, 0);
}
export function classicIntroMs(state: State): number {
  const pack = classicPackLabel(state.settings.classicPack ?? 'general');
  return readMs(
    Math.max(
      wordCount(`Kahoot! ${pack} faster is worth more`),
      wordCount('Kahoot! First question coming up'),
    ),
  );
}
export function wagerIntroMs(state: State): number {
  const pack = drawLabel(state.drawnFrom, state.drawnSubs ?? []);
  return readMs(
    Math.max(
      wordCount(`Kahoot! ${pack} faster is worth more`),
      wordCount(`Kahoot! ${pack} First question coming up`),
    ),
  );
}
export function questionReadingMs(state: State): number {
  // Question n of m, answered count, four shape labels, clock; the host's name/score strip.
  const q = current(state);
  const topic =
    q && quizModeOf(state) === 'wager'
      ? wordCount(`${categoryLabel(q.category)} ${labelOf(q.subcategory)} ${q.difficulty}`)
      : 0;
  const tv = questionWords(state) + 4 + 4 + 4 + 1 + rosterWords(state, 1) + topic;
  // Phone-only question and four options plus its prompt/selection receipt.
  const phone =
    questionWords(state) +
    4 +
    4 +
    1 +
    4 +
    (state.contentLang === 'es' && quizModeOf(state) === 'classic' ? 3 : 0);
  // Wager's final phone also names its stake; classic's shapes do not need that line.
  const wagerFooter = isFinalIndex(state, state.index) ? 4 : 0;
  return readMs(Math.max(tv, phone + wagerFooter));
}
export function classicQuestionMs(state: State): number {
  return Math.max(state.settings.answerSeconds * 1000, questionReadingMs(state));
}
export function wagerReadingMs(state: State): number {
  const final = questionById(
    state.questionIds[state.questionIds.length - 1] ?? '',
    state.contentLang,
  );
  const topic = final
    ? wordCount(
        `${categoryLabel(final.category)} ${labelOf(final.subcategory)} ${final.difficulty}`,
      )
    : 0;
  const leader = Math.max(0, ...Object.values(state.players).map((p) => wordCount(p.name))) + 3;
  const tv =
    wordCount(
      'Final question next 16 of 16 placed Place your wagers Final question Right answer wins the bet wrong answer loses it',
    ) +
    topic +
    rosterWords(state, 2) +
    leader;
  // Prompt, five preset shares/amounts, custom percentage/points and the final topic.
  const phone =
    wordCount(
      'Place your wager Choose a share or enter points Custom Percent Points Your score 99999 Final question',
    ) +
    10 +
    wordCount(state.drawnFrom) +
    6;
  return readMs(Math.max(tv, phone));
}

export interface WagerRevealBeats {
  raceMs: number;
  standingsMs: number;
}
export function wagerRevealBeats(state: State): WagerRevealBeats {
  const q = current(state);
  const topic = q
    ? wordCount(`${categoryLabel(q.category)} ${labelOf(q.subcategory)} ${q.difficulty}`)
    : 0;
  const answer = q ? wordCount(q.choices[q.answerIndex] ?? '') : 0;
  const prompt = q ? wordCount(q.question) : 0;
  const players = Object.keys(state.players).length;
  const names = rosterWords(state, 0);
  if (isFinalIndex(state, state.index)) {
    // Header/prompt/answer, then names, verdicts, bets, totals and deltas; staged phones also read them.
    const tv = 6 + topic + prompt + answer + 3 + names + players * 6;
    const phone = 4 + questionWords(state) + 4 + 16 + names + players * 5;
    // FinalReveal's last verdict (max1.5s stagger), 600ms totals gap and600ms settle.
    const animation = 1_200 + Math.min(1_500, Math.max(0, players - 1) * 300) + 600 + 600;
    return { raceMs: animation + readMs(Math.max(tv, phone)), standingsMs: 0 };
  }
  const common = 4 + topic + prompt + 11 + answer + 3;
  const streaks = Object.values(state.streaks).filter((n) => n >= 2).length;
  const correct = Object.keys(state.picks).filter(
    (id) => state.picks[id]?.index === q?.answerIndex,
  ).length;
  const rowWords = names + players * (players <= 8 ? 3 : 2) + streaks;
  const phone = 4 + questionWords(state) + 4 + 16 + names + players * 3;
  const race = common + rowWords + correct * 2 + (correct > 0 ? 1 : 0) + 1;
  const next = Math.max(0, ...Object.values(state.players).map((p) => wordCount(p.name))) + 5;
  const board = common + rowWords + next;
  return {
    raceMs: 2_000 + readMs(Math.max(race, phone)),
    standingsMs: readMs(Math.max(board, phone)),
  };
}
export interface ClassicRevealBeats {
  chartMs: number;
  standingsMs: number;
}
export function classicRevealBeats(state: State): ClassicRevealBeats {
  const q = current(state);
  const explanation = q && 'explanation' in q ? wordCount(q.explanation) : 0;
  const missed = Object.keys(state.players).length - Object.keys(state.picks).length;
  // Ordinal, prompt/options, four shape/count pairs, Correct, explanation and missing count.
  const chart = 4 + questionWords(state) + 8 + 2 + explanation + (missed > 0 ? 4 : 0);
  const own = Math.max(
    ...Object.keys(state.players).map((id) => {
      const delta = state.lastDelta[id] ?? 0;
      const streak = state.streaks[id] ?? 0;
      return (
        wordCount(
          `${delta > 0 ? 'Correct!' : Object.hasOwn(state.picks, id) ? 'Wrong' : 'Too slow'} +${delta} points ${state.scores[id] ?? 0} total`,
        ) +
        (streak > 1 ? wordCount(`${streak} correct in a row`) : 0) +
        wordCount('1000 speed points +300 streak bonus') +
        wordCount(isLastIndex(state, state.index) ? 'The podium is next' : 'Place 16')
      );
    }),
    0,
  );
  // A staged phone can show the chart with its own receipt; a TV-visible phone shows just the receipt.
  const chartMs = readMs(chart + own);
  if (isLastIndex(state, state.index)) return { chartMs, standingsMs: 0 };
  // Question n of m + Scoreboard; each full row is rank/name/score/delta.
  const tvBoard = 4 + 1 + rosterWords(state, 3);
  const phoneBoard = 4 + 1 + rosterWords(state, 2) + own;
  return { chartMs, standingsMs: readMs(Math.max(tvBoard, phoneBoard)) };
}
export function podiumMs(state: State): number {
  const entries = revealedPodiumEntries(state);
  const rows = entries.reduce((n, row) => n + wordCount(row.name) + 3, 0);
  const heading = wordCount('The podium Third place');
  // Stage phones show these public rows and, once their tier is unveiled, their own receipt.
  const own = Math.max(
    0,
    ...entries.map(
      (row) =>
        wordCount(`Place ${row.rank} ${row.score} points`) +
        ((state.streaks[row.playerId] ?? 0) >= 2
          ? wordCount(`${state.streaks[row.playerId]} correct in a row`)
          : 0),
    ),
  );
  const stage = heading + rows + 3; // The three plinth labels remain visible before their names.
  const phone =
    heading + Math.max(rows + 3, wordCount('The final places are being revealed')) + own;
  return readMs(Math.max(stage + rosterWords(state, 0), phone));
}
