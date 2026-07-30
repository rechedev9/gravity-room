import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { buildWeightsSummary, WeightsPill } from './weights-pill';

function makeDefinition(
  fieldCount: number
): Pick<ProgramDefinition, 'configFields'> & { id: string } {
  const configFields = Array.from({ length: fieldCount }, (_, i) => ({
    key: `w${i}`,
    label: `Lift ${i + 1}`,
    type: 'weight' as const,
    min: 2.5,
    step: 2.5,
  }));
  return { id: 'test', configFields };
}

describe('buildWeightsSummary', () => {
  it('lists up to four weight fields', () => {
    const def = makeDefinition(3);
    const summary = buildWeightsSummary(
      { w0: 80, w1: 55, w2: 100 },
      def.configFields,
      (n) => `+${n} more`
    );
    expect(summary).toBe('Lift 1 80 · Lift 2 55 · Lift 3 100');
  });

  it('appends a readable overflow label instead of a bare +N', () => {
    const def = makeDefinition(6);
    const summary = buildWeightsSummary(
      { w0: 1, w1: 2, w2: 3, w3: 4, w4: 5, w5: 6 },
      def.configFields,
      (n) => `+${n} more`
    );
    expect(summary).toContain('+2 more');
    expect(summary).not.toMatch(/\+2$/);
  });
});

describe('WeightsPill', () => {
  it('renders i18n title and secondary edit control (not gold/accent border)', () => {
    const onEdit = vi.fn();
    const def = makeDefinition(6) as ProgramDefinition;

    render(
      <WeightsPill
        definition={def}
        config={{ w0: 80, w1: 55, w2: 100, w3: 40, w4: 30, w5: 20 }}
        onEdit={onEdit}
      />
    );

    expect(screen.getByTestId('weights-pill')).toBeInTheDocument();
    // Default test locale is Spanish (test/setup.ts).
    expect(screen.getByText(/pesos iniciales/i)).toBeInTheDocument();
    expect(screen.getByText(/\+2 más/i)).toBeInTheDocument();

    const edit = screen.getByTestId('weights-pill-edit');
    expect(edit.className).toContain('border-rule');
    expect(edit.className).not.toContain('border-accent');
    expect(edit.className).not.toContain('text-accent');

    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
