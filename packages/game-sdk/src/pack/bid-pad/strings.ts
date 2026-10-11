// BidPad's words in Spanish, keyed by the English sentence (ADR-044). Its own table so it travels
// with the BidPad subpath and never with the entry chunk.
import type { Strings } from '../../ui/lang';

export const BID_PAD_STRINGS: Strings = {
  es: {
    'Choose an amount': 'Elige una cantidad',
    'Bid placed: {coin} {n}': 'Oferta hecha: {coin} {n}',
    'Change bid to {coin} {n}': 'Cambiar oferta a {coin} {n}',
    'Place bid: {coin} {n}': 'Ofertar: {coin} {n}',
    'Lower the bid by {n}': 'Bajar la oferta {n}',
    'Raise the bid by {n}': 'Subir la oferta {n}',
    'Sending…': 'Enviando…',
    '✓ Passed': '✓ Paso',
    'Pass (bid 0)': 'Paso (ofertar 0)',
    'You have {coin} {n}': 'Tienes {coin} {n}',
    'Your bid: {n}': 'Tu oferta: {n}',
    'Add {n}': 'Sumar {n}',
    'All in': 'Todo',
  },
};
