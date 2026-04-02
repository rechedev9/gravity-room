import type { ProgramSummary } from '@/lib/api-functions';
import type { ProfileData } from '@/lib/profile-stats';
import { formatVolume } from '@/lib/profile-stats';
import { DashboardCard } from './dashboard-card';
import { ProfileStatCard } from './profile-stat-card';

interface ProfileStatsGridProps {
  readonly profileData: ProfileData;
  readonly names: Readonly<Record<string, string>>;
  readonly allPrograms: readonly ProgramSummary[];
  readonly lifetimeVolume: number | null;
  readonly volumeSectionRef: React.RefCallback<HTMLElement>;
  readonly accountCard?: React.ReactNode;
  readonly toDisplay: (kg: number) => number;
  readonly unitLabel: string;
}

export function ProfileStatsGrid({
  profileData,
  names,
  allPrograms,
  lifetimeVolume,
  volumeSectionRef,
  accountCard,
  toDisplay,
  unitLabel,
}: ProfileStatsGridProps): React.ReactNode {
  const isEmpty = profileData.completion.workoutsCompleted === 0;
  const hasRecords = profileData.personalRecords.length > 0;

  return (
    // items-start prevents short cards from stretching to fill the tallest cell
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
      {accountCard}

      {/* Quick Stats */}
      <DashboardCard title="Estadísticas">
        {isEmpty ? (
          <p className="text-sm text-muted py-2 text-center">
            Completa tu primer entrenamiento para ver tus estadísticas.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4">
            <ProfileStatCard
              compact
              value={String(profileData.completion.workoutsCompleted)}
              label="Entrenamientos"
              sublabel={`de ${profileData.completion.totalWorkouts}`}
            />
            <ProfileStatCard
              compact
              value={`${profileData.completion.overallSuccessRate}%`}
              label="Tasa de Éxito"
            />
            <ProfileStatCard
              compact
              value={`${formatVolume(toDisplay(profileData.volume.totalVolume))} ${unitLabel}`}
              label="Volumen Total"
              sublabel={`${profileData.volume.totalSets} series / ${profileData.volume.totalReps} reps`}
            />
            <ProfileStatCard
              compact
              value={`${profileData.completion.completionPct}%`}
              label="Completado"
              progress={{
                value: profileData.completion.completionPct,
                label: `${profileData.completion.workoutsCompleted} de ${profileData.completion.totalWorkouts} entrenamientos`,
              }}
            />
          </div>
        )}
      </DashboardCard>

      {/* Streak — hidden when no data */}
      {(profileData.streak.current > 0 || profileData.streak.longest > 0) && (
        <DashboardCard title="Racha">
          <div className="grid grid-cols-2 gap-x-4">
            <ProfileStatCard
              compact
              value={String(profileData.streak.current)}
              label="Racha Actual"
              sublabel="consecutivos"
            />
            <ProfileStatCard
              compact
              value={String(profileData.streak.longest)}
              label="Récord"
              sublabel="consecutivos"
            />
          </div>
        </DashboardCard>
      )}

      {/* Monthly Summary */}
      {profileData.monthlyReport && (
        <DashboardCard title={profileData.monthlyReport.monthLabel}>
          <div className="grid grid-cols-2 gap-x-4">
            <ProfileStatCard
              compact
              value={String(profileData.monthlyReport.workoutsCompleted)}
              label="Entrenamientos"
              sublabel="este mes"
            />
            <ProfileStatCard
              compact
              value={`${profileData.monthlyReport.successRate}%`}
              label="Tasa de Éxito"
            />
            <ProfileStatCard
              compact
              value={String(profileData.monthlyReport.personalRecords)}
              label="Nuevos PRs"
              accent={profileData.monthlyReport.personalRecords > 0}
            />
            <ProfileStatCard
              compact
              value={`${formatVolume(toDisplay(profileData.monthlyReport.totalVolume))} ${unitLabel}`}
              label="Volumen"
              sublabel={`${profileData.monthlyReport.totalSets} series / ${profileData.monthlyReport.totalReps} reps`}
            />
          </div>
        </DashboardCard>
      )}

      {/* Personal Records — hidden when no PRs exist */}
      {hasRecords && (
        <DashboardCard title="Récords Personales (T1)" className="sm:col-span-2 lg:col-span-1">
          <div className="grid grid-cols-2 gap-x-4">
            {profileData.personalRecords.map((pr) => {
              const delta = pr.weight - pr.startWeight;
              return (
                <ProfileStatCard
                  key={pr.exercise}
                  compact
                  value={`${toDisplay(pr.weight)} ${unitLabel}`}
                  label={names[pr.exercise] ?? pr.exercise}
                  sublabel={
                    pr.workoutIndex >= 0 ? `Entrenamiento #${pr.workoutIndex + 1}` : 'Peso inicial'
                  }
                  accent
                  badge={delta > 0 ? `+${toDisplay(delta)} ${unitLabel}` : undefined}
                  badgeVariant="success"
                />
              );
            })}
          </div>
        </DashboardCard>
      )}

      {/* 1RM Estimates */}
      {profileData.oneRMEstimates.length > 0 && (
        <DashboardCard title="1RM Estimado (Epley)">
          <div className="grid grid-cols-2 gap-x-4">
            {profileData.oneRMEstimates.map((e) => (
              <ProfileStatCard
                key={e.exercise}
                compact
                value={`${toDisplay(e.estimatedKg)} ${unitLabel}`}
                label={e.displayName}
                sublabel={`${toDisplay(e.sourceWeight)} ${unitLabel} × ${e.sourceAmrapReps} reps`}
              />
            ))}
          </div>
          <p className="text-2xs text-muted mt-2 text-center opacity-70">
            Estimación basada en la fórmula de Epley
          </p>
        </DashboardCard>
      )}

      {/* Lifetime Volume — only when multiple programs */}
      {allPrograms.length > 1 && (
        <div ref={volumeSectionRef} data-testid="lifetime-volume">
          <DashboardCard title="Volumen Total Global">
            <ProfileStatCard
              compact
              value={
                lifetimeVolume !== null
                  ? `${formatVolume(toDisplay(lifetimeVolume))} ${unitLabel}`
                  : '...'
              }
              label="Todos los Programas"
              sublabel={`${allPrograms.length} programas`}
            />
          </DashboardCard>
        </div>
      )}
    </div>
  );
}
