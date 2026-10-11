// SecretCard (T-0391): tap is the default, a tap-revealed card hides itself, and the back's words after a look.
import { describe, expect, it } from 'vitest';
import { autoHideMs, backText, controlLabel, getSecretCardMode } from './SecretCard';

describe('SecretCard', () => {
  it('defaults to tap with no stored preference', () => {
    expect(getSecretCardMode()).toBe('tap');
  });
  it('hides itself after 3 s on the strip and 5 s on the full card', () => {
    expect(autoHideMs('mini')).toBe(3000);
    expect(autoHideMs('full')).toBe(5000);
  });
  it('says "Show again" after the first look in tap mode only, in the visible line and the name', () => {
    expect(backText('tap', false, 'Tap to see', 'Show again')).toBe('Tap to see');
    expect(backText('tap', true, 'Tap to see', 'Show again')).toBe('Show again');
    expect(backText('tap', true, 'Tap to see')).toBe('Tap to see');
    expect(backText('hold', true, 'Hold to see', 'Show again')).toBe('Hold to see');
    expect(controlLabel('Your word', 'tap', true, 'Show again')).toBe('Your word: Show again');
    expect(controlLabel('Your word', 'tap', false, 'Show again')).toBe('Your word');
    expect(controlLabel('Your word', 'hold', true, 'Show again')).toBe('Your word');
  });
});
