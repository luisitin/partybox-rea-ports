// Words the Lightning screens assemble around the server's view — the round, the question's
// category, topic and difficulty, the draw ("Sports · Basketball, Soccer"), points — in the
// device's language. Category and topic names arrive in English as the manifest spells them
// (content/schema.ts `labelOf`), so they translate through the table's picker lines; a name the
// table does not know shows as sent. The question itself and its choices are content: untouched.
import type { Translator } from '@partybox/game-sdk/ui';
import type { QuestionView, RoundView } from '../server/views';

/** "Question 3 of 10", or "Final question". */
export function roundLabel(round: RoundView | null, L: Translator): string {
  if (round === null) return '';
  return round.final
    ? L('Final question')
    : L('Question {number} of {total}', { number: round.number, total: round.total });
}

export function difficultyText(difficulty: string, L: Translator): string {
  switch (difficulty) {
    case 'easy':
      return L('easy');
    case 'medium':
      return L('medium');
    case 'hard':
      return L('hard');
    default:
      return difficulty;
  }
}

/** "Sports · Basketball · hard" — the TV's header line over a question. */
// I-550: a topic alone (the final's, on the wager screens) reads the same way
export function topicLine(
  question: Pick<QuestionView, 'categoryLabel' | 'subcategoryLabel' | 'difficulty'>,
  L: Translator,
): string {
  return [
    L.sent(question.categoryLabel),
    L.sent(question.subcategoryLabel),
    difficultyText(question.difficulty, L),
  ].join(' · ');
}

/**
 * The draw ("Sports · Basketball, Soccer" or "All categories"), name by name. A topic can hold a
 * comma itself ("Birds, Reptiles & Fish"): a pair the table knows as one name stays one name.
 */
export function drawText(label: string, L: Translator): string {
  const [head = '', tail] = label.split(' · ');
  if (tail === undefined) return L.sent(head);
  const parts = tail.split(', ');
  const topics: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const pair = i + 1 < parts.length ? `${parts[i]}, ${parts[i + 1]}` : null;
    const joined = pair === null ? null : L.sent(pair);
    if (pair !== null && joined !== null && joined !== pair) {
      topics.push(joined);
      i += 1;
    } else {
      topics.push(L.sent(parts[i] ?? ''));
    }
  }
  return `${L.sent(head)} · ${topics.join(', ')}`;
}

/** "1 point" / "120 points". */
export function pointsText(n: number, L: Translator): string {
  return n === 1 ? L('1 point') : L('{n} points', { n });
}

/** "waiting for Sam", "waiting for Sam and Priya", "waiting for Sam, Priya and Kenji". */
export function waitingText(names: string[], L: Translator): string {
  if (names.length <= 1) return L('waiting for {name}', { name: names[0] ?? '' });
  return L('waiting for {names} and {last}', {
    names: names.slice(0, -1).join(', '),
    last: names[names.length - 1] ?? '',
  });
}
