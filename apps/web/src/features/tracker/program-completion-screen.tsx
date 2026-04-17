import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { CompletionStats, PersonalRecord, OneRMEstimate } from '@/lib/profile-stats';
import { formatVolume } from '@/lib/profile-stats';
import { ProfileStatCard } from '@/features/profile/profile-stat-card';

interface ProgramCompletionScreenProps {
  readonly programName: string;
  readonly completion: CompletionStats;
  readonly personalRecords: readonly PersonalRecord[];
  readonly oneRMEstimates: readonly OneRMEstimate[];
  readonly totalVolume: number;
  readonly onViewProfile: () => void;
  readonly onBackToDashboard: () => void;
}

export function ProgramCompletionScreen({
  programName,
  completion,
  personalRecords,
  oneRMEstimates,
  totalVolume,
  onViewProfile,
  onBackToDashboard,
}: ProgramCompletionScreenProps): React.ReactNode {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onBackToDashboard();
    };
    document.addEventListener('keydown', handleKeyDown);
    return (): void => document.removeEventListener('keydown', handleKeyDown);
  }, [onBackToDashboard]);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-body overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
        {/* Celebration header */}
        <div className="text-center mb-12">
          <img
            src="/completion-celebration.webp"
            alt=""
            className="w-full max-w-xl mx-auto mb-6 opacity-90"
          />
          <h1
            className="font-display text-5xl sm:text-7xl text-title leading-none mb-3"
            style={{ textShadow: '0 0 40px rgba(240, 192, 64, 0.25)' }}
          >
            {t('tracker.completion.header')}
          </h1>
          <p className="text-lg sm:text-xl text-info font-bold">{programName}</p>
          <div
            className="h-1 w-24 mx-auto mt-4"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
            }}
          />
        </div>

        {/* Key stats grid */}
        <section className="mb-10">
          <div className="grid grid-cols-3 gap-3">
            <ProfileStatCard
              value={`${completion.workoutsCompleted}`}
              label={t('tracker.completion.workouts_label')}
              sublabel={`${t('tracker.completion.workouts_of')} ${completion.totalWorkouts}`}
            />
            <ProfileStatCard
              value={`${formatVolume(totalVolume)} kg`}
              label={t('tracker.completion.total_volume')}
            />
            {completion.totalWeightGained > 0 ? (
              <ProfileStatCard
                value={`+${completion.totalWeightGained} kg`}
                label={t('tracker.completion.weight_gained')}
                accent
              />
            ) : (
              <ProfileStatCard value={'\u2014'} label={t('tracker.completion.weight_gained')} />
            )}
          </div>
        </section>

        {/* Personal Records */}
        {personalRecords.length > 0 && (
          <section className="mb-10">
            <h2 className="section-label mb-4">{t('tracker.completion.personal_records')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {personalRecords.map((pr) => {
                const delta = pr.weight - pr.startWeight;
                return (
                  <ProfileStatCard
                    key={pr.exercise}
                    value={`${pr.weight} kg`}
                    label={pr.displayName}
                    badge={delta > 0 ? `+${delta} kg` : undefined}
                    badgeVariant="success"
                    accent
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* 1RM Estimates */}
        {oneRMEstimates.length > 0 && (
          <section className="mb-10">
            <h2 className="section-label mb-4">{t('tracker.completion.estimated_1rm')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {oneRMEstimates.map((e) => (
                <ProfileStatCard
                  key={e.exercise}
                  value={`${e.estimatedKg} kg`}
                  label={e.displayName}
                  sublabel={`${e.sourceWeight} kg \u00D7 ${e.sourceAmrapReps} reps`}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted mt-2 text-center">
              {t('tracker.completion.epley_note')}
            </p>
          </section>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 mt-12">
          <button
            type="button"
            onClick={onViewProfile}
            className="px-8 py-3 text-sm font-bold border-2 border-accent bg-accent text-body cursor-pointer transition-all hover:opacity-90 active:scale-95"
          >
            {t('tracker.completion.view_profile')}
          </button>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-8 py-3 text-sm font-bold border-2 border-btn-ring bg-transparent text-title cursor-pointer transition-all hover:bg-btn-active active:scale-95"
          >
            {t('tracker.completion.back_to_dashboard')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
