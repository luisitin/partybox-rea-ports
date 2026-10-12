// Classic reading budgets mirror the separate chart, standings and podium layouts.
import { categoryLabel, drawLabel, questionById } from './content';
import { classicPackLabel } from './classic';
import { readMs, wordCount, isFinalIndex, isLastIndex, quizModeOf, groupModeOf } from './types';
import type { State } from './types';
import { revealedPodiumEntries } from './standings';
import { labelOf } from '../content/schema';
import { PICKER_ES } from '../content/labels-es';

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
function groupRosterWords(state: State, numbers: number): number {
  return (state.teams ?? []).reduce(
    (total, team) =>
      total +
      wordCount(team.name) +
      numbers +
      team.members.reduce((n, id) => n + wordCount(state.players[id]?.name ?? ''), 0),
    0,
  );
}

/** Budget the largest actual discussion screen, never an invisible whole-room roster. */
export function groupTalkMs(state: State): number {
  const vote = groupModeOf(state) === 'tv-vote';
  const title = vote ? 'Room vote' : 'Teams';
  const identity = Math.max(
    wordCount(title),
    ...(state.teams ?? []).map((team) => wordCount(team.name)),
  );
  const ownRoster = vote
    ? identity
    : Math.max(
        identity,
        ...(state.teams ?? []).map(
          (team) =>
            wordCount(team.name) +
            team.members.reduce((n, id) => n + wordCount(state.players[id]?.name ?? ''), 0),
        ),
      );
  // The TV shows the prompt/options, four marks, a circular clock/label, answer count,
  // discussion cue and ordinal/mode footer. It no longer shows any player names.
  const tv =
    questionWords(state) +
    4 +
    1 +
    wordCount(vote ? 'Room talk' : 'Team talk') +
    wordCount(vote ? '0 of 8 votes' : '0 of 8 answers') +
    wordCount(
      vote
        ? 'Discuss the room answer · then everyone votes'
        : 'Talk with your team · then everyone answers',
    ) +
    wordCount(`Question 1 of 20 ${title}`);
  const phoneCopy =
    wordCount(vote ? 'Discuss the room answer' : 'Talk with your team') +
    1 +
    wordCount(
      vote
        ? 'Discuss now. Each vote helps choose one room answer.'
        : 'Discuss now. Everyone answers when the clock ends.',
    ) +
    wordCount('Answers open after discussion');
  // A staged phone adds the question/options and only its team identity. Beside the
  // TV, a team phone instead reads its own roster; a room-vote phone has no roster.
  const stagedPhone = phoneCopy + questionWords(state) + 4 + identity;
  const besideTvPhone = phoneCopy + ownRoster;
  return readMs(Math.max(tv, stagedPhone, besideTvPhone));
}
function uiWords(en: string, es = en): number {
  return Math.max(wordCount(en), wordCount(es));
}
function labelWords(label: string): number {
  return uiWords(label, PICKER_ES[label] ?? label);
}
function wagerReceiptWords(state: State, answerIndex: number | undefined): number {
  return Math.max(
    0,
    ...Object.keys(state.players).map((id) => {
      const correct = state.picks[id]?.index === answerIndex && answerIndex !== undefined;
      const streak = correct && (state.streaks[id] ?? 0) >= 2 ? ' 🔥20' : '';
      if (correct)
        return uiWords(
          `Correct!${streak} +1300 this round 99999 total`,
          `¡Correcto!${streak} +1300 en esta ronda 99999 en total`,
        );
      // The prior streak lives on the mounted phone, not in the scored state. A wrong/missing
      // answer can therefore show the longer broken-streak receipt even after the server reset.
      const verdict = state.picks[id] ? ['Wrong', 'Incorrecto'] : ['Too slow', 'Muy tarde'];
      return uiWords(
        `${verdict[0]} · Streak of 20 over +0 this round 99999 total`,
        `${verdict[1]} · Se cortó tu racha de 20 +0 en esta ronda 99999 en total`,
      );
    }),
  );
}
export function classicIntroMs(state: State): number {
  const pack = classicPackLabel(state.settings.classicPack ?? 'general');
  return readMs(
    Math.max(
      wordCount(`Kahoot! ${pack} faster is worth more`),
      wordCount('Kahoot! First question coming up'),
      groupModeOf(state)
        ? wordCount(
            `Kahoot! ${pack} faster is worth more ${groupModeOf(state) === 'teams' ? 'Teams' : 'Room vote'}`,
          ) + groupRosterWords(state, 0)
        : 0,
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
  const streaks = Object.values(state.streaks).filter((n) => n >= 2).length;
  const correct = Object.keys(state.players).filter(
    (id) => q && state.picks[id]?.index === q.answerIndex,
  ).length;
  const rowWords = names + players * (players <= 8 ? 3 : 2) + streaks;
  const scores = Object.values(state.scores);
  const top = Math.max(0, ...scores);
  const leaders =
    top > 0 && scores.some((score) => score !== top)
      ? Object.keys(state.players).filter((id) => state.scores[id] === top).length
      : 0;
  const rowLeaders = players <= 12 ? leaders : 0;
  const correctTimes = Object.keys(state.players)
    .filter((id) => q && state.picks[id]?.index === q.answerIndex)
    .map((id) => state.picks[id]!.elapsedMs);
  const fastest = Math.min(...correctTimes);
  const bolts = correctTimes.filter((elapsed) => elapsed === fastest).length;
  // The TV entry hides the generic host strip during reveal: the stage already carries every
  // player's result. The named strip still contributes to questionReadingMs in the input phase.
  const receipt = wagerReceiptWords(state, q?.answerIndex);
  const subcategory = q ? labelWords(labelOf(q.subcategory)) : 0;
  const renderedTopic = q ? labelWords(categoryLabel(q.category)) + subcategory + 3 : 0;
  const languageMark = state.contentLang !== 'es' ? 2 : 0;
  const chart = wordCount('A 16 B 16 C 16 D 16 No answer 16');
  const tvRace =
    4 + renderedTopic + prompt + chart + answer + 2 + rowWords + correct * 2 + bolts + rowLeaders;
  // Beside-TV phones show the complete choices and their own receipt, never a public roster.
  // Before the verdict their longest lock receipt has thirteen words. Shape letters and the
  // correct/wrong tile's glyphs/tags are visible too (five words for an incorrect selection).
  const phoneRace =
    4 + 1 + subcategory + questionWords(state) + languageMark + 4 + 5 + Math.max(receipt, 13);
  // A staged phone's chart has the prompt/correct answer and personal receipt, not all options.
  const stagedRace = 4 + prompt + languageMark + 4 + answer + chart + receipt;
  const longestName = Math.max(0, ...Object.values(state.players).map((p) => wordCount(p.name)));
  const tvNext = Math.max(wordCount("Next on the VIP's phone"), longestName + 3);
  const phoneNext = state.index === state.questionIds.length - 2 ? 4 : 2;
  // The second beat removes the already-read prompt/chart/answer everywhere. TV rows show
  // rank/name/total/delta/streak at every roster size; staged phones show rank/name/total.
  // A beside-TV phone shows only its receipt, topic and Next.
  const boardRowWords = names + players * 3 + streaks;
  const tvBoard = 1 + tvNext + boardRowWords + rowLeaders;
  const phoneBoard = 1 + 4 + 1 + subcategory + receipt + 4 + phoneNext;
  const stagedBoard = 4 + 1 + rosterWords(state, 2) + receipt + phoneNext;
  return {
    // Give the race its full settling beat, then enough time for the largest actual screen.
    // No phone shows the full choices and a public roster together, so their words never sum.
    raceMs: 2_000 + readMs(Math.max(tvRace, phoneRace, stagedRace)),
    standingsMs: readMs(Math.max(tvBoard, phoneBoard, stagedBoard)),
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
  const group = groupModeOf(state);
  const roomAnswer = q ? wordCount(q.choices[state.roomDecision ?? q.answerIndex] ?? '') : 0;
  const groupReceipt =
    group === 'tv-vote'
      ? wordCount(
          'The room got it right Your vote Triangle The room +1300 points 99999 total Room answer Triangle Correct',
        ) +
        wordCount('Correct 100%') +
        roomAnswer
      : group === 'teams'
        ? wordCount(
            'Correct +1300 personal points Team 4 Correct 100% +1300 points 99999 total Team points average players who stayed or answered',
          )
        : 0;
  const chartMs = readMs(chart + own + groupReceipt);
  if (isLastIndex(state, state.index)) return { chartMs, standingsMs: 0 };
  // Question n of m + Scoreboard; each full row is rank/name/score/delta.
  const tvBoard = 4 + 1 + (group ? groupRosterWords(state, 3) : rosterWords(state, 3));
  // Group phone standings show team rows without the TV's member-name lists.
  const phoneRows = group
    ? (state.teams ?? []).reduce((n, team) => n + wordCount(team.name) + 3, 0)
    : rosterWords(state, 2);
  const phoneBoard = 4 + 1 + phoneRows + own + groupReceipt;
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
