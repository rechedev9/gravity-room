/**
 * useLocaleWeight hook tests — combines the stored unit preference with the
 * active i18n language to produce locale-aware number/weight formatters.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const i18nState = { language: 'es' };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: i18nState }),
}));

import { useLocaleWeight } from './use-locale-weight';

afterEach(() => {
  localStorage.clear();
  i18nState.language = 'es';
});

describe('useLocaleWeight', () => {
  it('formats kg in Spanish with the stored kg unit', () => {
    const { result } = renderHook(() => useLocaleWeight());
    expect(result.current.unit).toBe('kg');
    expect(result.current.formatWeight(22.5)).toBe('22,5 kg');
    expect(result.current.formatNumber(10240)).toBe('10.240');
  });

  it('formats with the English separator when the language is en', () => {
    i18nState.language = 'en';
    const { result } = renderHook(() => useLocaleWeight());
    expect(result.current.formatWeight(22.5)).toBe('22.5 kg');
    expect(result.current.formatNumber(10240)).toBe('10,240');
  });

  it('converts to lbs when the stored unit is lbs', () => {
    localStorage.setItem('gravity-room:unit-preference', 'lbs');
    const { result } = renderHook(() => useLocaleWeight());
    expect(result.current.unit).toBe('lbs');
    expect(result.current.formatWeight(22.5)).toBe('49,6 lbs');
  });
});
