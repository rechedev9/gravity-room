import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHead, useProgramHead } from './use-head';

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = '';
  document.documentElement.lang = 'es';
});

describe('useHead hreflang ownership', () => {
  it('sets a unique hreflang triple without duplicates', () => {
    renderHook(() =>
      useHead({
        alternates: [
          { hreflang: 'es', href: 'https://gravityroom.app/' },
          { hreflang: 'en', href: 'https://gravityroom.app/en' },
          { hreflang: 'x-default', href: 'https://gravityroom.app/en' },
        ],
      })
    );
    const links = document.head.querySelectorAll('link[rel="alternate"][hreflang]');
    expect(links).toHaveLength(3);
  });

  it('clears leftover hreflang when alternates is undefined', () => {
    const stale = document.createElement('link');
    stale.rel = 'alternate';
    stale.setAttribute('hreflang', 'es');
    stale.href = 'https://gravityroom.app/';
    document.head.appendChild(stale);

    renderHook(() => useHead({ title: 'Solo page' }));
    expect(document.head.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(0);
  });
});

describe('useProgramHead', () => {
  it('aligns html lang and og:locale with the UI language', () => {
    renderHook(() =>
      useProgramHead('gzclp', 'GZCLP', 'themed lore', {
        seoTitle: 'GZCLP Linear Progression | Gravity Room',
        seoDescription: 'Factual SEO description.',
        lang: 'en-US',
      })
    );
    expect(document.documentElement.lang).toBe('en');
    const locale = document.head.querySelector('meta[property="og:locale"]');
    expect(locale?.getAttribute('content')).toBe('en_US');
    expect(document.title).toContain('GZCLP Linear Progression');
    const desc = document.head.querySelector('meta[name="description"]');
    expect(desc?.getAttribute('content')).toBe('Factual SEO description.');
    expect(document.head.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(0);
  });
});
