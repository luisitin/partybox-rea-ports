// Quick Poll's words in other languages, keyed by the English sentence: every screen is translatable
// to Spanish (the owner, 2026-09-22). Screens write `L('…')` from `useT(STRINGS)`; the manifest's own
// sentences live in manifest.es.json (ADR-049), and scripts/i18n-coverage.test.ts fails until
// each has its Spanish. `{name}` marks a placeholder.
// Content (the prompts in content/) stays in the deck's language.
import type { Strings } from '@partybox/game-sdk/ui';

export const STRINGS: Strings = {
  es: {
    // phone
    'One word…': 'Una palabra…',
    'Thanks for playing!': '¡Gracias por jugar!',
    'One moment…': 'Un momento…',
    'Look at the TV': 'Mira la TV',
    'You said "{answer}"': 'Dijiste «{answer}»',
    'You did not answer this time.': 'Esta vez no respondiste.',
    // TV
    '{answered} / {total} answered': '{answered} / {total} respondieron',
    "That's the poll!": '¡Y esa fue la encuesta!',
  },
};
