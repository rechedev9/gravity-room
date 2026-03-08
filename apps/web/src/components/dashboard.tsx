import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchPrograms,
  fetchGenericProgramDetail,
  fetchCatalogList,
  fetchCatalogDetail,
  deleteProgram,
} from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { ProgramCard } from './program-card';
import { AppHeader } from './app-header';
import { GuestBanner } from './guest-banner';
import { ConfirmDialog } from './confirm-dialog';
import type { ProgramSummary } from '@/lib/api-functions';
import { PROGRAM_LEVELS } from '@gzclp/shared/catalog';
import type { ProgramLevel } from '@gzclp/shared/catalog';
import { Button } from './button';
import { WeeklyCalendar } from './weekly-calendar';

const LEVEL_LABELS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

interface DashboardProps {
  readonly onStartNewProgram: (programId: string) => void;
  readonly onContinueProgram: (instanceId: string, programId: string) => void;
  readonly onGoToProfile?: () => void;
}

// ---------------------------------------------------------------------------
// Active program card with progress bar (program-agnostic)
// ---------------------------------------------------------------------------

interface ActiveProgramCardProps {
  readonly program: ProgramSummary;
  readonly onContinue: (instanceId: string, programId: string) => void;
  readonly onGoToProfile?: () => void;
  readonly onOrphanDeleted?: () => void;
}

