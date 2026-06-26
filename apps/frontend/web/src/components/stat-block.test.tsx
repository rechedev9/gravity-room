import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatBlock } from './stat-block';

describe('StatBlock', () => {
  it('renders label, value and optional sub', () => {
    render(<StatBlock label="WEEKLY VOLUME" value="12,450" sub="kg" />);
    expect(screen.getByText('WEEKLY VOLUME')).toBeTruthy();
    expect(screen.getByText('12,450')).toBeTruthy();
    expect(screen.getByText('kg')).toBeTruthy();
  });

  it('renders the value off-white by default', () => {
    render(<StatBlock label="SESSIONS" value="42" />);
    expect(screen.getByText('42').className).toContain('text-main');
  });

  it('renders the value in gold when flagged as the hero signal', () => {
    render(<StatBlock label="EST 1RM" value="140" gold />);
    expect(screen.getByText('140').className).toContain('text-accent');
  });
});
