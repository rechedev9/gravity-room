'use client';

import { useMemo } from 'react';
import { useProgram } from '@/hooks/use-program';
import { useAuth } from '@/contexts/auth-context';
import { computeProfileData, formatVolume } from '@/lib/profile-stats';
import { extractChartData, T1_EXERCISES } from '@/lib/stats';
import { NAMES } from '@/lib/program';
import { ProfileStatCard } from './profile-stat-card';
import { LineChart } from './line-chart';
import { AppHeader } from './app-header';

interface ProfilePageProps {
  readonly onBack: () => void;
}

export function ProfilePage({ onBack }: ProfilePageProps): React.ReactNode {
  const { startWeights, results } = useProgram();
  const { user } = useAuth();

  const profileData = useMemo(() => {
    if (!startWeights) return null;
    return computeProfileData(startWeights, results);
  }, [startWeights, results]);

  const chartData = useMemo(() => {
    if (!startWeights) return null;
    return extractChartData(startWeights, results);
  }, [startWeights, results]);

  const displayName = user?.email ?? 'Local Lifter';

  return (
    <div className="min-h-dvh bg-[var(--bg-body)]">
      <AppHeader backLabel="Dashboard" onBack={onBack} />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* User identity */}
        <section className="mb-10">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-header)] leading-tight">
            Training Profile
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{displayName}</p>
        </section>

        {/* Empty state */}
        {!profileData && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-8 sm:p-12 text-center">
            <p className="text-lg font-bold text-[var(--text-header)] mb-2">No program yet</p>
            <p className="text-sm text-[var(--text-muted)]">
              Start a program from the Dashboard to see your training profile.
            </p>
            <button
              onClick={onBack}
              className="mt-5 px-5 py-2.5 text-xs font-bold border-2 border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] cursor-pointer transition-all hover:opacity-90"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {profileData && (
          <>
            {/* Summary stats */}
            <section className="mb-10">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ProfileStatCard
                  value={String(profileData.completion.workoutsCompleted)}
                  label="Workouts"
                  sublabel={`of ${profileData.completion.totalWorkouts}`}
                />
                <ProfileStatCard
                  value={`${formatVolume(profileData.volume.totalVolume)} kg`}
                  label="Total Volume"
                  sublabel={`${formatVolume(profileData.volume.totalSets)} sets`}
                />
                <ProfileStatCard
                  value={`${profileData.completion.overallSuccessRate}%`}
                  label="Success Rate"
                />
                <ProfileStatCard
                  value={`${profileData.completion.completionPct}%`}
                  label="Completion"
                />
              </div>
            </section>

            {/* Personal Records */}
            <section className="mb-10">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                Personal Records (T1)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {profileData.personalRecords.map((pr) => (
                  <ProfileStatCard
                    key={pr.exercise}
                    value={`${pr.weight} kg`}
                    label={NAMES[pr.exercise] ?? pr.exercise}
                    sublabel={
                      pr.workoutIndex >= 0 ? `Workout #${pr.workoutIndex + 1}` : 'Starting weight'
                    }
                  />
                ))}
              </div>
            </section>

            {/* Streaks */}
            <section className="mb-10">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                Streaks
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <ProfileStatCard
                  value={String(profileData.streak.current)}
                  label="Current Streak"
                  sublabel="consecutive workouts"
                />
                <ProfileStatCard
                  value={String(profileData.streak.longest)}
                  label="Best Streak"
                  sublabel="consecutive workouts"
                />
              </div>
            </section>

            {/* Weight Gained */}
            {profileData.completion.totalWeightGained > 0 && (
              <section className="mb-10">
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                  Progress
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <ProfileStatCard
                    value={`+${profileData.completion.totalWeightGained} kg`}
                    label="Total Weight Gained"
                    sublabel="across all T1 lifts"
                  />
                </div>
              </section>
            )}

            {/* Weight Progression Charts */}
            {chartData && (
              <section className="mb-10">
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                  Weight Progression
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {T1_EXERCISES.map((ex) => (
                    <div
                      key={ex}
                      className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4"
                    >
                      <h3 className="text-sm font-bold text-[var(--text-header)] mb-3">
                        {NAMES[ex]}
                      </h3>
                      <LineChart data={chartData[ex]} label={NAMES[ex]} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
