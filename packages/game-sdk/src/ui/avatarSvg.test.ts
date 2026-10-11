import { AVATAR_IDS } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { avatarFaceSvg } from './avatarSvg';

describe('avatarFaceSvg', () => {
  it('writes a disc in the colour with the face on it', () => {
    const svg = avatarFaceSvg('fox', '#ff5d8f');
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('color="#ff5d8f"');
    expect(svg).toContain('<circle cx="32" cy="32" r="31" fill="currentColor"/>');
    expect(svg).toContain('<ellipse');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('draws every avatar face, with no React-only attribute left in', () => {
    for (const id of AVATAR_IDS) {
      const svg = avatarFaceSvg(id, '#4cc9f0');
      expect(svg, id).not.toMatch(/className|undefined|\[object/);
      expect(svg.length, id).toBeGreaterThan(200);
      // balanced: every opened tag closes or self-closes
      const opens = (svg.match(/<(?!\/)[a-z]+/g) ?? []).length;
      const ends = (svg.match(/<\/[a-z]+>|\/>/g) ?? []).length;
      expect(opens, id).toBe(ends);
    }
  });

  it('turns camelCase attributes and style objects into svg ones', () => {
    const svg = avatarFaceSvg('cat', '#fff');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).toContain('style="transform-origin:32px 31px"');
  });

  it('falls back to the ghost for an unknown face', () => {
    expect(avatarFaceSvg('nope', '#fff')).toBe(avatarFaceSvg('ghost', '#fff'));
  });
});
