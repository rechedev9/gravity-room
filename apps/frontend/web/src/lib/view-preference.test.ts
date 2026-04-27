import { beforeEach, describe, expect, it } from 'bun:test';

import { getViewPreference, saveViewPreference } from './view-preference';

describe('view-preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getViewPreference', () => {
    it('returns "detailed" when no localStorage value exists', () => {
      const result = getViewPreference();

      expect(result).toBe('detailed');
    });

    it('returns "compact" when stored value is "compact"', () => {
      localStorage.setItem('view-preference', 'compact');

      const result = getViewPreference();

      expect(result).toBe('compact');
    });

    it('returns "detailed" when stored value is "detailed"', () => {
      localStorage.setItem('view-preference', 'detailed');

      const result = getViewPreference();

      expect(result).toBe('detailed');
    });

    it('returns "detailed" for corrupted values', () => {
      localStorage.setItem('view-preference', 'garbage');

      const result = getViewPreference();

      expect(result).toBe('detailed');
    });

    it('returns "detailed" for empty string value', () => {
      localStorage.setItem('view-preference', '');

      const result = getViewPreference();

      expect(result).toBe('detailed');
    });
  });

  describe('saveViewPreference', () => {
    it('persists value to localStorage', () => {
      saveViewPreference('compact');

      expect(localStorage.getItem('view-preference')).toBe('compact');
    });

    it('round-trips correctly with getViewPreference for "compact"', () => {
      saveViewPreference('compact');

      const result = getViewPreference();

      expect(result).toBe('compact');
    });

    it('round-trips correctly with getViewPreference for "detailed"', () => {
      saveViewPreference('detailed');

      const result = getViewPreference();

      expect(result).toBe('detailed');
    });
  });
});
