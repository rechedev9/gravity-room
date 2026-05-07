import { describe, it, expect, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { StageTag } from './stage-tag';

// Mock react-i18next so tests are independent of i18n initialization order.
// Provides the minimal translations needed by StageTag.
const TRANSLATIONS: Record<string, string> = {
  'tracker.stage_tag.title_template': 'Etapa {{n}}: {{label}}',
  'tracker.stage_tag.labels.normal': 'Normal',
  'tracker.stage_tag.labels.caution': 'Precaución',
  'tracker.stage_tag.labels.reset_next_fail': 'Reinicio próximo fallo',
};

mock.module('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const template = TRANSLATIONS[key] ?? key;
      if (!opts) return template;
      return Object.entries(opts).reduce(
        (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
        template
      );
    },
  }),
}));

// ---------------------------------------------------------------------------
// StageTag — render contract tests
// ---------------------------------------------------------------------------
describe('StageTag', () => {
  it('should display S1 for stage 0', () => {
    render(<StageTag stage={0} />);

    expect(screen.getByText('S1')).toBeInTheDocument();
  });

  it('should display S2 for stage 1', () => {
    render(<StageTag stage={1} />);

    expect(screen.getByText('S2')).toBeInTheDocument();
  });

  it('should display S3 for stage 2', () => {
    render(<StageTag stage={2} />);

    expect(screen.getByText('S3')).toBeInTheDocument();
  });

  it('should include stage label in title attribute', () => {
    render(<StageTag stage={0} />);

    const tag = screen.getByText('S1');
    expect(tag.getAttribute('title')).toBe('Etapa 1: Normal');
  });

  it('should show "Precaución" label for stage 1', () => {
    render(<StageTag stage={1} />);

    const tag = screen.getByText('S2');
    expect(tag.getAttribute('title')).toBe('Etapa 2: Precaución');
  });

  it('should show "Reinicio próximo fallo" label for stage 2', () => {
    render(<StageTag stage={2} />);

    const tag = screen.getByText('S3');
    expect(tag.getAttribute('title')).toBe('Etapa 3: Reinicio próximo fallo');
  });

  it('should clamp stages above 2 to stage 2', () => {
    render(<StageTag stage={5} />);

    // Displays S6 (stage + 1) but uses styles/label for stage 2
    const tag = screen.getByText('S6');
    expect(tag.getAttribute('title')).toBe('Etapa 6: Reinicio próximo fallo');
  });

  it('should NOT have text-white class on S1 badge (WCAG contrast fix)', () => {
    render(<StageTag stage={0} />);

    const tag = screen.getByText('S1');

    expect(tag.className).not.toContain('text-white');
  });

  it('should have dark text class on S1 badge for WCAG AA compliance', () => {
    render(<StageTag stage={0} />);

    const tag = screen.getByText('S1');

    expect(tag.className).toContain('text-header');
  });
});
