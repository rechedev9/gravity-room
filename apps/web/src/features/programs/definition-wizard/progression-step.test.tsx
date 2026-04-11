/**
 * ProgressionStep component tests (REQ-PREV-INT-001, REQ-PREV-INT-002, REQ-PREV-INT-004, REQ-RULE-007).
 * Verifies preview button, preview table, validation, and slot editing.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericWorkoutRow, GenericSlotRow } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Mock previewDefinition API function BEFORE importing the component
// ---------------------------------------------------------------------------

const MOCK_PREVIEW_ROWS: readonly GenericWorkoutRow[] = Array.from({ length: 3 }, (_, i) => ({
  index: i,
  dayName: `Day ${(i % 2) + 1}`,
  slots: [
    {
      slotId: 'd1-t1',
      exerciseId: 'squat',
      exerciseName: 'Sentadilla',
      tier: 't1',
      weight: 60,
      stage: 0,
      sets: 5,
      reps: 3,
      repsMax: undefined,
      isAmrap: false,
      stagesCount: 1,
      result: undefined,
      amrapReps: undefined,
      rpe: undefined,
      isChanged: false,
      isDeload: false,
      role: undefined,
      notes: undefined,
      prescriptions: undefined,
      isGpp: undefined,
      complexReps: undefined,
      propagatesTo: undefined,
      isTestSlot: undefined,
      isBodyweight: undefined,
      setLogs: undefined,
    } satisfies GenericSlotRow,
  ],
  isChanged: false,
  completedAt: undefined,
}));

const mockPreviewDefinition = mock(() => Promise.resolve(MOCK_PREVIEW_ROWS));

mock.module('@/lib/api-functions', () => ({
  previewDefinition: mockPreviewDefinition,
}));

// Must import AFTER mock.module
const { ProgressionStep } = await import('./progression-step');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_DEFINITION: ProgramDefinition = {
  id: 'test-program',
  name: 'Test Program',
  description: 'A test program',
  author: 'Test',
  version: 1,
  category: 'strength',
  source: 'custom',
  cycleLength: 2,
  totalWorkouts: 10,
  workoutsPerWeek: 3,
  exercises: {
    squat: { name: 'Sentadilla' },
  },
  configFields: [{ key: 'squat', label: 'Sentadilla', type: 'weight' as const, min: 0, step: 2.5 }],
  weightIncrements: { squat: 5 },
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'd1-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day 2',
      slots: [
        {
          id: 'd2-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
  ],
};

const baseProps = {
  definition: VALID_DEFINITION,
  onUpdate: mock(),
  onNext: mock(),
  onBack: mock(),
  onSaveAndStart: mock(),
  onSaveDraft: mock(),
  isSaving: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProgressionStep', () => {
  beforeEach(() => {
    mockPreviewDefinition.mockClear();
    mockPreviewDefinition.mockImplementation(() => Promise.resolve(MOCK_PREVIEW_ROWS));
    (baseProps.onUpdate as ReturnType<typeof mock>).mockClear();
    (baseProps.onBack as ReturnType<typeof mock>).mockClear();
    (baseProps.onSaveAndStart as ReturnType<typeof mock>).mockClear();
    (baseProps.onSaveDraft as ReturnType<typeof mock>).mockClear();
  });

  it('calls previewDefinition when "Vista previa" button is clicked', async () => {
    render(<ProgressionStep {...baseProps} />);

    const previewButton = screen.getByText('programs.wizard.progression.actions.preview');
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(mockPreviewDefinition).toHaveBeenCalledTimes(1);
    });
  });

  it('disables preview button while request is in-flight', async () => {
    // Make the mock hang (never resolve)
    let resolvePreview: (val: readonly GenericWorkoutRow[]) => void = () => {};
    mockPreviewDefinition.mockImplementation(
      () =>
        new Promise<readonly GenericWorkoutRow[]>((resolve) => {
          resolvePreview = resolve;
        })
    );

    render(<ProgressionStep {...baseProps} />);

    const previewButton = screen.getByText('programs.wizard.progression.actions.preview');
    fireEvent.click(previewButton);

    // Button should show loading and be disabled
    await waitFor(() => {
      expect(screen.getByText('programs.wizard.progression.loading')).toBeInTheDocument();
    });

    const loadingButton = screen.getByText('programs.wizard.progression.loading');
    expect(loadingButton).toBeDisabled();

    // Resolve to clean up
    resolvePreview(MOCK_PREVIEW_ROWS);
  });

  it('renders PreviewTable after successful preview response', async () => {
    render(<ProgressionStep {...baseProps} />);

    fireEvent.click(screen.getByText('programs.wizard.progression.actions.preview'));

    await waitFor(() => {
      expect(
        screen.getByRole('table', { name: 'programs.wizard.preview.table_aria' })
      ).toBeInTheDocument();
    });
  });

  it('shows inline error after 422 response', async () => {
    mockPreviewDefinition.mockImplementation(() => Promise.reject(new Error('422')));

    render(<ProgressionStep {...baseProps} />);

    fireEvent.click(screen.getByText('programs.wizard.progression.actions.preview'));

    await waitFor(() => {
      expect(
        screen.getByText('programs.wizard.progression.errors.preview_failed')
      ).toBeInTheDocument();
    });
  });

  it('clears preview table when a slot value changes after preview was shown', async () => {
    render(<ProgressionStep {...baseProps} />);

    // The first slot card renders with defaultOpen=true, so the template
    // dropdown should already be visible.
    const templateSelect = screen.getByLabelText(/programs\.wizard\.slot_card\.template/);
    expect(templateSelect).toBeInTheDocument();

    // Show preview
    fireEvent.click(screen.getByText('programs.wizard.progression.actions.preview'));

    await waitFor(() => {
      expect(
        screen.getByRole('table', { name: 'programs.wizard.preview.table_aria' })
      ).toBeInTheDocument();
    });

    // Change the template dropdown — this triggers handleSlotChange which
    // should clear the preview (set status back to 'idle').
    fireEvent.change(templateSelect, { target: { value: 'double-progression' } });

    // The preview table should be cleared (back to idle state)
    await waitFor(() => {
      expect(
        screen.queryByRole('table', { name: 'programs.wizard.preview.table_aria' })
      ).toBeNull();
    });
  });

  it('enables "Guardar y empezar" button when definition is valid', () => {
    render(<ProgressionStep {...baseProps} />);

    const saveButton = screen.getByText('programs.wizard.progression.actions.save_and_start');
    expect(saveButton).not.toBeDisabled();
  });

  it('enables "Guardar borrador" button when definition is valid', () => {
    render(<ProgressionStep {...baseProps} />);

    const draftButton = screen.getByText('programs.wizard.progression.actions.save_draft');
    expect(draftButton).not.toBeDisabled();
  });
});
