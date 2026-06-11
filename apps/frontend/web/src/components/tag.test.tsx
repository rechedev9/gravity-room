import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { Tag } from './tag';

describe('Tag', () => {
  it('renders default tone with muted color', () => {
    render(<Tag>ON TRACK</Tag>);
    expect(screen.getByText('ON TRACK').className).toContain('text-muted');
  });

  it('renders gold tone for the scarce signal', () => {
    render(<Tag tone="gold">ACTIVE</Tag>);
    const el = screen.getByText('ACTIVE');
    expect(el.className).toContain('text-accent');
    expect(el.className).toContain('border-accent-dim');
  });

  it('renders ok and fail tones with state colors', () => {
    const { rerender } = render(<Tag tone="ok">DONE</Tag>);
    expect(screen.getByText('DONE').className).toContain('text-ok');
    rerender(<Tag tone="fail">MISS</Tag>);
    expect(screen.getByText('MISS').className).toContain('text-fail');
  });
});