function ActiveProgramCard({
  program,
  onContinue,
  onGoToProfile,
  onOrphanDeleted,
}: ActiveProgramCardProps): React.ReactNode {
  const queryClient = useQueryClient();
  const [showOrphanConfirm, setShowOrphanConfirm] = useState(false);

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(program.programId),
    queryFn: () => fetchCatalogDetail(program.programId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const deleteOrphanMutation = useMutation({
    mutationFn: () => deleteProgram(program.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      onOrphanDeleted?.();
    },
  });

  const definition = catalogQuery.data;

  const detailQuery = useQuery({
    queryKey: queryKeys.programs.detail(program.id),
    queryFn: () => fetchGenericProgramDetail(program.id),
  });

  // Count workouts where ALL slots have a result (program-agnostic)
  const completedWorkouts = (() => {
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
  })();

  const totalWorkouts = definition?.totalWorkouts ?? 0;
  const progressPct = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

  // Derive last completed workout for the summary panel
  const lastCompletedWorkout = (() => {
    if (!detailQuery.data || !definition) return null;
    const results = detailQuery.data.results;
    for (let i = definition.totalWorkouts - 1; i >= 0; i--) {
      const dayIndex = i % definition.cycleLength;
      const day = definition.days[dayIndex];
      const workoutResult = results[String(i)];
      if (!workoutResult) continue;
      const allDone = day.slots.every((slot) => workoutResult[slot.id]?.result !== undefined);
      if (allDone) {
        return {
          index: i,
          dayIndex,
          dayName: day.name,
          slots: day.slots.map((slot) => ({
            exerciseName: definition.exercises[slot.exerciseId]?.name ?? slot.exerciseId,
            result: workoutResult[slot.id]?.result,
          })),
        };
      }
    }
    return null;
  })();

  // Derive timestamp for last completed workout
  const lastSessionDate = (() => {
    if (lastCompletedWorkout === null || !detailQuery.data) return null;
    const timestamps = detailQuery.data.resultTimestamps;
    if (!timestamps) return null;
    const ts = timestamps[String(lastCompletedWorkout.index)];
    if (typeof ts !== 'string') return null;
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(ts));
  })();

  // Build dayNames map: workout index -> day name from definition
  const calendarDayNames: Readonly<Record<string, string>> = (() => {
    if (!definition) return {};
    const names: Record<string, string> = {};
    for (let i = 0; i < definition.totalWorkouts; i++) {
      const dayIndex = i % definition.cycleLength;
      names[String(i)] = definition.days[dayIndex].name;
    }
    return names;
  })();

  const calendarDates: Readonly<Record<string, string>> = detailQuery.data?.completedDates ?? {};

  if (!definition) {
    // Catalog query failed or definition was deleted — show orphan recovery UI
    if (catalogQuery.isError) {
      return (
        <>
          <div className="bg-card border border-rule p-6 sm:p-8">
            <h3 className="text-base font-extrabold text-title mb-2">Programa no disponible</h3>
            <p className="text-xs text-muted mb-1">
              El programa <span className="font-mono">{program.programId}</span> ya no existe en el
              catálogo.
            </p>
            <p className="text-xs text-muted mb-5">
              Elimina esta instancia para poder iniciar un programa nuevo.
            </p>
            <Button
              onClick={() => setShowOrphanConfirm(true)}
              disabled={deleteOrphanMutation.isPending}
            >
              {deleteOrphanMutation.isPending ? 'Eliminando…' : 'Eliminar programa'}
            </Button>
            {deleteOrphanMutation.isError && (
              <p className="text-xs text-red-500 mt-2">No se pudo eliminar. Inténtalo de nuevo.</p>
            )}
          </div>
          <ConfirmDialog
            open={showOrphanConfirm}
            title="Eliminar programa huérfano"
            message="Este programa hace referencia a una definición que ya no existe. Se eliminarán todos los resultados asociados. ¿Continuar?"
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

    // Still loading — show skeleton
    return (
      <div className="bg-card border border-rule p-6 sm:p-8 card animate-pulse">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="h-5 w-40 bg-rule rounded mb-2" />
            <div className="h-3 w-56 bg-rule rounded" />
          </div>
        </div>
        <div className="flex gap-4 mb-3">
          <div className="h-3 w-28 bg-rule rounded" />
          <div className="h-3 w-20 bg-rule rounded" />
        </div>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-2.5 bg-progress-track rounded-full" />
          <div className="h-3 w-10 bg-rule rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-52 bg-rule rounded" />
          <div className="h-10 w-48 bg-rule rounded" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card border border-rule p-6 sm:p-8 accent-left-gold">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-title leading-tight">
              {definition.name}
            </h3>
            <p className="text-xs text-muted mt-1">{definition.description.split('.')[0]}.</p>
          </div>
        </div>

        {/* Duration metadata */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-info mb-3">
          <span>{totalWorkouts} entrenamientos</span>
          {definition.workoutsPerWeek > 0 && <span>{definition.workoutsPerWeek}x / semana</span>}
        </div>

        {/* Progress bar */}
        <div
          className="flex items-center gap-3 mb-5"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
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

        {/* Weeks remaining estimate */}
        {completedWorkouts < totalWorkouts &&
          detailQuery.data !== undefined &&
          definition.workoutsPerWeek > 0 &&
          (() => {
            const weeksRemaining = Math.ceil(
              (totalWorkouts - completedWorkouts) / definition.workoutsPerWeek
            );
            return (
              <p className="text-xs text-muted mt-1">
                ~{weeksRemaining} semana{weeksRemaining === 1 ? '' : 's'} restante
                {weeksRemaining === 1 ? '' : 's'}
              </p>
            );
          })()}

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => onContinue(program.id, program.programId)}>
            Continuar Entrenamiento
          </Button>
          {onGoToProfile && (
            <Button variant="ghost" onClick={onGoToProfile}>
              Ver Perfil de Entrenamiento
            </Button>
          )}
        </div>
      </div>

      {/* Last session summary */}
      {lastCompletedWorkout !== null && (
        <section className="border-t border-rule p-5 sm:p-6 -mt-px bg-card">
          <h4 className="text-xs font-bold text-muted mb-3">Último Entrenamiento</h4>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-sm font-bold text-title">#{lastCompletedWorkout.index + 1}</span>
            <span className="text-xs text-muted uppercase">{lastCompletedWorkout.dayName}</span>
            {lastSessionDate !== null && (
              <span className="text-xs text-info ml-auto">{lastSessionDate}</span>
            )}
          </div>
          <ul className="space-y-1">
            {lastCompletedWorkout.slots.map((slot) => (
              <li key={slot.exerciseName} className="flex items-center gap-2 text-xs text-main">
                <span>{slot.exerciseName}</span>
                <span className="ml-auto">
                  {slot.result === 'success'
                    ? '\u2713'
                    : slot.result === 'fail'
                      ? '\u2717'
                      : '\u2014'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Weekly calendar */}
      {detailQuery.data !== undefined && (
        <section className="mt-4">
          <WeeklyCalendar completedDates={calendarDates} dayNames={calendarDayNames} />
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function Dashboard({
  onStartNewProgram,
  onContinueProgram,
  onGoToProfile,
}: DashboardProps): React.ReactNode {
  const { user } = useAuth();
  const { isGuest } = useGuest();

  // Fetch catalog of preset programs from API
  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's program instances from API (disabled for guests)
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });

  const activeProgram = (() => {
    if (isGuest) return null;
    if (!programsQuery.data) return null;
    return programsQuery.data.find((p) => p.status === 'active') ?? null;
  })();

  return (
    <div className="min-h-dvh bg-body">
      <AppHeader onGoToProfile={onGoToProfile} />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {isGuest && <GuestBanner className="mb-6" />}

        {/* Active program loading skeleton */}
        {!isGuest && programsQuery.isLoading && (
          <section className="mb-12">
            <div className="h-3 w-24 bg-rule rounded mb-4 animate-pulse" />
            <div className="bg-card border border-rule p-5 sm:p-6 animate-pulse">
              <div className="h-5 w-48 bg-rule rounded mb-2" />
              <div className="h-3 w-64 bg-rule rounded mb-4" />
              <div className="h-2 bg-progress-track rounded mb-4" />
              <div className="h-10 w-52 bg-rule rounded" />
            </div>
          </section>
        )}

        {/* Active program card */}
        {activeProgram && (
          <section className="mb-12">
            <h2 className="section-label mb-4">Tu Programa</h2>
            <ActiveProgramCard
              program={activeProgram}
              onContinue={onContinueProgram}
              onGoToProfile={onGoToProfile}
              onOrphanDeleted={() => void programsQuery.refetch()}
            />
          </section>
        )}

        {/* Program catalog — all real programs from API */}
        <section>
          <h2 className="section-label mb-4">
            {activeProgram ? 'Otros Programas Disponibles' : 'Elegir un Programa'}
          </h2>

          {/* Catalog loading skeleton */}
          {catalogQuery.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-card border border-rule p-5 sm:p-6 animate-pulse">
                  <div className="h-4 w-32 bg-rule rounded mb-2" />
                  <div className="h-3 w-56 bg-rule rounded mb-4" />
                  <div className="h-3 w-24 bg-rule rounded mb-4" />
                  <div className="h-10 w-36 bg-rule rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Catalog error state */}
          {catalogQuery.isError && (
            <div className="bg-card border border-rule p-6 text-center">
              <p className="text-sm text-muted mb-3">No se pudo cargar el catálogo de programas.</p>
              <Button onClick={() => void catalogQuery.refetch()}>Reintentar</Button>
            </div>
          )}

          {/* Catalog loaded — render program cards grouped by level */}
          {catalogQuery.data &&
            (() => {
              const filteredCatalog = catalogQuery.data.filter(
                (entry) => entry.id !== activeProgram?.programId
              );
              if (filteredCatalog.length === 0) return null;

              const grouped = new Map<ProgramLevel, typeof filteredCatalog>();
              for (const entry of filteredCatalog) {
                const list = grouped.get(entry.level) ?? [];
                list.push(entry);
                grouped.set(entry.level, list);
              }

              return (
                <div className="space-y-8">
                  {PROGRAM_LEVELS.map((level) => {
                    const entries = grouped.get(level);
                    if (!entries || entries.length === 0) return null;
                    return (
                      <div key={level}>
                        <h3 className="text-xs font-semibold text-muted mb-3">
                          {LEVEL_LABELS[level]}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {entries.map((entry) => (
                            <ProgramCard
                              key={entry.id}
                              definition={entry}
                              isActive={false}
                              {...(isGuest
                                ? { onSelect: () => onStartNewProgram(entry.id) }
                                : { to: `/programs/${entry.id}` })}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
        </section>
      </div>
    </div>
  );
}
