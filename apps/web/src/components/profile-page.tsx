import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { extractGenericChartData, calculateStats } from '@gzclp/shared/generic-stats';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import { useProgram } from '@/hooks/use-program';
import { useAuth } from '@/contexts/auth-context';
import { computeProfileData, computeVolume, formatVolume } from '@/lib/profile-stats';
import {
  fetchPrograms,
  fetchGenericProgramDetail,
  fetchCatalogDetail,
  updateProfile,
  type ProgramSummary,
} from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { resizeImageToDataUrl } from '@/lib/resize-image';
import { Button } from './button';
import { ProfileStatCard } from './profile-stat-card';
import { LineChart } from './line-chart';
import { AppHeader } from './app-header';
import { DeleteAccountDialog } from './delete-account-dialog';

interface ProfilePageProps {
  readonly programId?: string;
  readonly instanceId?: string;
  readonly onBack: () => void;
}

export function ProfilePage({ programId, instanceId, onBack }: ProfilePageProps): React.ReactNode {
  const { user, updateUser, deleteAccount } = useAuth();

  // Fetch all program instances (shared cache with useProgram — zero extra requests)
  const { data: allPrograms = [] } = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null,
  });

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | undefined>(undefined);

  const completedPrograms: readonly ProgramSummary[] = allPrograms
    .filter((p) => p.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // When navigating to profile without a specific selection (e.g. after finishing),
  // auto-show the most recently active or completed program.
  // The user-selected value (from the <select> or "Ver estadísticas") takes priority.
  const effectiveInstanceId: string | undefined = (() => {
    if (selectedInstanceId) return selectedInstanceId;
    if (instanceId) return instanceId;
    const active = allPrograms.find((p) => p.status === 'active');
    if (active) return active.id;
    return completedPrograms[0]?.id;
  })();

  const effectiveProgramId: string = (() => {
    // If user selected a program via dropdown/button, look up its programId
    if (selectedInstanceId) {
      const selected = allPrograms.find((p) => p.id === selectedInstanceId);
      if (selected) return selected.programId;
    }
    if (instanceId && programId) return programId;
    if (instanceId) return programId ?? 'gzclp';
    const active = allPrograms.find((p) => p.status === 'active');
    if (active) return active.programId;
    return completedPrograms[0]?.programId ?? 'gzclp';
  })();

  const { definition, config, rows, resultTimestamps } = useProgram(
    effectiveProgramId,
    effectiveInstanceId
  );
  const navigate = useNavigate();

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive names and primary exercises from definition
  const names: Readonly<Record<string, string>> = (() => {
    if (!definition) return {};
    const nm: Record<string, string> = {};
    for (const [id, ex] of Object.entries(definition.exercises)) {
      nm[id] = ex.name;
    }
    return nm;
  })();

  const primaryExercises: readonly string[] = (() => {
    if (!definition) return [];
    const ids = new Set<string>();
    for (const day of definition.days) {
      for (const slot of day.slots) {
        if (slot.tier === 't1') ids.add(slot.exerciseId);
      }
    }
    return [...ids];
  })();

  const profileData = (() => {
    if (!config || !definition) return null;
    return computeProfileData(rows, definition, config, resultTimestamps);
  })();

  const chartData = (() => {
    if (!definition || rows.length === 0) return null;
    return extractGenericChartData(definition, rows);
  })();

  // Lifetime volume: fetch details for all programs and sum volumes
  const uniqueProgramIds = [...new Set(allPrograms.map((p) => p.programId))];

  const catalogDetailQueries = useQueries({
    queries: uniqueProgramIds.map((progId) => ({
      queryKey: queryKeys.catalog.detail(progId),
      queryFn: () => fetchCatalogDetail(progId),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const programDetailQueries = useQueries({
    queries: allPrograms.map((p) => ({
      queryKey: queryKeys.programs.detail(p.id),
      queryFn: () => fetchGenericProgramDetail(p.id),
      staleTime: 5 * 60 * 1000,
      enabled: user !== null,
    })),
  });

  const lifetimeVolume: number | null = (() => {
    const allCatalogLoaded = catalogDetailQueries.every((q) => q.isSuccess);
    const allDetailLoaded = programDetailQueries.every((q) => q.isSuccess);
    if (!allCatalogLoaded || !allDetailLoaded) return null;

    const catalogMap = new Map(
      catalogDetailQueries
        .filter((q) => q.data !== undefined)
        .map((q) => {
          const d = q.data;
          return [d.id, d];
        })
    );

    let total = 0;
    for (let i = 0; i < allPrograms.length; i++) {
      const detail = programDetailQueries[i]?.data;
      const def = catalogMap.get(allPrograms[i].programId);
      if (!detail || !def) continue;
      const programRows = computeGenericProgram(def, detail.config, detail.results);
      const vol = computeVolume(programRows);
      total += vol.totalVolume;
    }
    return total;
  })();

  const handleAvatarClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    e.target.value = '';

    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      await updateProfile({ avatarUrl: dataUrl });
      updateUser({ avatarUrl: dataUrl });
    } catch (err: unknown) {
      console.error('[profile] Avatar upload failed:', err instanceof Error ? err.message : err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async (): Promise<void> => {
    setAvatarUploading(true);
    try {
      await updateProfile({ avatarUrl: null });
      updateUser({ avatarUrl: undefined });
    } catch (err: unknown) {
      console.error('[profile] Avatar removal failed:', err instanceof Error ? err.message : err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAccount = async (): Promise<void> => {
    setDeleteLoading(true);
    try {
      await deleteAccount();
      navigate('/');
    } catch (err: unknown) {
      console.error('[profile] Account deletion failed:', err instanceof Error ? err.message : err);
      setDeleteLoading(false);
    }
  };

  const displayName = user?.name ?? user?.email ?? 'Local Lifter';
  const initial = (user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <div className="min-h-dvh bg-body">
      <AppHeader backLabel="Dashboard" onBack={onBack} />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* Page title */}
        <section className="mb-12">
          <h1
            className="font-display text-4xl sm:text-5xl text-heading leading-none"
            style={{ textShadow: '0 0 30px rgba(240, 192, 64, 0.12)' }}
          >
            Perfil
          </h1>
        </section>

        {/* Program selector (only when multiple programs exist) */}
        {allPrograms.length > 1 && (
          <section className="mb-8">
            <label htmlFor="program-selector" className="section-label mb-2 block">
              Programa
            </label>
            <select
              id="program-selector"
              value={effectiveInstanceId ?? ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedInstanceId(e.target.value || undefined)
              }
              className="w-full bg-card border border-rule text-sm text-heading px-4 py-3 font-mono appearance-none cursor-pointer focus:outline-none focus:border-accent transition-colors"
            >
              {allPrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === 'active' ? ' (Activo)' : ''}
                </option>
              ))}
            </select>
          </section>
        )}

        {/* Account settings (authenticated users only) */}
        {user && (
          <section className="mb-12">
            <h2 className="section-label mb-4">Cuenta</h2>
            <div className="bg-card border border-rule p-5 sm:p-6 card">
              <div className="flex items-center gap-4 sm:gap-5">
                {/* Avatar */}
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={avatarUploading}
                  className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-btn-active text-btn-active-text text-xl sm:text-2xl font-extrabold cursor-pointer transition-opacity flex items-center justify-center overflow-hidden shrink-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
                  aria-label="Cambiar avatar"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initial
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors pointer-events-none">
                    <span className="text-white text-[10px] font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                      Cambiar
                    </span>
                  </div>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleFileChange(e)}
                />

                {/* User info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-heading truncate">{displayName}</p>
                  <p className="text-xs text-muted truncate">{user.email}</p>
                  {user.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveAvatar()}
                      disabled={avatarUploading}
                      className="text-[10px] text-muted underline mt-1 cursor-pointer hover:text-main transition-colors disabled:opacity-50"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Empty state */}
        {!profileData && (
          <div className="bg-card border border-rule p-8 sm:p-12 text-center card">
            <p
              className="font-display text-6xl sm:text-7xl text-muted leading-none mb-4"
              style={{ textShadow: '0 0 40px rgba(138, 122, 90, 0.15)' }}
            >
              SIN PROGRAMA
            </p>
            <p className="text-sm text-muted">
              Inicia un programa desde el Dashboard para ver tu perfil de entrenamiento.
            </p>
            <div className="mt-5 flex justify-center">
              <Button variant="primary" onClick={onBack}>
                Ir al Dashboard
              </Button>
            </div>
          </div>
        )}

        {profileData && (
          <>
            {/* Training stats header */}
            <section className="mb-4">
              <h2 className="section-label">Estadísticas de Entrenamiento</h2>
            </section>

            {/* Summary stats */}
            <section className="mb-12">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ProfileStatCard
                  value={String(profileData.completion.workoutsCompleted)}
                  label="Entrenamientos"
                  sublabel={`de ${profileData.completion.totalWorkouts}`}
                />
                <ProfileStatCard
                  value={`${profileData.completion.overallSuccessRate}%`}
                  label="Tasa de Éxito"
                />
                <ProfileStatCard
                  value={`${formatVolume(profileData.volume.totalVolume)} kg`}
                  label="Volumen Total"
                  sublabel={`${profileData.volume.totalSets} series / ${profileData.volume.totalReps} reps`}
                />
                <ProfileStatCard
                  value={`${profileData.completion.completionPct}%`}
                  label="Completado"
                  progress={{
                    value: profileData.completion.completionPct,
                    label: `${profileData.completion.workoutsCompleted} de ${profileData.completion.totalWorkouts} entrenamientos`,
                  }}
                />
              </div>
            </section>

            {/* Streak */}
            {(profileData.streak.current > 0 || profileData.streak.longest > 0) && (
              <section className="mb-10">
                <h2 className="section-label mb-3">Racha</h2>
                <div className="grid grid-cols-2 gap-3">
                  <ProfileStatCard
                    value={String(profileData.streak.current)}
                    label="Racha Actual"
                    sublabel="entrenamientos consecutivos"
                  />
                  <ProfileStatCard
                    value={String(profileData.streak.longest)}
                    label="Racha Más Larga"
                    sublabel="entrenamientos consecutivos"
                  />
                </div>
              </section>
            )}

            {/* Monthly Summary */}
            {profileData.monthlyReport && (
              <section className="mb-10">
                <h2 className="section-label mb-3">{profileData.monthlyReport.monthLabel}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ProfileStatCard
                    value={String(profileData.monthlyReport.workoutsCompleted)}
                    label="Entrenamientos"
                    sublabel="este mes"
                  />
                  <ProfileStatCard
                    value={`${profileData.monthlyReport.successRate}%`}
                    label="Tasa de Éxito"
                  />
                  <ProfileStatCard
                    value={String(profileData.monthlyReport.personalRecords)}
                    label="Nuevos PRs"
                    accent={profileData.monthlyReport.personalRecords > 0}
                  />
                  <ProfileStatCard
                    value={`${formatVolume(profileData.monthlyReport.totalVolume)} kg`}
                    label="Volumen"
                    sublabel={`${profileData.monthlyReport.totalSets} series / ${profileData.monthlyReport.totalReps} reps`}
                  />
                </div>
              </section>
            )}

            {/* Personal Records */}
            <section className="mb-12">
              <h2 className="section-label mb-4">Récords Personales (T1)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {profileData.personalRecords.map((pr) => {
                  const delta = pr.weight - pr.startWeight;
                  return (
                    <ProfileStatCard
                      key={pr.exercise}
                      value={`${pr.weight} kg`}
                      label={names[pr.exercise] ?? pr.exercise}
                      sublabel={
                        pr.workoutIndex >= 0
                          ? `Entrenamiento #${pr.workoutIndex + 1}`
                          : 'Peso inicial'
                      }
                      accent
                      badge={delta > 0 ? `+${delta} kg` : undefined}
                      badgeVariant="success"
                    />
                  );
                })}
              </div>
            </section>

            {/* 1RM Estimates */}
            {profileData.oneRMEstimates.length > 0 && (
              <section className="mb-12">
                <h2 className="section-label mb-4">1RM Estimado (Epley)</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {profileData.oneRMEstimates.map((e) => (
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

            {/* Lifetime volume (all programs) */}
            {allPrograms.length > 1 && (
              <section className="mb-12">
                <ProfileStatCard
                  value={lifetimeVolume !== null ? `${formatVolume(lifetimeVolume)} kg` : '...'}
                  label="Volumen Total (Todos los Programas)"
                  sublabel={`${allPrograms.length} programas`}
                />
              </section>
            )}

            {/* Weight Progression Charts */}
            {chartData && (
              <section className="mb-10">
                <h2 className="section-label mb-3">Progresión de Peso</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {primaryExercises.map((ex) => {
                    const data = chartData[ex];
                    if (!data) return null;
                    const stats = calculateStats(data);
                    const hasMark = stats.total > 0;
                    return (
                      <div key={ex} className="bg-card border border-rule p-4 card">
                        <h3 className="text-sm font-bold text-heading mb-1">{names[ex] ?? ex}</h3>
                        {hasMark && (
                          <p className="text-[11px] text-muted mb-3">
                            {stats.currentWeight} kg
                            {stats.gained > 0 && (
                              <span className="text-ok"> | +{stats.gained} kg</span>
                            )}{' '}
                            | {stats.rate}% éxito
                          </p>
                        )}
                        <LineChart data={data} label={names[ex] ?? ex} />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
        {/* Training history */}
        {completedPrograms.length > 0 && (
          <section className="mb-12">
            <h2 className="section-label mb-4">Historial</h2>
            <div className="flex flex-col gap-2">
              {completedPrograms.map((p) => (
                <div
                  key={p.id}
                  className="bg-card border border-rule px-5 py-3.5 card flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-heading truncate">{p.name}</p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Completado el{' '}
                      {new Date(p.updatedAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.id !== effectiveInstanceId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInstanceId(p.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-[10px] font-bold text-muted hover:text-heading transition-colors cursor-pointer border border-rule px-2.5 py-1.5 hover:border-rule-light"
                      >
                        Ver estad{'\u00ED'}sticas
                      </button>
                    )}
                    <span
                      className="shrink-0 font-mono text-[9px] tracking-widest uppercase px-2 py-1 text-heading"
                      style={{
                        background: 'rgba(200,168,78,0.08)',
                        border: '1px solid rgba(200,168,78,0.2)',
                      }}
                    >
                      Completado
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Delete account — subtle, at the bottom */}
        {user && (
          <div className="mt-16 mb-4 flex justify-center">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-xs text-muted underline cursor-pointer hover:text-fail transition-colors"
            >
              Eliminar cuenta
            </button>
          </div>
        )}
      </div>

      {/* Delete account confirmation dialog */}
      <DeleteAccountDialog
        open={deleteDialogOpen}
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleteLoading}
      />
    </div>
  );
}
