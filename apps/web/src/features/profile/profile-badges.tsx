import { useMemo } from 'react';
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
  lifetimeVolume: number | null
): readonly Badge[] {
  return [
    {
      id: 'first-workout',
      label: 'Primer Entrenamiento',
      description: 'Completa 1 entrenamiento',
      unlocked: profileData.completion.workoutsCompleted >= 1,
    },
    {
      id: 'streak-5',
      label: 'Racha de 5',
      description: '5 entrenamientos consecutivos',
      unlocked: profileData.streak.longest >= 5,
    },
    {
      id: '100kg-club',
      label: 'Club 100 kg',
      description: 'Cualquier T1 llega a 100 kg',
      unlocked: profileData.personalRecords.some((pr) => pr.weight >= 100),
    },
    {
      id: 'complete-program',
      label: 'Programa Completo',
      description: 'Termina un programa completo',
      unlocked: allPrograms.some((p) => p.status === 'completed'),
    },
    {
      id: 'volume-10k',
      label: 'Volumen 10K',
      description: '10.000 kg de volumen total',
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
  const badges = useMemo(
    () => deriveBadges(profileData, allPrograms, lifetimeVolume),
    [profileData, allPrograms, lifetimeVolume]
  );
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Logros</p>
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
