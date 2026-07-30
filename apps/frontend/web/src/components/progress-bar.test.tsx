import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar, PROGRESS_MIN_VISIBLE_PCT, progressFillPercent } from './progress-bar';

describe('progressFillPercent', () => {
  it('returns 0 when nothing is completed', () => {
    expect(progressFillPercent(0, 90)).toBe(0);
  });

  it('floors early progress to a visible minimum', () => {
    expect(progressFillPercent(1, 90)).toBe(PROGRESS_MIN_VISIBLE_PCT);
    expect(progressFillPercent(2, 90)).toBe(PROGRESS_MIN_VISIBLE_PCT);
  });

  it('uses the real percent once it exceeds the minimum', () => {
    expect(progressFillPercent(20, 90)).toBe(22);
  });

  it('caps at 100 when complete', () => {
    expect(progressFillPercent(90, 90)).toBe(100);
  });
});

describe('ProgressBar', () => {
  it('renders rust fill when in progress', () => {
    render(<ProgressBar completed={20} total={90} ariaLabel="progress" />);
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]');
    expect(fill?.className).toContain('bg-accent');
    expect(fill?.className).not.toContain('bg-victory');
  });

  it('swaps to victory gold when completed === total', () => {
    render(<ProgressBar completed={90} total={90} ariaLabel="progress" />);
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]');
    expect(fill?.className).toContain('bg-victory');
  });

  it('shows 0% width when completed is 0', () => {
    render(<ProgressBar completed={0} total={90} ariaLabel="progress" />);
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('keeps a visible fill for 1/90 so the bar does not look empty', () => {
    render(<ProgressBar completed={1} total={90} ariaLabel="progress" showPercent />);
    const bar = screen.getByRole('progressbar');
    const fill = bar.querySelector('[data-fill]') as HTMLElement;
    expect(fill.style.width).toBe(`${PROGRESS_MIN_VISIBLE_PCT}%`);
    // Numeric label still reports the true percent, not the min fill.
    expect(bar).toHaveTextContent('1/90 (1%)');
  });
});
