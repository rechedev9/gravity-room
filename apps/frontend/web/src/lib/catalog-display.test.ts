import { describe, it, expect, beforeAll } from 'vitest';
import i18n from '@/lib/i18n';
import {
  localizedProgramName,
  localizedProgramDescription,
  localizedCategoryLabel,
  localizedProgramSeoTitle,
  localizedProgramSeoDescription,
  localizedProgramFaq,
} from './catalog-display';

// ---------------------------------------------------------------------------
// catalog-display — i18n fallback resolution (test/setup.ts initializes the
// i18n instance with the real es + en bundles; tests run with locale 'es').
// ---------------------------------------------------------------------------

// Fixed-language t so a stray language change in another test cannot leak in.
const t = i18n.getFixedT('es');

// Synthetic program ids used to exercise malformed faq shapes. Registered only
// for this test file's run (vitest isolates files, so this cannot leak).
beforeAll(() => {
  i18n.addResourceBundle(
    'es',
    'translation',
    {
      catalog: {
        programs: {
          '__test-faq-mixed__': {
            faq: [
              { question: 'valid q', answer: 'valid a' },
              { question: 'missing answer' },
              { answer: 'missing question' },
              { question: 42, answer: 'wrong question type' },
              { question: 'wrong answer type', answer: null },
              'a bare string',
              null,
              7,
              ['nested', 'array'],
            ],
          },
          '__test-faq-string__': { faq: 'not-an-array' },
          '__test-faq-object__': { faq: { question: 'q', answer: 'a' } },
        },
      },
    },
    true,
    true
  );
});

describe('localizedProgramName', () => {
  it('resolves a known program id to its localized name', () => {
    expect(localizedProgramName(t, 'gzclp', 'Fallback')).toBe('GZCLP');
  });

  it('returns the fallback for an unknown program id', () => {
    expect(localizedProgramName(t, 'no-such-program', 'My Custom Program')).toBe(
      'My Custom Program'
    );
  });
});

describe('localizedProgramDescription', () => {
  it('resolves a known program id to its localized description', () => {
    const description = localizedProgramDescription(t, 'gzclp', 'Fallback');

    expect(description).not.toBe('Fallback');
    expect(description).toContain('Kaio-sama');
  });

  it('returns the fallback for an unknown program id', () => {
    expect(localizedProgramDescription(t, 'no-such-program', 'raw description')).toBe(
      'raw description'
    );
  });
});

describe('localizedCategoryLabel', () => {
  it('resolves a known category to its translated label', () => {
    expect(localizedCategoryLabel(t, 'strength')).toBe('Fuerza');
    expect(localizedCategoryLabel(t, 'hypertrophy')).toBe('Hipertrofia');
  });

  it('falls back to the raw key for an unknown category', () => {
    expect(localizedCategoryLabel(t, 'calisthenics')).toBe('calisthenics');
  });
});

describe('localizedProgramSeoTitle', () => {
  it('returns the SEO title when the override exists', () => {
    expect(localizedProgramSeoTitle(t, 'gzclp')).toBe(
      'GZCLP: progresión lineal 4 días | Gravity Room'
    );
  });

  it('returns undefined when no SEO override exists', () => {
    expect(localizedProgramSeoTitle(t, 'no-such-program')).toBeUndefined();
  });
});

describe('localizedProgramSeoDescription', () => {
  it('returns the SEO description when the override exists', () => {
    const description = localizedProgramSeoDescription(t, 'gzclp');

    expect(description).toBeDefined();
    expect(description).toContain('GZCLP');
  });

  it('returns undefined when no SEO override exists', () => {
    expect(localizedProgramSeoDescription(t, 'no-such-program')).toBeUndefined();
  });
});

describe('localizedProgramFaq', () => {
  it('returns the localized FAQ entries for a known program', () => {
    const faq = localizedProgramFaq(t, 'gzclp');

    expect(faq.length).toBeGreaterThan(0);
    for (const entry of faq) {
      expect(typeof entry.question).toBe('string');
      expect(typeof entry.answer).toBe('string');
    }
  });

  it('returns [] for an unknown program id', () => {
    expect(localizedProgramFaq(t, 'no-such-program')).toEqual([]);
  });

  it('drops malformed entries and keeps only valid question/answer pairs', () => {
    expect(localizedProgramFaq(t, '__test-faq-mixed__')).toEqual([
      { question: 'valid q', answer: 'valid a' },
    ]);
  });

  it('returns [] when the faq key resolves to a string', () => {
    expect(localizedProgramFaq(t, '__test-faq-string__')).toEqual([]);
  });

  it('returns [] when the faq key resolves to a non-array object', () => {
    expect(localizedProgramFaq(t, '__test-faq-object__')).toEqual([]);
  });
});
