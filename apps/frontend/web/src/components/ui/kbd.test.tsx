/**
 * Kbd primitive tests — a mono keyboard key chip with a 1px rule border.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kbd } from './kbd';

describe('Kbd', () => {
  it('renders its label inside a <kbd> element', () => {
    render(<Kbd>⌘K</Kbd>);
    const el = screen.getByText('⌘K');
    expect(el.tagName).toBe('KBD');
  });

  it('uses the mono font and a rule border', () => {
    render(<Kbd>Enter</Kbd>);
    const el = screen.getByText('Enter');
    expect(el.className).toContain('font-mono');
    expect(el.className).toContain('border');
  });

  it('merges a custom className', () => {
    render(<Kbd className="ml-2">U</Kbd>);
    expect(screen.getByText('U').className).toContain('ml-2');
  });
});
