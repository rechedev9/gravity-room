/**
 * Panel primitive tests — header title, optional mono-uppercase meta, actions
 * slot, body content, and the aria-labelledby region wiring.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Panel } from './panel';

describe('Panel', () => {
  it('exposes a region labelled by its title', () => {
    render(<Panel title="Sesión de hoy">body</Panel>);
    const region = screen.getByRole('region', { name: 'Sesión de hoy' });
    expect(region).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('renders the title as a heading in Barlow 600', () => {
    render(<Panel title="Programa">body</Panel>);
    const heading = screen.getByRole('heading', { name: 'Programa' });
    expect(heading.className).toContain('type-title');
  });

  it('renders an optional mono uppercase meta', () => {
    render(
      <Panel title="Cargas T1" meta="DÍA 8">
        body
      </Panel>
    );
    const meta = screen.getByText('DÍA 8');
    expect(meta.className).toContain('font-mono');
    expect(meta.className).toContain('uppercase');
  });

  it('renders the actions slot', () => {
    render(
      <Panel title="Hoy" actions={<button type="button">Más</button>}>
        body
      </Panel>
    );
    expect(screen.getByRole('button', { name: 'Más' })).toBeTruthy();
  });

  it('merges a custom className onto the card surface', () => {
    render(
      <Panel title="Hoy" className="col-span-8">
        body
      </Panel>
    );
    const region = screen.getByRole('region', { name: 'Hoy' });
    expect(region.className).toContain('col-span-8');
    expect(region.className).toContain('bg-card');
  });
});
