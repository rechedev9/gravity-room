import { useNavigate } from 'react-router-dom';
import type { ProgramSummary } from '@/lib/api-functions';
import type { ProfileData } from '@/lib/profile-stats';
import { Button } from './button';

const completedBadgeStyle = {
  background: 'rgba(200,168,78,0.08)',
  border: '1px solid rgba(200,168,78,0.2)',
} as const;

interface ProfileBannerProps {
  readonly profileData: ProfileData;
  readonly activeProgramName: string;
  readonly isActive: boolean;
  readonly activeProgram: ProgramSummary | undefined;
  readonly allPrograms: readonly ProgramSummary[];
  readonly effectiveInstanceId: string | undefined;
  readonly onSelectInstance: (id: string | undefined) => void;
}

export function ProfileBanner({
  profileData,
  activeProgramName,
  isActive,
  activeProgram,
  allPrograms,
  effectiveInstanceId,
  onSelectInstance,
}: ProfileBannerProps): React.ReactNode {
  const navigate = useNavigate();
  const isEmpty = profileData.completion.workoutsCompleted === 0;

  return (
    <>
      <div className="bg-card border border-rule shadow-card mb-6 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, transparent 60%)' }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 sm:py-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1">
              {isActive && (
                <span className="shrink-0 font-mono text-2xs tracking-widest uppercase px-2 py-0.5 bg-ok-bg border border-ok-ring text-ok">
                  Activo
                </span>
              )}
              {!isActive && activeProgram && (
                <span
                  className="shrink-0 font-mono text-2xs tracking-widest uppercase px-2 py-0.5 text-title"
                  style={completedBadgeStyle}
                >
                  Completado
                </span>
              )}
            </div>
            <p className="font-display text-2xl sm:text-3xl text-title leading-none truncate">
              {activeProgramName}
            </p>
            {isEmpty ? (
              <p className="text-xs text-muted mt-1.5">Tu primer entrenamiento te espera</p>
            ) : (
              <p className="text-xs text-muted mt-1.5">
                Entrenamiento {profileData.completion.workoutsCompleted} de{' '}
                {profileData.completion.totalWorkouts}
              </p>
            )}
          </div>
          {isEmpty ? (
            <Button size="sm" onClick={() => void navigate('/app/tracker')}>
              Comenzar
            </Button>
          ) : (
            <div className="flex items-center gap-6 shrink-0">
              <div className="text-center">
                <p className="font-display-data text-3xl sm:text-4xl text-title leading-none tabular-nums">
                  {profileData.completion.completionPct}%
                </p>
                <p className="text-2xs text-muted mt-1">Completado</p>
              </div>
              <div className="text-center">
                <p className="font-display-data text-3xl sm:text-4xl text-title leading-none tabular-nums">
                  {profileData.completion.overallSuccessRate}%
                </p>
                <p className="text-2xs text-muted mt-1">Éxito</p>
              </div>
            </div>
          )}
        </div>
        <div
          className="h-1 bg-progress-track"
          role="progressbar"
          aria-valuenow={profileData.completion.completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${profileData.completion.workoutsCompleted} de ${profileData.completion.totalWorkouts} entrenamientos`}
        >
          <div
            className="h-full bg-accent rounded-full transition-[width] duration-300 ease-out progress-fill"
            style={{
              width: `${Math.min(100, Math.max(0, profileData.completion.completionPct))}%`,
            }}
          />
        </div>
      </div>

      {allPrograms.length > 1 && (
        <div className="mb-6 relative">
          <select
            value={effectiveInstanceId ?? ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onSelectInstance(e.target.value || undefined)
            }
            className="w-full bg-card border border-rule text-sm text-title px-4 py-3 pr-10 font-mono appearance-none cursor-pointer focus:outline-none focus:border-accent transition-colors"
            aria-label="Selector de programa"
          >
            {allPrograms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.status === 'active' ? '● ' : '○ '}
                {p.name}
                {p.status === 'active'
                  ? ' — Activo'
                  : p.status === 'completed'
                    ? ' — Completado'
                    : ''}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2 4L6 8L10 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}
    </>
  );
}
