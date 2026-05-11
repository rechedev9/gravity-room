import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders default variant with rust accent text', () => {
    render(<Button>ENTRAR</Button>);
    const btn = screen.getByRole('button', { name: 'ENTRAR' });
    expect(btn.className).toContain('text-btn-text');
  });

  it('renders primary variant with rust solid background', () => {
    render(<Button variant="primary">ENTRAR</Button>);
    const btn = screen.getByRole('button', { name: 'ENTRAR' });
    expect(btn.className).toContain('bg-accent');
    expect(btn.className).toContain('text-on-accent');
  });

  it('renders victory variant with gold ceremonial background', () => {
    render(<Button variant="victory">UNLOCKED</Button>);
    const btn = screen.getByRole('button', { name: 'UNLOCKED' });
    expect(btn.className).toContain('bg-victory');
    expect(btn.className).toContain('shadow-[var(--shadow-victory)]');
  });

  it('renders danger variant with fail color', () => {
    render(<Button variant="danger">BORRAR</Button>);
    const btn = screen.getByRole('button', { name: 'BORRAR' });
    expect(btn.className).toContain('border-fail');
  });

  it('applies active:translate-y-px for press-down feedback', () => {
    render(<Button>PRESS</Button>);
    const btn = screen.getByRole('button', { name: 'PRESS' });
    expect(btn.className).toContain('active:translate-y-px');
  });
});
