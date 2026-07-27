import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarTrigger } from './sidebar-trigger';

describe('SidebarTrigger', () => {
  it('meets the minimum touch target and exposes its expanded state', () => {
    render(<SidebarTrigger isOpen={false} onToggle={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Abrir menú' });
    expect(trigger).toHaveClass('w-11', 'h-11');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
