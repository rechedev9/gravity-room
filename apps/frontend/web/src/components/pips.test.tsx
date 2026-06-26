import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Pips } from './pips';

describe('Pips', () => {
  it('exposes progressbar semantics with logged count as value', () => {
    render(<Pips total={5} done={2} fail={1} ariaLabel="sets logged" />);
    const bar = screen.getByRole('progressbar', { name: 'sets logged' });
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('5');
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
  });

  it('renders exactly `total` segments with done/fail/empty fills', () => {
    render(<Pips total={5} done={2} fail={1} ariaLabel="sets" />);
    const bar = screen.getByRole('progressbar', { name: 'sets' });
    const segs = bar.querySelectorAll('span');
    expect(segs.length).toBe(5);
    expect(bar.innerHTML).toContain('bg-accent');
    expect(bar.innerHTML).toContain('bg-fail-ring');
    expect(bar.innerHTML).toContain('bg-surface-2');
  });

  it('clamps over-reported counts to total', () => {
    render(<Pips total={3} done={5} ariaLabel="sets" />);
    const bar = screen.getByRole('progressbar', { name: 'sets' });
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.querySelectorAll('span').length).toBe(3);
  });
});
