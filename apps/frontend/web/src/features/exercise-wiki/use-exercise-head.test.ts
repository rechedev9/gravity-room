import { describe, expect, it } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useExerciseHead } from './use-exercise-head';
import { placeholderArticle } from './content/_placeholder';

describe('useExerciseHead', () => {
  it('sets the localized title and canonical', () => {
    renderHook(() => useExerciseHead(placeholderArticle, 'es'));
    expect(document.title).toContain('Sentadilla');
    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://gravityroom.app/ejercicios/sentadilla');
  });
  it('injects es + en + x-default hreflang alternates', () => {
    renderHook(() => useExerciseHead(placeholderArticle, 'en'));
    const langs = Array.from(document.head.querySelectorAll('link[rel="alternate"][hreflang]')).map(
      (l) => l.getAttribute('hreflang')
    );
    expect(langs).toContain('es');
    expect(langs).toContain('en');
    expect(langs).toContain('x-default');
  });
});
