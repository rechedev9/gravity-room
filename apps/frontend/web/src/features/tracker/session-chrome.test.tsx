import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  const handlers = {
    onToggleNav: vi.fn(),
    onEditWeights: vi.fn(),
    onUndo: vi.fn(),
    onSelectDay: vi.fn(),
    onPrevDay: vi.fn(),
    onNextDay: vi.fn(),
    onGoToCurrent: vi.fn(),
    onSwitchProgram: vi.fn(),
  };
  render(
    <SessionChrome
      definition={DEFINITION}
      config={CONFIG}
      dayIndex={6}
      totalDays={36}
      dayName="A1 Empuje"
      isCurrentDay
      currentDayIndex={6}
      workoutsPerWeek={4}
      completedDayIndices={new Set([0, 1, 2, 3, 4, 5])}
      doneSlots={2}
      totalSlots={4}
      completedDays={6}
      navExpanded={false}
      canUndo
      isFinishing={false}
      onFinish={vi.fn()}
      onReset={vi.fn()}
      onExportCsv={vi.fn()}
      canUseBackup
      onExportBackup={vi.fn()}
      onImportBackup={vi.fn()}
      {...handlers}
      {...overrides}
    />
  );
  return handlers;
}

describe('SessionChrome', () => {
  afterEach(cleanup);

  it('names the program and opens the plans list from the switcher', () => {
    const { onSwitchProgram } = renderChrome();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('GZCLP');
    fireEvent.click(screen.getByTestId('session-chrome-switch-program'));
    expect(onSwitchProgram).toHaveBeenCalledOnce();
  });

  it('shows the week and the workout number, without repeating a cycle day name', () => {
    renderChrome({ dayIndex: 0, dayName: 'Día 1', completedDayIndices: new Set() });

    const chrome = screen.getByTestId('session-chrome');
    expect(chrome).toHaveTextContent('SEMANA 1');
    expect(chrome).toHaveTextContent('DÍA 1');
    expect(chrome).toHaveTextContent('/ 36');
    // "Día 1" appears once, as the day selector button, never as a second name.
    expect(within(chrome).getAllByText('Día 1')).toHaveLength(1);
  });

  it('keeps a descriptive day name and the weight summary next to the position', () => {
    renderChrome();

    const chrome = screen.getByTestId('session-chrome');
    expect(chrome).toHaveTextContent('SEMANA 2');
    expect(chrome).toHaveTextContent('DÍA 7');
    expect(chrome.textContent).toContain('A1 Empuje');
    expect(screen.getByTestId('session-chrome-weights').textContent).toContain('115');
  });

  it('lists one chip per week and jumps to the first workout of the chosen week', () => {
    const { onSelectDay } = renderChrome();

    const weeks = screen.getByRole('group', { name: 'Semanas del programa' });
    expect(within(weeks).getAllByRole('button')).toHaveLength(9);
    expect(within(weeks).getByRole('button', { name: 'Semana 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.click(within(weeks).getByRole('button', { name: 'Semana 5' }));
    expect(onSelectDay).toHaveBeenCalledWith(16);
  });

  it('offers the days of the selected week, marking the selected and the completed ones', () => {
    const { onSelectDay } = renderChrome({ dayIndex: 5, completedDayIndices: new Set([4]) });

    const days = screen.getByRole('group', { name: 'Días de la semana' });
    const buttons = within(days).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Día 5, completado',
      'Día 6',
      'Día 7',
      'Día 8',
    ]);
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
    expect(buttons[0]).not.toHaveAttribute('aria-current');

    fireEvent.click(buttons[3]);
    expect(onSelectDay).toHaveBeenCalledWith(7);
  });

  it('shortens the last week when the program does not fill it', () => {
    renderChrome({ dayIndex: 9, totalDays: 10 });

    const days = screen.getByRole('group', { name: 'Días de la semana' });
    expect(within(days).getAllByRole('button')).toHaveLength(2);
  });

  it('steps a day at a time and stops at both ends of the program', () => {
    const { onPrevDay, onNextDay } = renderChrome();
    fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente día' }));
    expect(onPrevDay).toHaveBeenCalledOnce();
    expect(onNextDay).toHaveBeenCalledOnce();

    cleanup();
    renderChrome({ dayIndex: 0 });
    expect(screen.getByRole('button', { name: 'Día anterior' })).toBeDisabled();

    cleanup();
    renderChrome({ dayIndex: 35 });
    expect(screen.getByRole('button', { name: 'Siguiente día' })).toBeDisabled();
  });

  it('offers undo only while there is a result to undo', () => {
    const { onUndo } = renderChrome({ canUndo: true });
    fireEvent.click(screen.getByTestId('session-chrome-undo'));
    expect(onUndo).toHaveBeenCalledOnce();

    cleanup();
    renderChrome({ canUndo: false });
    expect(screen.getByTestId('session-chrome-undo')).toBeDisabled();
  });

  it('offers a way back to the current day only when another day is selected', () => {
    renderChrome();
    expect(screen.queryByTestId('session-chrome-go-current')).not.toBeInTheDocument();

    cleanup();
    const { onGoToCurrent } = renderChrome({ dayIndex: 2, isCurrentDay: false });
    fireEvent.click(screen.getByTestId('session-chrome-go-current'));
    expect(onGoToCurrent).toHaveBeenCalledOnce();
  });

  it.each([
    { testId: 'session-chrome-change-day', handler: 'onToggleNav' as const },
    { testId: 'session-chrome-edit-weights', handler: 'onEditWeights' as const },
  ])('$testId calls $handler', ({ testId, handler }) => {
    const handlers = renderChrome();
    fireEvent.click(screen.getByTestId(testId));
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it('renames the calendar toggle once the day picker is open', () => {
    renderChrome({ navExpanded: true });
    expect(screen.getByTestId('session-chrome-change-day')).toHaveAccessibleName('Cerrar');
  });

  it.each([
    { name: 'nothing recorded', doneSlots: 0, totalSlots: 4, expected: '0%' },
    { name: 'partially recorded', doneSlots: 2, totalSlots: 4, expected: '50%' },
    { name: 'fully recorded', doneSlots: 4, totalSlots: 4, expected: '100%' },
  ])('fills the day line for $name', ({ doneSlots, totalSlots, expected }) => {
    renderChrome({ doneSlots, totalSlots });
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveTextContent(`${doneSlots} de ${totalSlots} ejercicios`);
    const fill = bar.querySelector('[data-fill]');
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
    // Visible text is abbreviated: the verbose localized labels never render inline.
    expect(weights.textContent).not.toContain('Sentadilla');
    expect(weights.textContent).not.toContain('Press de banca');
    expect(weights.textContent).toContain('115');

    // The full, unabbreviated labels stay reachable via the title for a11y/hover.
    const title = weights.getAttribute('title') ?? '';
    expect(title).toContain('Sentadilla 115');
    expect(title).toContain('Press Banca 102.5');
    // "row" (Remo) sits past the desktop limit of 4 and never renders inline,
    // so the title must still be untruncated and carry it.
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
