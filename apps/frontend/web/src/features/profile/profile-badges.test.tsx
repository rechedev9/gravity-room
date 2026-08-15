import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '@/lib/i18n';
import type { ProgramSummary } from '@/lib/api-functions';
import type { ProfileData } from '@/lib/profile-stats';
import { ProfileBadges } from './profile-badges';

const activeProgram: ProgramSummary = {
  id: 'program-1',
  programId: 'gzclp',
  name: 'GZCLP',
  config: {},
  status: 'active',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const completedProgram: ProgramSummary = {
  id: 'program-0',
  programId: 'gzclp',
  name: 'GZCLP (previous cycle)',
  config: {},
  status: 'completed',
  createdAt: '2025-11-01',
  updatedAt: '2025-12-15',
};

function profileData(workoutsCompleted: number): ProfileData {
  const hasProgress = workoutsCompleted > 0;
  return {
    personalRecords: [
      {
        exercise: 'squat',
        displayName: 'Sentadilla',
        weight: hasProgress ? 115 : 60,
        startWeight: 60,
        workoutIndex: hasProgress ? 12 : -1,
      },
    ],
    streak: { current: workoutsCompleted, longest: workoutsCompleted },
    volume: {
      totalVolume: hasProgress ? 97_950 : 0,
      totalSets: hasProgress ? 176 : 0,
      totalReps: hasProgress ? 1920 : 0,
    },
    completion: {
      workoutsCompleted,
      totalWorkouts: 90,
      completionPct: Math.round((workoutsCompleted / 90) * 100),
      overallSuccessRate: hasProgress ? 100 : 0,
      totalWeightGained: hasProgress ? 55 : 0,
    },
    monthlyReport: null,
    oneRMEstimates: [],
    lifetimeVolumeKg: hasProgress ? 97_950 : 0,
  };
}

describe('ProfileBadges', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
  });

  it('shows real progress toward the first milestone for a new lifter', () => {
    render(
      <ProfileBadges
        profileData={profileData(0)}
        allPrograms={[activeProgram]}
        lifetimeVolume={null}
      />
    );

    expect(screen.getByText('0 de 5 desbloqueados')).toBeVisible();
    expect(screen.getByText('Siguiente hito')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Club 100 kg: 60 / 100 kg' })).toHaveAttribute(
      'aria-valuenow',
      '60'
    );
  });

  it('points an advanced lifter to the remaining program milestone', () => {
    render(
      <ProfileBadges
        profileData={profileData(16)}
        allPrograms={[activeProgram]}
        lifetimeVolume={97_950}
      />
    );

    expect(screen.getByText('4 de 5 desbloqueados')).toBeVisible();
    expect(screen.getAllByText('Programa Completo')).toHaveLength(2);
    expect(screen.getByRole('progressbar', { name: 'Programa Completo: 16 / 90' })).toHaveAttribute(
      'aria-valuenow',
      '18'
    );
    expect(
      screen.getByRole('progressbar', { name: 'Volumen 10K: 10.000 / 10K kg' })
    ).toHaveAttribute('aria-valuenow', '100');
  });

  // Regression coverage for the "Programa Completo" badge contradicting the
  // rest of the page: it must never borrow the active program's totalWorkouts
  // as a denominator for a numerator that belongs to a different, already
  // completed program.
  describe.each([
    {
      name: 'no completed programs: shows honest active-program progress',
      allPrograms: [activeProgram],
      workoutsCompleted: 0,
      expectedUnlocked: false,
      expectedProgressLabel: '0 / 90',
      expectedValueNow: 0,
    },
    {
      name: 'one completed program, zero workouts on the active one: unlocked without claiming active progress',
      allPrograms: [activeProgram, completedProgram],
      workoutsCompleted: 0,
      expectedUnlocked: true,
      expectedProgressLabel: '1 / 1',
      expectedValueNow: 100,
    },
    {
      name: 'no completed programs, partially-progressed active program: shows real workout progress',
      allPrograms: [activeProgram],
      workoutsCompleted: 16,
      expectedUnlocked: false,
      expectedProgressLabel: '16 / 90',
      expectedValueNow: 18,
    },
  ])(
    '$name',
    ({
      allPrograms,
      workoutsCompleted,
      expectedUnlocked,
      expectedProgressLabel,
      expectedValueNow,
    }) => {
      it('renders a self-consistent progress bar for the complete-program badge', () => {
        render(
          <ProfileBadges
            profileData={profileData(workoutsCompleted)}
            allPrograms={allPrograms}
            lifetimeVolume={null}
          />
        );

        // Never contradicts the rest of the page: the progress bar's numerator
        // and denominator always come from the same source (either the active
        // program's own totals, or the count of completed programs), so it
        // never claims progress the user does not have.
        const progressbar = screen.getByRole('progressbar', {
          name: `Programa Completo: ${expectedProgressLabel}`,
        });
        expect(progressbar).toHaveAttribute('aria-valuenow', String(expectedValueNow));

        const fill = progressbar.firstElementChild;
        expect(fill).toHaveClass(expectedUnlocked ? 'bg-ok' : 'bg-accent');

        expect(screen.getAllByText('Programa Completo').length).toBeGreaterThan(0);
      });
    }
  );
});
