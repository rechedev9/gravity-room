import type { CompletionStats, PersonalRecord, OneRMEstimate } from '@/lib/profile-stats';
import { formatVolume } from '@/lib/profile-stats';
import { ProfileStatCard } from './profile-stat-card';

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
  return (
    <div className="fixed inset-0 z-[100] bg-body overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
        {/* Celebration header */}
        <div className="text-center mb-12">
          <h1
            className="font-display text-5xl sm:text-7xl text-heading leading-none mb-3"
            style={{ textShadow: '0 0 40px rgba(240, 192, 64, 0.25)' }}
          >
            {'\u00A1'}COMPLETADO!
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
              label="Entrenamientos"
              sublabel={`de ${completion.totalWorkouts}`}
            />
            <ProfileStatCard value={`${formatVolume(totalVolume)} kg`} label="Volumen Total" />
            {completion.totalWeightGained > 0 ? (
              <ProfileStatCard
                value={`+${completion.totalWeightGained} kg`}
                label="Peso Ganado"
                accent
              />
            ) : (
              <ProfileStatCard value={'\u2014'} label="Peso Ganado" />
            )}
          </div>
        </section>

        {/* Personal Records */}
        {personalRecords.length > 0 && (
          <section className="mb-10">
            <h2 className="section-label mb-4">R{'\u00E9'}cords Personales</h2>
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
            <h2 className="section-label mb-4">1RM Estimado (Epley)</h2>
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
              Estimaci{'\u00F3'}n basada en la f{'\u00F3'}rmula de Epley
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
            Ver Perfil de Entrenamiento
          </button>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-8 py-3 text-sm font-bold border-2 border-btn-ring bg-transparent text-heading cursor-pointer transition-all hover:bg-btn-active active:scale-95"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
