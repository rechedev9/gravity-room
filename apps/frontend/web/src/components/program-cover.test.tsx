import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { programCoverLayout, programCoverSpec } from '@gzclp/domain/program-cover';
import { ProgramCover } from './program-cover';

describe('ProgramCover', () => {
  afterEach(cleanup);

  it('draws the shared layout: the same canvas, one accent focal shape and the monogram', () => {
    const layout = programCoverLayout(programCoverSpec({ programId: 'gzclp' }), 'cover');
    render(createElement(ProgramCover, { programId: 'gzclp', variant: 'cover' }));
    const svg = screen.getByTestId('program-cover');

    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${layout.width} ${layout.height}`);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('text')?.textContent).toBe('GZ');
    const accentNodes = Array.from(svg.querySelectorAll('rect, circle, line')).filter(
      (node) => node.getAttribute('style')?.includes('var(--color-accent)') === true
    );
    // the focal shape plus the monogram underline
    expect(accentNodes).toHaveLength(2);
  });

  it('renders the same program identically on every render', () => {
    const first = render(createElement(ProgramCover, { programId: 'hexan-ppl' }));
    const html = first.container.innerHTML;
    cleanup();
    const second = render(createElement(ProgramCover, { programId: 'hexan-ppl' }));
    expect(second.container.innerHTML).toBe(html);
  });

  it('uses the compact canvas and a monogram plate for thumbnails', () => {
    render(createElement(ProgramCover, { programId: 'nivel-7', variant: 'thumbnail' }));
    const svg = screen.getByTestId('program-cover');
    expect(svg.getAttribute('viewBox')).toBe('0 0 72 64');
    expect(svg.querySelector('rect[opacity="0.88"]')).not.toBeNull();
  });

  it('falls back to a title-seeded cover for a plan that is not in the catalog', () => {
    render(createElement(ProgramCover, { title: 'Mi rutina de fuerza' }));
    expect(screen.getByTestId('program-cover').querySelector('text')?.textContent).toBe('MRF');
  });
});
