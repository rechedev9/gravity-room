import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgramCompletionScreen } from './program-completion-screen';
import type { CompletionStats, PersonalRecord, OneRMEstimate } from '@/lib/profile-stats';

// ---------------------------------------------------------------------------
// ProgramCompletionScreen — unit tests
// ---------------------------------------------------------------------------

const MOCK_COMPLETION: CompletionStats = {
  workoutsCompleted: 45,
  totalWorkouts: 90,
  completionPct: 50,
  overallSuccessRate: 85,
  totalWeightGained: 30,
};

const MOCK_PRS: readonly PersonalRecord[] = [
  { exercise: 'squat', displayName: 'Sentadilla', weight: 100, startWeight: 60, workoutIndex: 40 },
  { exercise: 'bench', displayName: 'Press Banca', weight: 70, startWeight: 40, workoutIndex: 38 },
];

const MOCK_ONE_RM: readonly OneRMEstimate[] = [
  {
    exercise: 'squat',
    displayName: 'Sentadilla',
    estimatedKg: 120,
    sourceWeight: 100,
    sourceAmrapReps: 5,
    workoutIndex: 40,
  },
];

function renderScreen(overrides?: {
  readonly oneRMEstimates?: readonly OneRMEstimate[];
  readonly onDismiss?: () => void;
  readonly onViewProfile?: () => void;
}): void {
  render(
    <ProgramCompletionScreen
      programName="GZCLP"
      completion={MOCK_COMPLETION}
      personalRecords={MOCK_PRS}
      oneRMEstimates={overrides?.oneRMEstimates ?? MOCK_ONE_RM}
      totalVolume={75264}
      onViewProfile={overrides?.onViewProfile ?? mock()}
      onBackToDashboard={overrides?.onDismiss ?? mock()}
    />
  );
}

describe('ProgramCompletionScreen', () => {
  it('should render program name', () => {
    renderScreen();

    expect(screen.getByText('GZCLP')).toBeDefined();
  });

  it('should show completion stats (workouts, volume)', () => {
    renderScreen();

    // Workouts completed
    expect(screen.getByText('45')).toBeDefined();
    expect(screen.getByText('Entrenamientos')).toBeDefined();

    // Volume — formatted with es-ES locale (dot separator)
    expect(screen.getByText('75.264 kg')).toBeDefined();
    expect(screen.getByText('Volumen Total')).toBeDefined();
  });

  it('should show 1RM estimates when provided', () => {
    renderScreen({ oneRMEstimates: MOCK_ONE_RM });

    expect(screen.getByText('1RM Estimado (Epley)')).toBeDefined();
    expect(screen.getByText('120 kg')).toBeDefined();
  });

  it('should call onBackToDashboard when "Volver al Dashboard" button clicked', () => {
    const onDismiss = mock();
    renderScreen({ onDismiss });

    fireEvent.click(screen.getByText('Volver al Dashboard'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should call onViewProfile when "Ver Perfil de Entrenamiento" button clicked', () => {
    const onViewProfile = mock();
    renderScreen({ onViewProfile });

    fireEvent.click(screen.getByText('Ver Perfil de Entrenamiento'));

    expect(onViewProfile).toHaveBeenCalledTimes(1);
  });
});
