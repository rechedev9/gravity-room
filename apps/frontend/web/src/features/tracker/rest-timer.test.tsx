import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RestTimer } from './rest-timer';

describe('RestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders remaining time and a skip control', () => {
    render(<RestTimer seconds={90} onSkip={vi.fn()} />);

    // Visible countdown is decorative (aria-hidden); status name is stable.
    expect(screen.getByTestId('rest-timer')).toHaveTextContent('1:30');
    expect(screen.getByRole('button', { name: /saltar|skip/i })).toBeInTheDocument();
  });

  it('counts down and calls onComplete when the timer reaches zero', () => {
    const onComplete = vi.fn();
    render(<RestTimer seconds={3} onSkip={vi.fn()} onComplete={onComplete} />);

    // Each tick schedules the next timeout via an effect on `remaining`, so
    // advance one second at a time rather than a single bulk jump.
    for (let i = 0; i < 3; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('rest-timer')).toHaveTextContent('0:00');
  });

  it('calls onSkip when the user dismisses the timer early', () => {
    const onSkip = vi.fn();
    render(<RestTimer seconds={60} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole('button', { name: /saltar|skip/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('focuses the skip control on mount for one-handed gym use', () => {
    render(<RestTimer seconds={60} onSkip={vi.fn()} />);
    expect(screen.getByTestId('rest-timer-skip')).toHaveFocus();
  });
});
