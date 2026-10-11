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

  it('renders victory variant with the gold ceremonial background', () => {
    render(<Button variant="victory">UNLOCKED</Button>);
    const btn = screen.getByRole('button', { name: 'UNLOCKED' });
    expect(btn.className).toContain('bg-victory');
    expect(btn.className).not.toContain('shadow-');
  });

  it('renders danger variant with fail color', () => {
    render(<Button variant="danger">BORRAR</Button>);
    const btn = screen.getByRole('button', { name: 'BORRAR' });
    expect(btn.className).toContain('border-fail');
  });

  it('uses the mobile button voice: sentence case Barlow on a 10px radius', () => {
    render(<Button>Press</Button>);
    const btn = screen.getByRole('button', { name: 'Press' });
    expect(btn.className).toContain('type-button');
    expect(btn.className).toContain('rounded-control');
    expect(btn.className).not.toContain('uppercase');
    expect(btn.className).not.toContain('font-mono');
  });

  it('keeps a 44px tap target at every size', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { unmount } = render(<Button size={size}>Go</Button>);
      expect(screen.getByRole('button', { name: 'Go' }).className).toMatch(/min-h-\[(44|48)px\]/);
      unmount();
    }
  });

  it('applies active:translate-y-px for press-down feedback', () => {
    render(<Button>PRESS</Button>);
    const btn = screen.getByRole('button', { name: 'PRESS' });
    expect(btn.className).toContain('active:translate-y-px');
  });
});
