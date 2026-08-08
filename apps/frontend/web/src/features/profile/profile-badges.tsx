import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgramSummary } from '@/lib/api-functions';
import type { ProfileData } from '@/lib/profile-stats';
import { formatVolume } from '@/lib/profile-stats';

interface Badge {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly unlocked: boolean;
  readonly current: number;
  readonly target: number;
  readonly progressLabel: string;
}

interface ProfileBadgesProps {
  readonly profileData: ProfileData;
  readonly allPrograms: readonly ProgramSummary[];
  readonly lifetimeVolume: number | null;
}

function deriveBadges(
  profileData: ProfileData,
  allPrograms: readonly ProgramSummary[],
  lifetimeVolume: number | null,
  t: (key: string) => string
): readonly Badge[] {
  const highestPrimaryWeight = Math.max(0, ...profileData.personalRecords.map((pr) => pr.weight));
  const totalVolume = lifetimeVolume ?? profileData.volume.totalVolume;
  const completedPrograms = allPrograms.filter((program) => program.status === 'completed').length;
  const programProgress =
    completedPrograms > 0
      ? profileData.completion.totalWorkouts
      : profileData.completion.workoutsCompleted;

  return [
    {
      id: 'first-workout',
      label: t('profile.badges.first_workout.label'),
      description: t('profile.badges.first_workout.description'),
      unlocked: profileData.completion.workoutsCompleted >= 1,
      current: Math.min(profileData.completion.workoutsCompleted, 1),
      target: 1,
      progressLabel: `${Math.min(profileData.completion.workoutsCompleted, 1)} / 1`,
    },
    {
      id: 'streak-5',
      label: t('profile.badges.streak_5.label'),
      description: t('profile.badges.streak_5.description'),
      unlocked: profileData.streak.longest >= 5,
      current: Math.min(profileData.streak.longest, 5),
      target: 5,
      progressLabel: `${Math.min(profileData.streak.longest, 5)} / 5`,
    },
    {
      id: '100kg-club',
      label: t('profile.badges.club_100kg.label'),
      description: t('profile.badges.club_100kg.description'),
      unlocked: highestPrimaryWeight >= 100,
      current: Math.min(highestPrimaryWeight, 100),
      target: 100,
      progressLabel: `${Math.min(highestPrimaryWeight, 100)} / 100 kg`,
    },
    {
      id: 'complete-program',
      label: t('profile.badges.complete_program.label'),
      description: t('profile.badges.complete_program.description'),
      unlocked: completedPrograms >= 1,
      current: Math.min(programProgress, profileData.completion.totalWorkouts),
      target: profileData.completion.totalWorkouts,
      progressLabel: `${Math.min(programProgress, profileData.completion.totalWorkouts)} / ${profileData.completion.totalWorkouts}`,
    },
    {
      id: 'volume-10k',
      label: t('profile.badges.volume_10k.label'),
      description: t('profile.badges.volume_10k.description'),
      unlocked: totalVolume >= 10000,
      current: Math.min(totalVolume, 10000),
      target: 10000,
      progressLabel: `${formatVolume(Math.min(totalVolume, 10000))} / 10K kg`,
    },
  ];
}

export function ProfileBadges({
  profileData,
  allPrograms,
  lifetimeVolume,
}: ProfileBadgesProps): React.ReactNode {
  const { t } = useTranslation();
  const badges = useMemo(
    () => deriveBadges(profileData, allPrograms, lifetimeVolume, t),
    [profileData, allPrograms, lifetimeVolume, t]
  );
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const nextBadge = badges.find((badge) => !badge.unlocked);

  return (
    <section
      className="mb-6 bg-card border border-rule shadow-card"
      aria-labelledby="profile-badges"
    >
      <div className="flex flex-col gap-3 border-b border-rule px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2
            id="profile-badges"
            className="font-mono text-xs font-semibold text-muted uppercase tracking-[0.16em]"
          >
            {t('profile.badges.section_title')}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {t('profile.badges.unlocked_count', {
              unlocked: unlockedCount,
              total: badges.length,
            })}
          </p>
        </div>
        {nextBadge && (
          <div className="border-l-2 border-accent pl-3">
            <p className="font-mono text-2xs uppercase tracking-[0.16em] text-accent">
              {t('profile.badges.next_milestone')}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-title">
              {nextBadge.label}{' '}
              <span className="font-mono text-xs font-normal text-muted">
                {nextBadge.progressLabel}
              </span>
            </p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 lg:grid-cols-5">
        {badges.map((badge, index) => {
          const progressPct = Math.min(100, Math.max(0, (badge.current / badge.target) * 100));
          return (
            <div
              key={badge.id}
              title={badge.description}
              className={`min-w-0 bg-card px-4 py-4 last:col-span-2 sm:last:col-span-1 ${badge.unlocked ? 'text-ok' : 'text-muted'}`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span
                  className={`flex size-7 items-center justify-center border font-mono text-2xs font-bold ${
                    badge.unlocked
                      ? 'border-ok-ring bg-ok-bg text-ok'
                      : 'border-rule-light text-muted'
                  }`}
                  aria-hidden="true"
                >
                  {badge.unlocked ? '★' : String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-2xs tabular-nums">{badge.progressLabel}</span>
              </div>
              <p className={`text-xs font-semibold ${badge.unlocked ? 'text-ok' : 'text-title'}`}>
                {badge.label}
              </p>
              <p className="mt-1 min-h-8 text-2xs leading-relaxed text-muted">
                {badge.description}
              </p>
              <div
                className="mt-3 h-1 bg-progress-track"
                role="progressbar"
                aria-valuenow={Math.round(progressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${badge.label}: ${badge.progressLabel}`}
              >
                <div
                  className={`h-full ${badge.unlocked ? 'bg-ok' : 'bg-accent'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
