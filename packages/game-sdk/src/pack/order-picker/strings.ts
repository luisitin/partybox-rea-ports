// OrderPicker's words in other languages, keyed by the English sentence (ADR-044). A pack piece
// carries its own table, so its strings travel with it (scripts/i18n-coverage.test.ts checks it).
import type { Strings } from '../../ui/lang';

export const STRINGS: Strings = {
  es: {
    Reset: 'Borrar',
    '{label}: number {n}. Tap to take it out.': '{label}: número {n}. Toca para quitarlo.',
    '{label}: not placed. Tap to make it number {n}.':
      '{label}: sin número. Toca para darle el número {n}.',
    '{label}: number {n}, picked up. Tap another to swap.':
      '{label}: número {n}, levantado. Toca otro para intercambiar.',
    '{label}: number {n}. Tap to move it.': '{label}: número {n}. Toca para moverlo.',
  },
};
