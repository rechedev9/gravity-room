import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgramSummary } from '@/lib/api-functions';
import type { ProfileData } from '@/lib/profile-stats';

interface Badge {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly unlocked: boolean;
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
  return [
    {
      id: 'first-workout',
      label: t('profile.badges.first_workout.label'),
      description: t('profile.badges.first_workout.description'),
      unlocked: profileData.completion.workoutsCompleted >= 1,
    },
    {
      id: 'streak-5',
      label: t('profile.badges.streak_5.label'),
      description: t('profile.badges.streak_5.description'),
      unlocked: profileData.streak.longest >= 5,
    },
    {
      id: '100kg-club',
      label: t('profile.badges.club_100kg.label'),
      description: t('profile.badges.club_100kg.description'),
      unlocked: profileData.personalRecords.some((pr) => pr.weight >= 100),
    },
    {
      id: 'complete-program',
      label: t('profile.badges.complete_program.label'),
      description: t('profile.badges.complete_program.description'),
      unlocked: allPrograms.some((p) => p.status === 'completed'),
    },
    {
      id: 'volume-10k',
      label: t('profile.badges.volume_10k.label'),
      description: t('profile.badges.volume_10k.description'),
      // Single-program users: lifetimeVolume stays null (the lazy-loaded section
      // never renders), so fall back to the current program's volume.
      unlocked:
        allPrograms.length <= 1
          ? profileData.volume.totalVolume >= 10000
          : lifetimeVolume !== null && lifetimeVolume >= 10000,
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

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          {t('profile.badges.section_title')}
        </p>
        <span className="text-xs text-muted">
          {unlockedCount}/{badges.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <div
            key={badge.id}
            title={badge.description}
            className={`
              px-3 py-1.5 border text-xs font-semibold tracking-wide transition-colors
              ${
                badge.unlocked
                  ? 'bg-ok-bg border-ok-ring text-ok'
                  : 'bg-card border-rule text-muted opacity-40'
              }
            `}
          >
            {badge.unlocked ? '★' : '☆'} {badge.label}
          </div>
        ))}
      </div>
    </div>
  );
}
