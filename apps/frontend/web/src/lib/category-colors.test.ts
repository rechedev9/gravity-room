import { describe, expect, it } from 'vitest';
import { getCategoryColor } from './category-colors';

describe('getCategoryColor', () => {
  it('returns warm iron-family hexes for known categories (not loud web blues/purples)', () => {
    for (const cat of ['strength', 'hypertrophy', 'powerlifting'] as const) {
      const { badge, gradient } = getCategoryColor(cat);
      expect(badge).toMatch(/^#[0-9a-f]{6}$/i);
      // Warm muted tones sit in the 0x50–0xB0 range for RGB channels; reject
      // saturated blues (#4a90d9-style) that used to leak into the brand.
      expect(badge.toLowerCase()).not.toMatch(/^#4a90d9$|^#9b59b6$|^#e05050$/);
      expect(gradient).toMatch(/^rgba\(/);
    }
  });

  it('falls back to gold-family for unknown categories', () => {
    const unknown = getCategoryColor('unknown-category');
    expect(unknown.badge.toLowerCase()).toBe('#e8aa20');
  });
});
