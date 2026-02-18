import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllPresetPrograms, getProgramDefinition } from '@gzclp/shared/programs/registry';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms, fetchProgram } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { ProgramCard } from './program-card';
import { AppHeader } from './app-header';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { ProgramSummary } from '@/lib/api-functions';

interface DashboardProps {
  readonly onSelectProgram: (instanceId: string) => void;
  readonly onContinueProgram: () => void;
  readonly onGoToProfile?: () => void;
}

const COMING_SOON_CARD: ProgramDefinition = {
  id: 'custom',
  name: 'Custom Program',
  description:
    'Build your own training program with custom exercises, sets, reps, and progression rules.',
  author: '',
  category: 'custom',
  version: 1,
  source: 'custom',
  cycleLength: 1,
  totalWorkouts: 1,
  workoutsPerWeek: 1,
  exercises: {},
  configFields: [],
  weightIncrements: {},
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'placeholder',
          exerciseId: 'placeholder',
          tier: 't1',
          stages: [{ sets: 1, reps: 1 }],
          onSuccess: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'placeholder',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Active program card with progress bar
// ---------------------------------------------------------------------------

interface ActiveProgramCardProps {
  readonly program: ProgramSummary;
  readonly onContinue: () => void;
  readonly onGoToProfile?: () => void;
}

function ActiveProgramCard({
  program,
  onContinue,
  onGoToProfile,
}: ActiveProgramCardProps): React.ReactNode {
  const definition = getProgramDefinition(program.programId);

  const detailQuery = useQuery({
    queryKey: queryKeys.programs.detail(program.id),
    queryFn: () => fetchProgram(program.id),
    enabled: true,
  });

  // Count workouts where ALL three tiers have a result (not just any tier)
  const completedWorkouts = detailQuery.data
    ? Object.values(detailQuery.data.results).filter(
        (r) => r.t1 !== undefined && r.t2 !== undefined && r.t3 !== undefined
      ).length
    : 0;
  const totalWorkouts = definition?.totalWorkouts ?? 0;
  const progressPct = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

  if (!definition) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-5 sm:p-6 hover:border-[var(--border-light)] transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-[var(--text-header)] leading-tight">
            {definition.name}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {definition.description.split('.')[0]}.
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="flex items-center gap-3 mb-4"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="flex-1 h-2 bg-[var(--bg-progress)] overflow-hidden">
          <div
            className="h-full bg-[var(--fill-progress)] transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-[var(--text-muted)] whitespace-nowrap">
          {completedWorkouts}/{totalWorkouts} workouts
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onContinue}
          className="px-5 py-2.5 text-xs font-bold border-2 border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] cursor-pointer transition-all hover:opacity-90"
        >
          Continue Training
        </button>
        {onGoToProfile && (
          <button
            onClick={onGoToProfile}
            className="px-5 py-2.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer transition-colors"
          >
            View Training Profile
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Archived/completed program card
// ---------------------------------------------------------------------------

interface OtherProgramCardProps {
  readonly program: ProgramSummary;
  readonly onContinue: (instanceId: string) => void;
}

function OtherProgramCard({ program, onContinue }: OtherProgramCardProps): React.ReactNode {
  const definition = getProgramDefinition(program.programId);
  if (!definition) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-5 flex items-center justify-between gap-3">
      <div>
        <span className="text-xs font-bold text-[var(--text-header)]">{program.name}</span>
        <span className="ml-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
          {program.status}
        </span>
      </div>
      <button
        onClick={() => onContinue(program.id)}
        className="px-4 py-2 text-xs font-bold border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--border-light)] cursor-pointer transition-colors whitespace-nowrap"
      >
        Continue
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function Dashboard({
  onSelectProgram,
  onContinueProgram,
  onGoToProfile,
}: DashboardProps): React.ReactNode {
  const { user } = useAuth();
  const presets = getAllPresetPrograms();

  // Fetch programs from API
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null,
  });

  const activeProgram = useMemo(() => {
    if (!programsQuery.data) return null;
    return programsQuery.data.find((p) => p.status === 'active') ?? null;
  }, [programsQuery.data]);

  const otherPrograms = useMemo(() => {
    if (!programsQuery.data) return [];
    return programsQuery.data.filter((p) => p.status !== 'active');
  }, [programsQuery.data]);

  return (
    <div className="min-h-dvh bg-[var(--bg-body)]">
      <AppHeader onGoToProfile={onGoToProfile} />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* Active program card */}
        {activeProgram && (
          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
              Your Program
            </h2>
            <ActiveProgramCard
              program={activeProgram}
              onContinue={onContinueProgram}
              onGoToProfile={onGoToProfile}
            />
          </section>
        )}

        {/* Other programs (archived / completed) */}
        {otherPrograms.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
              Other Programs
            </h2>
            <div className="flex flex-col gap-2">
              {otherPrograms.map((p) => (
                <OtherProgramCard key={p.id} program={p} onContinue={onSelectProgram} />
              ))}
            </div>
          </section>
        )}

        {/* Program catalog */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
            {activeProgram ? 'Start a New Program' : 'Choose a Program'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {presets.map((def) => (
              <ProgramCard
                key={def.id}
                definition={def}
                isActive={activeProgram?.programId === def.id}
                onSelect={() => {
                  if (activeProgram) onSelectProgram(activeProgram.id);
                }}
              />
            ))}
            <ProgramCard
              definition={COMING_SOON_CARD}
              disabled
              disabledLabel="Coming Soon"
              onSelect={() => {}}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
