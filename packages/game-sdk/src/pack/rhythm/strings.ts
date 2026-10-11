// The rhythm kit's words in other languages, keyed by the English sentence (ADR-044). The kit carries its own table; a
// game's strings.ts holds only its own title, rule and pad labels (scripts/i18n-coverage.test.ts checks both).
import type { Strings } from '../../ui/lang';

export const STRINGS: Strings = {
  es: {
    'Perfect!': '¡Perfecto!',
    Early: 'Pronto',
    Late: 'Tarde',
    Miss: 'Fallo',
    Dry: 'Sin nada',
    Points: 'Puntos',
    'Team score': 'Puntos del equipo',
    '{pts} of {max}': '{pts} de {max}',
    'Everyone together: {rating}': 'Todos juntos: {rating}',
    'Superb!': '¡Magnífico!',
    'Great!': '¡Genial!',
    'Good job': 'Buen trabajo',
    'Keep practicing': 'A seguir practicando',
    'Your cue!': '¡Te toca!',
    'Wait for your cue': 'Espera tu turno',
    'Look at the TV': 'Mira la TV',
    'One moment…': 'Un momento…',
    'Place {rank}': 'Puesto {rank}',
    'You hit the most notes!': '¡Acertaste más notas que nadie!',
    'The beat track': 'La pista del ritmo',
    'Tap on the beat': 'Toca al ritmo',
    '{name}: {pts} points': '{name}: {pts} puntos',
  },
};
