import { describe, it, expect, afterEach } from 'bun:test';
import i18n from 'i18next';
import { formatDaysAgo } from './format-days-ago';

describe('formatDaysAgo', () => {
  afterEach(async () => {
    if (i18n.language !== 'es') await i18n.changeLanguage('es');
  });

  describe('Spanish (default)', () => {
    it('count=0 → hoy', () => {
      const result = formatDaysAgo(i18n.t.bind(i18n), 0);
      expect(result).toBe('hoy');
    });

    it('count=1 → ayer', () => {
      const result = formatDaysAgo(i18n.t.bind(i18n), 1);
      expect(result).toBe('ayer');
    });

    it('count=2 → hace 2 días', () => {
      const result = formatDaysAgo(i18n.t.bind(i18n), 2);
      expect(result).toBe('hace 2 días');
    });

    it('count=21 → hace 21 días', () => {
      const result = formatDaysAgo(i18n.t.bind(i18n), 21);
      expect(result).toBe('hace 21 días');
    });
  });

  describe('English', () => {
    it('count=0 → today', async () => {
      await i18n.changeLanguage('en');
      const result = formatDaysAgo(i18n.t.bind(i18n), 0);
      expect(result).toBe('today');
    });

    it('count=1 → yesterday', async () => {
      await i18n.changeLanguage('en');
      const result = formatDaysAgo(i18n.t.bind(i18n), 1);
      expect(result).toBe('yesterday');
    });

    it('count=2 → 2 days ago', async () => {
      await i18n.changeLanguage('en');
      const result = formatDaysAgo(i18n.t.bind(i18n), 2);
      expect(result).toBe('2 days ago');
    });

    it('count=21 → 21 days ago', async () => {
      await i18n.changeLanguage('en');
      const result = formatDaysAgo(i18n.t.bind(i18n), 21);
      expect(result).toBe('21 days ago');
    });
  });
});
