/**
 * TierBadge primitive tests — a small boxed T1/T2/T3 badge; T1 is the accent
 * color, T2/T3 are muted.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TierBadge } from './tier-badge';

describe('TierBadge', () => {
  it('renders the tier label', () => {
    render(<TierBadge tier="T1" />);
    expect(screen.getByText('T1')).toBeTruthy();
  });

  it('uses the accent color for T1', () => {
    render(<TierBadge tier="T1" />);
    expect(screen.getByText('T1').className).toContain('text-accent');
  });

  it('uses the muted color for T2 and T3', () => {
    render(<TierBadge tier="T2" />);
    expect(screen.getByText('T2').className).toContain('text-muted');
    expect(screen.getByText('T2').className).not.toContain('text-accent');

    render(<TierBadge tier="T3" />);
    expect(screen.getByText('T3').className).toContain('text-muted');
  });

  it('merges a custom className', () => {
    render(<TierBadge tier="T1" className="ml-1" />);
    expect(screen.getByText('T1').className).toContain('ml-1');
  });
});
