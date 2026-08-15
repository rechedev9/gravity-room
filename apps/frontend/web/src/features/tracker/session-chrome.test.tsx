import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { SessionChrome, type SessionChromeProps } from './session-chrome';

const DEFINITION = {
  id: 'gzclp',
  name: 'GZCLP',
  configFields: [
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 20, step: 2.5 },
    { key: 'bench', label: 'Press de banca', type: 'weight', min: 20, step: 2.5 },
    { key: 'deadlift', label: 'Peso muerto', type: 'weight', min: 20, step: 2.5 },
    { key: 'ohp', label: 'Press militar', type: 'weight', min: 20, step: 2.5 },
    { key: 'row', label: 'Remo', type: 'weight', min: 20, step: 2.5 },
  ],
} as unknown as ProgramDefinition;

const CONFIG = { squat: 115, bench: 102.5, deadlift: 155, ohp: 47.5, row: 30 };

function renderChrome(overrides: Partial<SessionChromeProps> = {}) {
  const onToggleNav = vi.fn();
  const onEditWeights = vi.fn();
  render(
    <SessionChrome
      definition={DEFINITION}
      config={CONFIG}
      dayIndex={6}
      totalDays={36}
      dayName="A1 Empuje"
      isCurrentDay
      doneSlots={2}
      totalSlots={4}
      completedDays={6}
      navExpanded={false}
      onToggleNav={onToggleNav}
      onEditWeights={onEditWeights}
      isFinishing={false}
      onFinish={vi.fn()}
      onReset={vi.fn()}
      onExportCsv={vi.fn()}
      canUseBackup
      onExportBackup={vi.fn()}
      onImportBackup={vi.fn()}
      {...overrides}
    />
  );
  return { onToggleNav, onEditWeights };
}

describe('SessionChrome', () => {
  afterEach(cleanup);

  it('carries day identity, day progress and the weight summary in one band', () => {
    renderChrome();

    const chrome = screen.getByTestId('session-chrome');
    expect(chrome.textContent).toContain('7');
    expect(chrome.textContent).toContain('/ 36');
    expect(chrome.textContent).toContain('A1 Empuje');
    expect(screen.getByRole('progressbar')).toHaveTextContent('2/4');
    expect(screen.getByTestId('session-chrome-weights').textContent).toContain('115');
  });

  it('never offers undo — that belongs on the card that recorded the result', () => {
    renderChrome();
    // (Confirm-dialog copy may mention "no se puede deshacer" — an affordance is what matters.)
    expect(screen.queryByRole('button', { name: /^deshacer$/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('session-chrome').textContent).not.toMatch(/\d+x/);
  });

  it.each([
    { testId: 'session-chrome-change-day', handler: 'onToggleNav' as const },
    { testId: 'session-chrome-edit-weights', handler: 'onEditWeights' as const },
  ])('$testId calls $handler', ({ testId, handler }) => {
    const handlers = renderChrome();
    fireEvent.click(screen.getByTestId(testId));
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'nothing recorded', doneSlots: 0, totalSlots: 4, expected: '0%' },
    { name: 'partially recorded', doneSlots: 2, totalSlots: 4, expected: '50%' },
    { name: 'fully recorded', doneSlots: 4, totalSlots: 4, expected: '100%' },
  ])('fills the day bar for $name', ({ doneSlots, totalSlots, expected }) => {
    renderChrome({ doneSlots, totalSlots });
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]');
    expect((fill as HTMLElement).style.width).toBe(expected);
  });

  it('only surfaces the finish CTA once every day is recorded', () => {
    renderChrome({ completedDays: 6 });
    expect(screen.queryByRole('button', { name: /finalizar/i })).not.toBeInTheDocument();

    cleanup();
    renderChrome({ completedDays: 36 });
    expect(screen.getByRole('button', { name: /finalizar/i })).toBeInTheDocument();
  });

  it('abbreviates the visible weights summary but keeps the full labels in the title', () => {
    renderChrome();

    const weights = screen.getByTestId('session-chrome-weights');
    // Visible text is abbreviated — the verbose localized labels never render inline.
    expect(weights.textContent).not.toContain('Sentadilla');
    expect(weights.textContent).not.toContain('Press de banca');
    expect(weights.textContent).toContain('115');

    // The full, unabbreviated labels stay reachable via the title for a11y/hover.
    const title = weights.getAttribute('title') ?? '';
    expect(title).toContain('Sentadilla 115');
    expect(title).toContain('Press Banca 102.5');
    // "row" (Remo) sits past the desktop limit of 4 and never renders inline —
    // the title must still be untruncated and carry it.
    expect(weights.textContent).not.toContain('Remo');
    expect(title).toContain('Remo 30');
  });

  it('keeps maintenance actions behind the overflow menu', () => {
    renderChrome();
    expect(screen.getByTestId('session-menu-trigger')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    expect(screen.getByText(/exportar csv/i)).toBeInTheDocument();
  });
});
