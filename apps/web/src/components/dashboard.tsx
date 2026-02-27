import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchPrograms,
  fetchGenericProgramDetail,
  fetchCatalogList,
  fetchCatalogDetail,
} from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { ProgramCard } from './program-card';
import { AppHeader } from './app-header';
import type { ProgramSummary } from '@/lib/api-functions';

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
}

function ActiveProgramCard({
  program,
  onContinue,
  onGoToProfile,
}: ActiveProgramCardProps): React.ReactNode {
  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(program.programId),
    queryFn: () => fetchCatalogDetail(program.programId),
    staleTime: 5 * 60 * 1000,
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

  if (!definition) return null;

  return (
    <>
      <div className="bg-card border border-rule p-6 sm:p-8 card card-glow-gold accent-left-gold edge-glow-top">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-heading leading-tight">
              {definition.name}
            </h3>
            <p className="text-xs text-muted mt-1">{definition.description.split('.')[0]}.</p>
          </div>
        </div>

        {/* Duration metadata */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-info mb-3">
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
          <button
            onClick={() => onContinue(program.id, program.programId)}
            className="px-5 py-2.5 text-xs font-bold border-2 border-btn-ring bg-btn-active text-btn-active-text cursor-pointer transition-all hover:opacity-90"
          >
            Continuar Entrenamiento
          </button>
          {onGoToProfile && (
            <button
              onClick={onGoToProfile}
              className="px-5 py-2.5 text-xs font-bold text-muted hover:text-heading cursor-pointer transition-colors border border-rule hover:border-rule-light"
            >
              Ver Perfil de Entrenamiento
            </button>
          )}
        </div>
      </div>

      {/* Last session summary */}
      {lastCompletedWorkout !== null && (
        <section className="bg-card border border-rule p-5 sm:p-6 mt-4">
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted mb-3">
            Último Entrenamiento
          </h4>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-sm font-bold text-heading">
              #{lastCompletedWorkout.index + 1}
            </span>
            <span className="text-xs text-muted uppercase">{lastCompletedWorkout.dayName}</span>
            {lastSessionDate !== null && (
              <span className="text-[11px] text-info ml-auto">{lastSessionDate}</span>
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

  // Fetch catalog of preset programs from API
  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's program instances from API
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null,
  });

  const activeProgram = (() => {
    if (!programsQuery.data) return null;
    return programsQuery.data.find((p) => p.status === 'active') ?? null;
  })();

  return (
    <div className="min-h-dvh bg-body">
      <AppHeader onGoToProfile={onGoToProfile} />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* Active program loading skeleton */}
        {programsQuery.isLoading && (
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
            />
          </section>
        )}

        {/* Program catalog — all real programs from API */}
        <section>
          <h2 className="section-label mb-4">
            {activeProgram ? 'Otros Programas Disponibles' : 'Elegir un Programa'}
          </h2>
          {activeProgram && (
            <p className="text-xs text-muted mb-4">
              Finaliza tu programa actual para iniciar uno nuevo.
            </p>
          )}

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

          {/* Catalog loaded — render program cards (exclude active program) */}
          {catalogQuery.data &&
            (() => {
              const filteredCatalog = catalogQuery.data.filter(
                (entry) => entry.id !== activeProgram?.programId
              );
              if (filteredCatalog.length === 0) return null;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCatalog.map((entry) => (
                    <ProgramCard
                      key={entry.id}
                      definition={entry}
                      isActive={false}
                      disabled={activeProgram !== null}
                      disabledLabel="Finaliza tu programa actual"
                      onSelect={() => onStartNewProgram(entry.id)}
                    />
                  ))}
                </div>
              );
            })()}
        </section>
      </div>
    </div>
  );
}
