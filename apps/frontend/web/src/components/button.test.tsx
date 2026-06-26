import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders default variant as the line treatment (off-white text)', () => {
    render(<Button>ENTRAR</Button>);
    const btn = screen.getByRole('button', { name: 'ENTRAR' });
    expect(btn.className).toContain('text-main');
    expect(btn.className).toContain('border-rule-light');
  });

  it('renders primary variant with gold solid background', () => {
    render(<Button variant="primary">ENTRAR</Button>);
    const btn = screen.getByRole('button', { name: 'ENTRAR' });
    expect(btn.className).toContain('bg-accent');
    expect(btn.className).toContain('text-on-accent');
  });

  it('renders victory variant with gold ceremonial background and pressed-steel inset', () => {
    render(<Button variant="victory">UNLOCKED</Button>);
    const btn = screen.getByRole('button', { name: 'UNLOCKED' });
    expect(btn.className).toContain('bg-victory');
    expect(btn.className).toContain('shadow-[var(--shadow-pressed-steel)]');
  });

  it('renders danger variant with fail color', () => {
    render(<Button variant="danger">BORRAR</Button>);
    const btn = screen.getByRole('button', { name: 'BORRAR' });
    expect(btn.className).toContain('border-fail');
  });

  it('uses the mono voice with industrial tracking', () => {
    render(<Button>PRESS</Button>);
    const btn = screen.getByRole('button', { name: 'PRESS' });
    expect(btn.className).toContain('font-mono');
    expect(btn.className).toContain('tracking-[0.14em]');
  });

  it('applies active:translate-y-px for press-down feedback', () => {
    render(<Button>PRESS</Button>);
    const btn = screen.getByRole('button', { name: 'PRESS' });
    expect(btn.className).toContain('active:translate-y-px');
  });
});
