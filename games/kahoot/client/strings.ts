// Lightning Round's words in other languages, keyed by the English sentence (the owner, 2026-09-22: every
// screen translatable to Spanish). Screens read them through `useT(STRINGS)` as `L('…')`; the
// manifest's own sentences (the picker, About, the settings form) live in manifest.es.json (ADR-049).
// `{name}` marks a placeholder. Content (cards, prompts, questions) stays in the deck's language.
// The Spanish lives in two files: the manifest's picker lines (which also name the categories and
// topics the screens show) and the screens' own sentences.
import type { Strings } from '@partybox/game-sdk/ui';
import { SCREENS_ES } from './strings-es';
import { PICKER_ES } from '../content/labels-es';

export const STRINGS: Strings = {
  es: { ...PICKER_ES, ...SCREENS_ES },
};
