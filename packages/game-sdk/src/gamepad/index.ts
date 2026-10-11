// T-0602 / ADR-090: the gamepad entry the UI export re-exports (docs/sdk/gamepad.md).
export { BUTTON_INDEX, PAD, PAD_BUTTONS, glyph, padKind } from './core';
export type { PadButton, PadKind } from './core';
export { PadTracker } from './tracker';
export type { PadPress, PadSample } from './tracker';
export { PadProvider, usePad, usePadPress } from './PadProvider';
export type { PadHandler, PadInfo } from './PadProvider';
export { padFocus } from './nav';
export { PadGlyph } from './PadGlyph';
export type { PadGlyphProps } from './PadGlyph';
