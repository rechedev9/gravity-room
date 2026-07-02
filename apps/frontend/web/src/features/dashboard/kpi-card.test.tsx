import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from './kpi-card';

describe('KpiCard', () => {
  it('renders label and sub line; numeric value starts count-up from 0', () => {
    render(<KpiCard label="RACHA" value={7} sub="días" />);
    expect(screen.getByText('RACHA')).toBeInTheDocument();
    // count-up starts at 0 in test env (rAF doesn't tick in happy-dom)
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /0/.test(el.textContent ?? ''))
    ).toBeInTheDocument();
    expect(screen.getByText('días')).toBeInTheDocument();
  });

  it('applies flame variant styling when variant=flame', () => {
    const { container } = render(<KpiCard label="RACHA" value={12} variant="flame" />);
    // find the value <p> element by its data class
    const valueEl = container.querySelector('.font-display-data') as HTMLElement;
    expect(valueEl).not.toBeNull();
    expect(valueEl.className).toContain('text-victory');
  });

  it('applies accent top-border (not side-stripe) when accent prop is set', () => {
    const { container } = render(<KpiCard label="X" value={1} accent />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-t-2');
    expect(card.className).toContain('border-t-accent');
    expect(card.className).not.toContain('accent-left-gold');
  });

  it('renders skeleton when loading=true', () => {
    const { container } = render(<KpiCard label="" value="" loading />);
    const skeleton = container.querySelector('[aria-busy="true"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute('aria-label');
  });
});
