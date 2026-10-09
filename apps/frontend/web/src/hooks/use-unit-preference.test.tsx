import { afterEach, describe, expect, it } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { useUnitPreference } from './use-unit-preference';

afterEach(() => {
  localStorage.clear();
});

function Reading(): React.ReactNode {
  const { format } = useUnitPreference();
  return <p data-testid="reading">{format(100)}</p>;
}

describe('useUnitPreference', () => {
  it('switches every mounted consumer at once, not just the one that toggled', () => {
    render(<Reading />);
    const { result } = renderHook(() => useUnitPreference());
    expect(screen.getByTestId('reading').textContent).toBe('100 kg');

    act(() => result.current.toggleUnit());

    expect(screen.getByTestId('reading').textContent).toBe('220.5 lbs');
    expect(result.current.unit).toBe('lbs');
  });

  it('starts from the stored unit after a reload', () => {
    localStorage.setItem('gravity-room:unit-preference', 'lbs');
    const { result } = renderHook(() => useUnitPreference());
    expect(result.current.unit).toBe('lbs');
    expect(result.current.fromDisplay(135)).toBe(61.24);
  });
});
