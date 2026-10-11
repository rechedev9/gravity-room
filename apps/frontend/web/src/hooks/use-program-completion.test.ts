import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/domain/types';
import { useProgramCompletion } from './use-program-completion';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

const DEFINITION = {
  id: 'fixture',
  name: 'Fixture',
  totalWorkouts: 2,
  workoutsPerWeek: 2,
  exercises: { squat: { name: 'Squat' } },
  configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 }],
  days: [],
} as unknown as ProgramDefinition;

const SLOT = {
  slotId: 'a-t1',
  exerciseId: 'squat',
  exerciseName: 'Squat',
  tier: 't1',
  weight: 100,
  stage: 0,
  sets: 5,
  reps: 3,
  isAmrap: false,
  stagesCount: 1,
  result: 'success',
  isChanged: false,
  isDeload: false,
  role: 'primary',
} as unknown as GenericSlotRow;

const ROWS: readonly GenericWorkoutRow[] = [
  { index: 0, dayName: 'A', slots: [SLOT], isChanged: false, completedAt: undefined },
];

interface Props {
  readonly config: Record<string, number | string> | null;
  readonly rows: readonly GenericWorkoutRow[];
  readonly instanceId?: string;
  readonly mutenroshiBlocksCompletion?: boolean;
}

function setup(initial: Props) {
  const finishProgram = vi.fn().mockResolvedValue(undefined);
  const onBackToDashboard = vi.fn();
  const hook = renderHook(
    (props: Props) =>
      useProgramCompletion({
        instanceId: props.instanceId,
        programId: 'fixture',
        definition: DEFINITION,
        config: props.config,
        rows: props.rows,
        resultTimestamps: undefined,
        mutenroshiBlocksCompletion: props.mutenroshiBlocksCompletion ?? false,
        finishProgram,
        onBackToDashboard,
      }),
    { initialProps: initial }
  );
  return { ...hook, finishProgram, onBackToDashboard };
}

describe('useProgramCompletion', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('keeps the completion summary after finishing empties the active program', async () => {
    const { result, rerender, finishProgram } = setup({ config: { squat: 100 }, rows: ROWS });
    expect(result.current.completionData).toBeNull();

    await act(() => result.current.handleFinishProgram());
    // Finishing leaves no active program: config and rows are gone on the next render.
    rerender({ config: null, rows: [] });

    expect(finishProgram).toHaveBeenCalledOnce();
    expect(result.current.completionData?.completion.workoutsCompleted).toBe(1);
  });

  it('closes the summary and goes back when dismissed', async () => {
    const { result, onBackToDashboard } = setup({ config: { squat: 100 }, rows: ROWS });
    await act(() => result.current.handleFinishProgram());

    act(() => result.current.handleCompletionDismiss());

    expect(result.current.completionData).toBeNull();
    expect(onBackToDashboard).toHaveBeenCalledOnce();
  });

  it('shows the summary once per program instance', async () => {
    const first = setup({ config: { squat: 100 }, rows: ROWS, instanceId: 'inst-1' });
    await act(() => first.result.current.handleFinishProgram());
    expect(first.result.current.completionData).not.toBeNull();

    const second = setup({ config: { squat: 100 }, rows: ROWS, instanceId: 'inst-1' });
    await act(() => second.result.current.handleFinishProgram());
    expect(second.result.current.completionData).toBeNull();
    expect(second.onBackToDashboard).toHaveBeenCalledOnce();
  });

  it('shows no summary while graduation still blocks completion', async () => {
    const { result, finishProgram } = setup({
      config: { squat: 100 },
      rows: ROWS,
      mutenroshiBlocksCompletion: true,
    });
    await act(() => result.current.handleFinishProgram());

    expect(finishProgram).toHaveBeenCalledOnce();
    expect(result.current.completionData).toBeNull();
  });
});
