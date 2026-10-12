import { normalize } from '@partybox/game-sdk/match';

// Ordinary English spelling variants only: no synonyms, abbreviations or guessed corrections.
const SPELLINGS: readonly (readonly string[])[] = [
  ['donut', 'doughnut'],
  ['airplane', 'aeroplane'],
  ['snowplow', 'snowplough'],
  ['lasagna', 'lasagne'],
];

/** Score only an exact normalized spelling; feedback may compare with any spelling in its group. */
export function answerSpellings(text: string): string[] {
  const compact = normalize(text, 'en').compact;
  const spellings = SPELLINGS.find((group) => group.includes(compact));
  return spellings ? [...spellings] : [compact];
}

export function answerCompact(text: string): string {
  return answerSpellings(text)[0] ?? '';
}
