import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/lib/query-keys';
import { fetchGenericProgramDetail, fetchCatalogDetail, deleteProgram } from '@/lib/api-functions';
import type { ProgramSummary } from '@/lib/api-functions';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import { computeProfileData, formatVolume } from '@/lib/profile-stats';
import { useTracker } from '@/contexts/tracker-context';
import { localizedProgramName, localizedProgramDescription } from '@/lib/catalog-display';
import { RecentActivity } from './recent-activity';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/button';

interface ActiveProgramCardProps {
  readonly program: ProgramSummary;
  readonly onOrphanDeleted?: () => void;
}

export function ActiveProgramCard({
  program,
  onOrphanDeleted,
}: ActiveProgramCardProps): React.ReactNode {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setTracker } = useTracker();
  const queryClient = useQueryClient();
  const [showOrphanConfirm, setShowOrphanConfirm] = useState(false);
  const isCustomProgram = program.programId.startsWith('custom:');

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(program.programId),
    queryFn: () => fetchCatalogDetail(program.programId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !isCustomProgram,
  });

  const deleteOrphanMutation = useMutation({
    mutationFn: () => deleteProgram(program.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      onOrphanDeleted?.();
    },
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.programs.detail(program.id),
    queryFn: () => fetchGenericProgramDetail(program.id),
  });

  const definition: ProgramDefinition | undefined = catalogQuery.data;

  const rows = useMemo(() => {
    if (!detailQuery.data || !definition) return [];
    return computeGenericProgram(
      definition,
      detailQuery.data.config ?? {},
      detailQuery.data.results ?? {}
    );
  }, [detailQuery.data, definition]);

  const completedWorkouts = useMemo(() => {
    if (!detailQuery.data || !definition) return 0;
    const results = detailQuery.data.results;
    let count = 0;
    for (let i = 0; i < definition.totalWorkouts; i++) {
      const dayIndex = i % definition.cycleLength;
      const day = definition.days[dayIndex];
      const workoutResult = results[String(i)];
      if (!workoutResult) continue;
      const allDone = day.slots.every((slot) => workoutResult[slot.id]?.result !== undefined);
      if (allDone) count++;
    }
    return count;
  }, [detailQuery.data, definition]);

  const profileData = useMemo(() => {
    if (!definition || rows.length === 0) return null;
    return computeProfileData(
      rows,
      definition,
      detailQuery.data?.config ?? {},
      detailQuery.data?.resultTimestamps ?? {}
    );
  }, [definition, rows, detailQuery.data]);

  const totalWorkouts = definition?.totalWorkouts ?? 0;
  const progressPct = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

  const handleContinue = (): void => {
    setTracker(program.programId, program.id);
    void navigate({ to: '/app/tracker/$programId', params: { programId: program.programId } });
  };

  if (!definition) {
    const isOrphan = isCustomProgram ? detailQuery.isFetched : catalogQuery.isError;
    if (isOrphan) {
      return (
        <>
          <div className="bg-card border border-rule p-6">
            <h3 className="text-base font-extrabold text-title mb-2">
              {t('catalog.active_card.orphan_title')}
            </h3>
            <p className="text-xs text-muted mb-5">{t('catalog.active_card.orphan_description')}</p>
            <Button
              onClick={() => setShowOrphanConfirm(true)}
              disabled={deleteOrphanMutation.isPending}
            >
              {deleteOrphanMutation.isPending
                ? t('catalog.active_card.orphan_delete_loading')
                : t('catalog.active_card.orphan_delete_button')}
            </Button>
          </div>
          <ConfirmDialog
            open={showOrphanConfirm}
            title={t('catalog.active_card.orphan_confirm_title')}
            message={t('catalog.active_card.orphan_confirm_message')}
            confirmLabel={t('common.delete')}
            cancelLabel={t('common.cancel')}
            onConfirm={() => {
              setShowOrphanConfirm(false);
              deleteOrphanMutation.mutate();
            }}
            onCancel={() => setShowOrphanConfirm(false)}
          />
        </>
      );
    }
    return (
      <div className="bg-card border border-rule p-6 animate-pulse">
        <div className="h-5 w-48 bg-rule rounded mb-3" />
        <div className="h-2 bg-progress-track rounded mb-4" />
        <div className="h-10 w-48 bg-rule rounded" />
      </div>
    );
  }

  const displayName = localizedProgramName(t, definition.id, definition.name);
  const displayDescription = localizedProgramDescription(t, definition.id, definition.description);
  const shortDescription = `${displayDescription.split('.')[0]}.`;

  return (
    <div className="bg-card border border-rule card overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-5 sm:p-6 accent-left-gold flex-1">
        <h3 className="text-base font-extrabold text-title leading-tight mb-1">{displayName}</h3>
        <p className="text-xs text-muted">{shortDescription}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-info mt-2 mb-3">
          <span>{t('catalog.active_card.workouts_count', { count: totalWorkouts })}</span>
          {definition.workoutsPerWeek > 0 && (
            <span>{t('catalog.active_card.frequency', { count: definition.workoutsPerWeek })}</span>
          )}
        </div>

        <div
          className="flex items-center gap-3 mb-4"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('catalog.active_card.progress_aria', {
            completed: completedWorkouts,
            total: totalWorkouts,
          })}
        >
          <div className="flex-1 h-2.5 bg-progress-track overflow-hidden rounded-full">
            <div
              className="h-full bg-accent transition-[width] duration-300 ease-out progress-fill rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-xs font-bold text-muted whitespace-nowrap tabular-nums">
            {completedWorkouts}/{totalWorkouts}
          </span>
        </div>

        <Button variant="primary" onClick={handleContinue}>
          {t('programs.card.continue_training')}
        </Button>
      </div>

      {/* KPI mini row */}
      {profileData && (
        <div className="grid grid-cols-3 divide-x divide-rule border-t border-rule">
          <div className="px-4 py-3 text-center">
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
              {t('catalog.active_card.kpi_streak')}
            </p>
            <p className="font-display-data text-xl text-title">{profileData.streak.current}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
              {t('catalog.active_card.kpi_success')}
            </p>
            <p className="font-display-data text-xl text-main">
              {profileData.completion.overallSuccessRate}%
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
              {t('catalog.active_card.kpi_volume')}
            </p>
            <p className="font-display-data text-xl text-main">
              {formatVolume(profileData.volume.totalVolume)} kg
            </p>
          </div>
        </div>
      )}

      {/* Recent activity */}
      {rows.length > 0 && detailQuery.data && (
        <div className="px-5 py-4 border-t border-rule">
          <h4 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
            {t('catalog.active_card.recent_activity')}
          </h4>
          <RecentActivity
            rows={rows}
            definition={definition}
            resultTimestamps={detailQuery.data.resultTimestamps ?? {}}
          />
        </div>
      )}
    </div>
  );
}
