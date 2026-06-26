import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './progress-bar';

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
});
