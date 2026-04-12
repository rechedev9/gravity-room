import { useTranslation } from 'react-i18next';
import type { ProgramSummary } from '@/lib/api-functions';
import type { ProfileData } from '@/lib/profile-stats';
import { formatVolume } from '@/lib/profile-stats';
import { DashboardCard } from '@/components/dashboard-card';
import { ProfileStatCard } from './profile-stat-card';

interface ProfileStatsGridProps {
  readonly profileData: ProfileData;
  readonly names: Readonly<Record<string, string>>;
  readonly allPrograms: readonly ProgramSummary[];
  readonly lifetimeVolume: number | null;
  readonly volumeSectionRef: React.RefCallback<HTMLElement>;
  readonly toDisplay: (kg: number) => number;
  readonly unitLabel: string;
}

export function ProfileStatsGrid({
  profileData,
  names,
  allPrograms,
  lifetimeVolume,
  volumeSectionRef,
  toDisplay,
  unitLabel,
}: ProfileStatsGridProps): React.ReactNode {
  const { t } = useTranslation();
  const isEmpty = profileData.completion.workoutsCompleted === 0;
  const hasRecords = profileData.personalRecords.length > 0;

  return (
    // items-start prevents short cards from stretching to fill the tallest cell
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
      {/* Quick Stats */}
      <DashboardCard title={t('profile.stats_grid.stats_title')}>
        {isEmpty ? (
          <p className="text-sm text-muted py-2 text-center">
            {t('profile.stats_grid.empty_message')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4">
            <ProfileStatCard
              compact
              value={String(profileData.completion.workoutsCompleted)}
              label={t('profile.stats_grid.workouts_label')}
              sublabel={`${t('profile.stats_grid.workouts_of')} ${profileData.completion.totalWorkouts}`}
            />
            <ProfileStatCard
              compact
              value={`${profileData.completion.overallSuccessRate}%`}
              label={t('profile.stats_grid.success_rate_label')}
            />
            <ProfileStatCard
              compact
              value={`${formatVolume(toDisplay(profileData.volume.totalVolume))} ${unitLabel}`}
              label={t('profile.stats_grid.total_volume_label')}
              sublabel={`${profileData.volume.totalSets} ${t('profile.stats_grid.sets_label')} / ${profileData.volume.totalReps} ${t('profile.stats_grid.reps_label')}`}
            />
            <ProfileStatCard
              compact
              value={`${profileData.completion.completionPct}%`}
              label={t('profile.stats_grid.completed_label')}
              progress={{
                value: profileData.completion.completionPct,
                label: `${profileData.completion.workoutsCompleted} ${t('profile.stats_grid.workouts_of')} ${profileData.completion.totalWorkouts} ${t('profile.stats_grid.workouts_label_plural')}`,
              }}
            />
          </div>
        )}
      </DashboardCard>

      {/* Streak — hidden when no data */}
      {(profileData.streak.current > 0 || profileData.streak.longest > 0) && (
        <DashboardCard title={t('profile.stats_grid.streak_title')}>
          <div className="grid grid-cols-2 gap-x-4">
            <ProfileStatCard
              compact
              value={String(profileData.streak.current)}
              label={t('profile.stats_grid.current_streak_label')}
              sublabel={t('profile.stats_grid.consecutive_label')}
            />
            <ProfileStatCard
              compact
              value={String(profileData.streak.longest)}
              label={t('profile.stats_grid.longest_streak_label')}
              sublabel={t('profile.stats_grid.consecutive_label')}
            />
          </div>
        </DashboardCard>
      )}

      {/* Monthly Summary */}
      {profileData.monthlyReport && profileData.monthlyReport.workoutsCompleted > 0 && (
        <DashboardCard title={profileData.monthlyReport.monthLabel}>
          <div className="grid grid-cols-2 gap-x-4">
            <ProfileStatCard
              compact
              value={String(profileData.monthlyReport.workoutsCompleted)}
              label={t('profile.stats_grid.workouts_label')}
              sublabel={t('profile.stats_grid.this_month_label')}
            />
            <ProfileStatCard
              compact
              value={`${profileData.monthlyReport.successRate}%`}
              label={t('profile.stats_grid.success_rate_label')}
            />
            <ProfileStatCard
              compact
              value={String(profileData.monthlyReport.personalRecords)}
              label={t('profile.stats_grid.new_prs_label')}
              accent={profileData.monthlyReport.personalRecords > 0}
            />
            <ProfileStatCard
              compact
              value={`${formatVolume(toDisplay(profileData.monthlyReport.totalVolume))} ${unitLabel}`}
              label={t('profile.stats_grid.volume_label')}
              sublabel={`${profileData.monthlyReport.totalSets} ${t('profile.stats_grid.sets_label')} / ${profileData.monthlyReport.totalReps} ${t('profile.stats_grid.reps_label')}`}
            />
          </div>
        </DashboardCard>
      )}

      {/* Personal Records — hidden when no PRs exist */}
      {hasRecords && (
        <DashboardCard
          title={t('profile.stats_grid.personal_records_title')}
          className="sm:col-span-2 lg:col-span-1"
        >
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
                    pr.workoutIndex >= 0
                      ? `${t('profile.stats_grid.workout_number_label')}${pr.workoutIndex + 1}`
                      : t('profile.stats_grid.initial_weight_label')
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
        <DashboardCard title={t('profile.stats_grid.e1rm_title')}>
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
            {t('profile.stats_grid.epley_note')}
          </p>
        </DashboardCard>
      )}

      {/* Lifetime Volume — only when multiple programs */}
      {allPrograms.length > 1 && (
        <div ref={volumeSectionRef} data-testid="lifetime-volume">
          <DashboardCard title={t('profile.stats_grid.lifetime_volume_title')}>
            <ProfileStatCard
              compact
              value={
                lifetimeVolume !== null
                  ? `${formatVolume(toDisplay(lifetimeVolume))} ${unitLabel}`
                  : '...'
              }
              label={t('profile.stats_grid.all_programs_label')}
              sublabel={`${allPrograms.length} ${t('profile.stats_grid.programs_label_plural')}`}
            />
          </DashboardCard>
        </div>
      )}
    </div>
  );
}
