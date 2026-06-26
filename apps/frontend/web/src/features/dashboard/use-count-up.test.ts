import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCountUp } from './use-count-up';

describe('useCountUp', () => {
  it('returns target value immediately when duration is 0', () => {
    const { result } = renderHook(() => useCountUp(42, { duration: 0 }));
    expect(result.current).toBe(42);
  });

  it('returns the target string passthrough when value is non-numeric', () => {
    const { result } = renderHook(() => useCountUp('—'));
    expect(result.current).toBe('—');
  });
});
