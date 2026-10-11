// CardHand's words in other languages, keyed by the English sentence (ADR-044). A pack piece
// carries its own table, so its strings travel with it (scripts/i18n-coverage.test.ts checks it).
import type { Strings } from '../../ui/lang';

export const STRINGS: Strings = {
  es: {
    '{n} cards': '{n} cartas',
    '1 card': '1 carta',
    Sort: 'Ordenar',
    Colour: 'Color',
    Sets: 'Grupos',
    'Sort by number': 'Ordenar por número',
    'Sort by colour': 'Ordenar por color',
    'Put equal numbers together': 'Juntar los números iguales',
    'Sorted by number': 'Ordenadas por número',
    'Sorted by colour': 'Ordenadas por color',
    'Equal numbers together': 'Números iguales juntos',
    'Sorted: {sort}': 'Ordenadas: {sort}',
    '{card}, {i} of {n}': '{card}, {i} de {n}',
    '{card}, {i} of {n}, {note}': '{card}, {i} de {n}, {note}',
    'not playable now': 'no se puede jugar ahora',
    '{card} moved to {i} of {n}': '{card} movida al lugar {i} de {n}',
    '{n} cards moved to {i} of {n2}': '{n} cartas movidas al lugar {i} de {n2}',
    'Tap to pick a card. Drag to rearrange, or onto where it goes. Alt and the arrow keys move a card.':
      'Toca para elegir una carta. Arrastra para reordenar, o hasta donde va. Alt y las flechas mueven una carta.',
    '{target}: put the selected card here': '{target}: pon aquí la carta elegida',
    '{target}: put the {n} selected cards here': '{target}: pon aquí las {n} cartas elegidas',
    '{target}: the selected cards cannot go here':
      '{target}: las cartas elegidas no pueden ir aquí',
  },
};
