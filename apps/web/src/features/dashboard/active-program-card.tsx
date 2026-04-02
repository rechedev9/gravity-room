import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchGenericProgramDetail, fetchCatalogDetail, deleteProgram } from '@/lib/api-functions';
import type { ProgramSummary } from '@/lib/api-functions';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { parseCustomDefinition } from '@/lib/program-utils';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import { computeProfileData, formatVolume } from '@/lib/profile-stats';
import { useTracker } from '@/contexts/tracker-context';
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

  const definition: ProgramDefinition | undefined = isCustomProgram
    ? parseCustomDefinition(detailQuery.data?.customDefinition)
    : catalogQuery.data;

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
    navigate(`/app/tracker/${program.programId}`);
  };

  if (!definition) {
    const isOrphan = isCustomProgram ? detailQuery.isFetched && !definition : catalogQuery.isError;
    if (isOrphan) {
      return (
        <>
          <div className="bg-card border border-rule p-6">
            <h3 className="text-base font-extrabold text-title mb-2">Programa no disponible</h3>
            <p className="text-xs text-muted mb-5">
              La definición de este programa ya no existe. Elimina esta instancia para iniciar uno
              nuevo.
            </p>
            <Button
              onClick={() => setShowOrphanConfirm(true)}
              disabled={deleteOrphanMutation.isPending}
            >
              {deleteOrphanMutation.isPending ? 'Eliminando…' : 'Eliminar programa'}
            </Button>
          </div>
          <ConfirmDialog
            open={showOrphanConfirm}
            title="Eliminar programa huérfano"
            message="Se eliminarán todos los resultados asociados. ¿Continuar?"
            confirmLabel="Eliminar"
            cancelLabel="Cancelar"
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

  return (
    <div className="bg-card border border-rule card overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-5 sm:p-6 accent-left-gold flex-1">
        <h3 className="text-base font-extrabold text-title leading-tight mb-1">
          {definition.name}
        </h3>
        <p className="text-xs text-muted">{definition.description.split('.')[0]}.</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-info mt-2 mb-3">
          <span>{totalWorkouts} entrenamientos</span>
          {definition.workoutsPerWeek > 0 && <span>{definition.workoutsPerWeek}x / semana</span>}
        </div>

        <div
          className="flex items-center gap-3 mb-4"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso del programa: ${completedWorkouts} de ${totalWorkouts} entrenamientos`}
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
          Continuar Entrenamiento
        </Button>
      </div>

      {/* KPI mini row */}
      {profileData && (
        <div className="grid grid-cols-3 divide-x divide-rule border-t border-rule">
          <div className="px-4 py-3 text-center">
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">Racha</p>
            <p className="font-display-data text-xl text-title">{profileData.streak.current}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">Éxito</p>
            <p className="font-display-data text-xl text-main">
              {profileData.completion.overallSuccessRate}%
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
              Volumen
            </p>
            <p className="font-display-data text-xl text-main">
              {formatVolume(profileData.volume.totalVolume)} kg
            </p>
          </div>
        </div>
      )}

      {/* Recent activity */}
      {definition && rows.length > 0 && detailQuery.data && (
        <div className="px-5 py-4 border-t border-rule">
          <h4 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
            Actividad Reciente
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
