import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { Kicker } from './kicker';

describe('Kicker', () => {
  it('renders the label in the mono caps voice', () => {
    render(<Kicker>NEXT SET</Kicker>);
    const el = screen.getByText('NEXT SET').parentElement;
    expect(el?.className).toContain('font-mono');
    expect(el?.className).toContain('tracking-[0.22em]');
  });

  it('renders an index marker in gold when provided', () => {
    render(<Kicker index="01">FEATURES</Kicker>);
    expect(screen.getByText('01').className).toContain('text-accent-deep');
  });
});
