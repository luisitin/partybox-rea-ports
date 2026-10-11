// The SDK's phone components in other languages, keyed by the English sentence (the owner, 2026-09-22: every
// screen translatable to Spanish). Read through `useT(STRINGS)` as `L('…')`; `{name}` marks a
// placeholder. The shared ui/ primitives (Avatar, PlayerChip) read this table too.
import type { Strings } from '../ui/lang';

export const STRINGS: Strings = {
  es: {
    // VipNext, once tapped
    'Moving on…': 'Avanzando…',
    // joinNamesIn: "Ana, Ben and Cleo"
    '{list} and {last}': '{list} y {last}',
    '{list} & {last}': '{list} y {last}',
    // Screen
    'scroll down': 'ver más abajo',
    'more below': 'hay más abajo', // I-788 A: the footer's cue row
    // TextAnswer
    Submit: 'Enviar',
    Submitted: 'Enviado',
    'Sending…': 'Enviando…',
    'Not sent — tap to send again': 'No se envió: toca para reenviar',
    'Type your answer first': 'Escribe tu respuesta primero',
    'You said': 'Dijiste',
    'Your answer is in': 'Ya enviaste tu respuesta',
    'your answer': 'tu respuesta',
    "Time's up — your answer wasn't sent.": 'Se acabó el tiempo: tu respuesta no se envió.',
    // phoneOnly (the lines after a pick, with and without a TV in the room)
    '✓ Locked in': '✓ Confirmado',
    '✓ Locked in — look at the TV': '✓ Confirmado: mira la TV',
    '✓ Vote in': '✓ Voto enviado',
    '✓ Vote in — look at the TV': '✓ Voto enviado: mira la TV',
    'Waiting for the others…': 'Esperando a los demás…',
    'Waiting for the others — look at the TV': 'Esperando a los demás: mira la TV',
    "✗ Didn't go through — tap again": '✗ No se envió: toca otra vez',
    "✗ Didn't reach the TV — tap again": '✗ No llegó a la TV: toca otra vez',
    // ChoiceGrid, VoteList
    choices: 'opciones',
    '✓ Locking in…': '✓ Confirmando…',
    correct: 'correcta',
    incorrect: 'incorrecta',
    // I-790 C: the reveal's tile tags
    'the answer': 'la respuesta', // ("you" is in the table below)
    vote: 'votación',
    yours: 'tuya',
    // Avatar (ui/Avatar.tsx) and the faces' names (avatarNames.ts)
    'photo avatar': 'avatar con foto',
    'avatar {name}': 'avatar de {name}',
    fox: 'zorro',
    owl: 'búho',
    frog: 'rana',
    cat: 'gato',
    panda: 'oso panda',
    koala: 'coala',
    penguin: 'pingüino',
    octopus: 'pulpo',
    lion: 'león',
    bee: 'abeja',
    whale: 'ballena',
    sloth: 'perezoso',
    robot: 'robot',
    ghost: 'fantasma',
    dino: 'dinosaurio',
    unicorn: 'unicornio',
    pumpkin: 'calabaza',
    snowflake: 'copo de nieve',
    heart: 'corazón',
    // PlayerChip (ui/PlayerChip.tsx)
    '(you)': '(tú)',
    '(bot)': '(bot)',
    // (the state words follow the name — "Sam, ya envió" — so they stay gender-neutral)
    submitted: 'ya envió',
    waiting: 'esperando',
    spectator: 'mirando',
    reconnecting: 'reconectando',
    leading: 'va ganando',
    '1st': '1.º',
    '{seconds} seconds before they drop out': '{seconds} segundos antes de que salga de la sala',
    you: 'tú',
    bot: 'bot',
    remove: 'quitar',
  },
};
