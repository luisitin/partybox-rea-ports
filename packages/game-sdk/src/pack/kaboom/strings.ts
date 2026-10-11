// The kaboom kit's words in other languages, keyed by the English sentence (ADR-044). The kit carries its own table; a
// game's strings.ts holds only its own title, rule and button labels (scripts/i18n-coverage.test.ts checks both).
import type { Strings } from '../../ui/lang';

export const STRINGS: Strings = {
  es: {
    Points: 'Puntos',
    'Team score': 'Puntos del equipo',
    'Team rating: {grade}': 'Nota del equipo: {grade}',
    'Rating {grade}': 'Nota {grade}',
    '{team} of {max}': '{team} de {max}',
    'You: {pts}': 'Tú: {pts}',
    'Team: {team}': 'Equipo: {team}',
    'Team:': 'Equipo:',
    'Look at the TV': 'Mira la TV',
    'Place {rank}': 'Puesto {rank}',
    'You scored the most!': '¡Hiciste más puntos que nadie!',
    'The team bar': 'La barra del equipo',
    '{name}: {pts} points': '{name}: {pts} puntos',
    'Next rating at {n}': 'Siguiente nota con {n}',
    'Top rating!': '¡Nota máxima!',
  },
};
