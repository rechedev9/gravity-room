'use client';

import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { getAllPresetPrograms, getProgramDefinition } from '@/lib/programs/registry';
import { ProgramCard } from './program-card';
import { UserMenu } from './user-menu';
import type { ProgramDefinition, ProgramInstanceMap } from '@/types/program';

interface DashboardProps {
  readonly instanceMap: ProgramInstanceMap | null;
  readonly onSelectProgram: (programId: string) => void;
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

export function Dashboard({
  instanceMap,
  onSelectProgram,
  onContinueProgram,
  onGoToProfile,
}: DashboardProps): React.ReactNode {
  const { user, configured, signOut } = useAuth();
  const presets = getAllPresetPrograms();

  // Active instance info
  const activeInstanceId = instanceMap?.activeProgramId ?? null;
  const activeInstance = activeInstanceId
    ? (instanceMap?.instances[activeInstanceId] ?? null)
    : null;
  const activeDefinition = activeInstance
    ? getProgramDefinition(activeInstance.programId)
    : undefined;

  const completedWorkouts = activeInstance ? Object.keys(activeInstance.results).length : 0;
  const totalWorkouts = activeDefinition?.totalWorkouts ?? 0;
  const progressPct = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

  return (
    <div className="min-h-dvh bg-[var(--bg-body)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-4 bg-[var(--bg-header)] border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.webp"
            alt="Logo"
            width={32}
            height={32}
            className="rounded-full"
            priority
          />
          <span className="text-sm font-bold tracking-tight text-[var(--text-header)]">
            The Real Hyperbolic Time Chamber
          </span>
        </div>
        {configured && (
          <UserMenu
            user={user}
            syncStatus="idle"
            onSignOut={() => void signOut()}
            onGoToProfile={onGoToProfile}
          />
        )}
      </header>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* Active program card */}
        {activeInstance && activeDefinition && (
          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
              Your Program
            </h2>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-5 sm:p-6 hover:border-[var(--border-light)] transition-colors">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--text-header)] leading-tight">
                    {activeDefinition.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {activeDefinition.description.split('.')[0]}.
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3 mb-4">
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
                  onClick={onContinueProgram}
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
          </section>
        )}

        {/* Program catalog */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
            {activeInstance ? 'Start a New Program' : 'Choose a Program'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {presets.map((def) => (
              <ProgramCard key={def.id} definition={def} onSelect={() => onSelectProgram(def.id)} />
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
