// Audit #5: "Ana", "Ana and Ben", "Ana, Ben and Cleo" — a list of names in the screen's language
// (`joinNames` on the pure entry is the English one the server writes; this one translates)
// (one SDK string: "{list} and {last}" → "{list} y {last}"). `&` keeps the ampersand a game shows
// in English (Tune In's finale); Spanish reads "y" either way.
import { STRINGS } from '../controller/strings';
import { translate } from './lang';
import type { Lang } from './lang';

export function joinNamesIn(
  lang: Lang,
  names: readonly string[],
  glue: 'and' | '&' = 'and',
): string {
  if (names.length <= 1) return names[0] ?? '';
  const vars = { list: names.slice(0, -1).join(', '), last: names.at(-1) ?? '' };
  return translate(STRINGS, lang, glue === '&' ? '{list} & {last}' : '{list} and {last}', vars);
}
