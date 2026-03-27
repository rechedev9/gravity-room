import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { extractGenericChartData, calculateStats } from '@gzclp/shared/generic-stats';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { useProgram } from '@/hooks/use-program';
import { useInViewport } from '@/hooks/use-in-viewport';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
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
import { DashboardCard } from './dashboard-card';
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
  const { toast } = useToast();

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
  const [volumeSectionRef, isVolumeVisible] = useInViewport();

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive names and primary exercises from definition (memoized — stable when definition is stable)
  const names: Readonly<Record<string, string>> = useMemo(() => {
    if (!definition) return {};
    const nm: Record<string, string> = {};
    for (const [id, ex] of Object.entries(definition.exercises)) {
      nm[id] = ex.name;
    }
    return nm;
  }, [definition]);

  const primaryExercises: readonly string[] = useMemo(() => {
    if (!definition) return [];
    const ids = new Set<string>();
    for (const day of definition.days) {
      for (const slot of day.slots) {
        if (slot.tier === 't1') ids.add(slot.exerciseId);
      }
    }
    return [...ids];
  }, [definition]);

  const profileData = useMemo(() => {
    if (!config || !definition) return null;
    return computeProfileData(rows, definition, config, resultTimestamps);
  }, [rows, definition, config, resultTimestamps]);

  const chartData = useMemo(() => {
    if (!definition || rows.length === 0) return null;
    return extractGenericChartData(definition, rows);
  }, [definition, rows]);

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
      enabled: user !== null && isVolumeVisible,
    })),
  });

  // Memoize lifetime volume — O(P×W×S) computation across all programs.
  // TanStack Query guarantees stable .data references when data hasn't changed,
  // so individual query data objects are safe useMemo deps.
  const allCatalogLoaded = catalogDetailQueries.every((q) => q.isSuccess);
  const allDetailLoaded = programDetailQueries.every((q) => q.isSuccess);
  const catalogDataRefs = catalogDetailQueries.map((q) => q.data);
  const programDataRefs = programDetailQueries.map((q) => q.data);

  const lifetimeVolume: number | null = useMemo(() => {
    if (!allCatalogLoaded || !allDetailLoaded) return null;

    const catalogMap = new Map(
      catalogDataRefs.filter((d): d is ProgramDefinition => d !== undefined).map((d) => [d.id, d])
    );

    let total = 0;
    for (let i = 0; i < allPrograms.length; i++) {
      const detail = programDataRefs[i];
      const def = catalogMap.get(allPrograms[i].programId);
      if (!detail || !def) continue;
      const programRows = computeGenericProgram(def, detail.config, detail.results);
      const vol = computeVolume(programRows);
      total += vol.totalVolume;
    }
    return total;
  }, [allCatalogLoaded, allDetailLoaded, allPrograms, ...catalogDataRefs, ...programDataRefs]);

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
      toast({ message: 'Error al subir la foto de perfil' });
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
      toast({ message: 'Error al eliminar la foto de perfil' });
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
      toast({ message: 'Error al eliminar la cuenta' });
      setDeleteLoading(false);
    }
  };

  const displayName = user?.name ?? user?.email ?? 'Local Lifter';
  const initial = (user?.email?.[0] ?? 'U').toUpperCase();

  // Determine active program name for banner
  const activeProgram = allPrograms.find((p) => p.id === effectiveInstanceId);
  const activeProgramName = activeProgram?.name ?? definition?.name;
  const isActive = activeProgram?.status === 'active';

  return (
    <div className="min-h-dvh bg-body">
      <AppHeader backLabel="Dashboard" onBack={onBack} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page title */}
        <h1
          className="font-display text-4xl sm:text-5xl text-title leading-none mb-6"
          style={{ textShadow: '0 0 30px rgba(240, 192, 64, 0.12)' }}
        >
          Perfil
        </h1>

        {/* ── Program Banner ── */}
        {profileData && activeProgramName && (
          <div className="bg-card border border-rule shadow-card mb-6 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent) 0%, transparent 60%)',
              }}
            />
            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 sm:py-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-1">
                  {isActive && (
                    <span className="shrink-0 font-mono text-2xs tracking-widest uppercase px-2 py-0.5 bg-ok-bg border border-ok-ring text-ok">
                      Activo
                    </span>
                  )}
                  {!isActive && activeProgram && (
                    <span
                      className="shrink-0 font-mono text-2xs tracking-widest uppercase px-2 py-0.5 text-title"
                      style={{
                        background: 'rgba(200,168,78,0.08)',
                        border: '1px solid rgba(200,168,78,0.2)',
                      }}
                    >
                      Completado
                    </span>
                  )}
                </div>
                <p className="font-display text-2xl sm:text-3xl text-title leading-none truncate">
                  {activeProgramName}
                </p>
                <p className="text-xs text-muted mt-1.5">
                  Entrenamiento {profileData.completion.workoutsCompleted} de{' '}
                  {profileData.completion.totalWorkouts}
                </p>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="text-center">
                  <p className="font-display-data text-3xl sm:text-4xl text-title leading-none tabular-nums">
                    {profileData.completion.completionPct}%
                  </p>
                  <p className="text-2xs text-muted mt-1">Completado</p>
                </div>
                <div className="text-center">
                  <p className="font-display-data text-3xl sm:text-4xl text-title leading-none tabular-nums">
                    {profileData.completion.overallSuccessRate}%
                  </p>
                  <p className="text-2xs text-muted mt-1">{'\u00C9'}xito</p>
                </div>
              </div>
            </div>
            {/* Progress bar across the bottom */}
            <div
              className="h-1 bg-progress-track"
              role="progressbar"
              aria-valuenow={profileData.completion.completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${profileData.completion.workoutsCompleted} de ${profileData.completion.totalWorkouts} entrenamientos`}
            >
              <div
                className="h-full bg-accent transition-[width] duration-300 ease-out progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, profileData.completion.completionPct))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Program selector (only when multiple programs exist) */}
        {allPrograms.length > 1 && (
          <div className="mb-6">
            <select
              id="program-selector"
              value={effectiveInstanceId ?? ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedInstanceId(e.target.value || undefined)
              }
              className="w-full bg-card border border-rule text-sm text-title px-4 py-3 font-mono appearance-none cursor-pointer focus:outline-none focus:border-accent transition-colors"
              aria-label="Selector de programa"
            >
              {allPrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === 'active' ? ' (Activo)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Empty state ── */}
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
            {/* ── Dashboard Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Account card */}
              {user && (
                <DashboardCard title="Cuenta">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      disabled={avatarUploading}
                      className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-btn-active text-btn-active-text text-lg sm:text-xl font-extrabold cursor-pointer transition-opacity flex items-center justify-center overflow-hidden shrink-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
                      aria-label="Cambiar avatar"
                    >
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        initial
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors pointer-events-none">
                        <span className="text-white text-2xs font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <p className="text-sm font-bold text-title truncate">{displayName}</p>
                      <p className="text-xs text-muted truncate">{user.email}</p>
                      {user.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveAvatar()}
                          disabled={avatarUploading}
                          className="text-2xs text-muted underline mt-1 cursor-pointer hover:text-main transition-colors disabled:opacity-50"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Delete account link inside account card */}
                  <div className="mt-3 pt-3 border-t border-rule">
                    <button
                      type="button"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-2xs text-muted underline cursor-pointer hover:text-fail transition-colors"
                    >
                      Eliminar cuenta
                    </button>
                  </div>
                </DashboardCard>
              )}

              {/* Quick Stats card */}
              <DashboardCard title="Estad{'\u00ED'}sticas">
                <div className="grid grid-cols-2 gap-x-4">
                  <ProfileStatCard
                    compact
                    value={String(profileData.completion.workoutsCompleted)}
                    label="Entrenamientos"
                    sublabel={`de ${profileData.completion.totalWorkouts}`}
                  />
                  <ProfileStatCard
                    compact
                    value={`${profileData.completion.overallSuccessRate}%`}
                    label="Tasa de {'\u00C9'}xito"
                  />
                  <ProfileStatCard
                    compact
                    value={`${formatVolume(profileData.volume.totalVolume)} kg`}
                    label="Volumen Total"
                    sublabel={`${profileData.volume.totalSets} series / ${profileData.volume.totalReps} reps`}
                  />
                  <ProfileStatCard
                    compact
                    value={`${profileData.completion.completionPct}%`}
                    label="Completado"
                    progress={{
                      value: profileData.completion.completionPct,
                      label: `${profileData.completion.workoutsCompleted} de ${profileData.completion.totalWorkouts} entrenamientos`,
                    }}
                  />
                </div>
              </DashboardCard>

              {/* Streak card */}
              {(profileData.streak.current > 0 || profileData.streak.longest > 0) && (
                <DashboardCard title="Racha">
                  <div className="grid grid-cols-2 gap-x-4">
                    <ProfileStatCard
                      compact
                      value={String(profileData.streak.current)}
                      label="Racha Actual"
                      sublabel="consecutivos"
                    />
                    <ProfileStatCard
                      compact
                      value={String(profileData.streak.longest)}
                      label="R{'\u00E9'}cord"
                      sublabel="consecutivos"
                    />
                  </div>
                </DashboardCard>
              )}

              {/* Monthly Summary card */}
              {profileData.monthlyReport && (
                <DashboardCard title={profileData.monthlyReport.monthLabel}>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ProfileStatCard
                      compact
                      value={String(profileData.monthlyReport.workoutsCompleted)}
                      label="Entrenamientos"
                      sublabel="este mes"
                    />
                    <ProfileStatCard
                      compact
                      value={`${profileData.monthlyReport.successRate}%`}
                      label="Tasa de {'\u00C9'}xito"
                    />
                    <ProfileStatCard
                      compact
                      value={String(profileData.monthlyReport.personalRecords)}
                      label="Nuevos PRs"
                      accent={profileData.monthlyReport.personalRecords > 0}
                    />
                    <ProfileStatCard
                      compact
                      value={`${formatVolume(profileData.monthlyReport.totalVolume)} kg`}
                      label="Volumen"
                      sublabel={`${profileData.monthlyReport.totalSets} series / ${profileData.monthlyReport.totalReps} reps`}
                    />
                  </div>
                </DashboardCard>
              )}

              {/* Personal Records card */}
              <DashboardCard
                title="R{'\u00E9'}cords Personales (T1)"
                className="sm:col-span-2 lg:col-span-1"
              >
                <div className="grid grid-cols-2 gap-x-4">
                  {profileData.personalRecords.map((pr) => {
                    const delta = pr.weight - pr.startWeight;
                    return (
                      <ProfileStatCard
                        key={pr.exercise}
                        compact
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
              </DashboardCard>

              {/* 1RM Estimates card */}
              {profileData.oneRMEstimates.length > 0 && (
                <DashboardCard title="1RM Estimado (Epley)">
                  <div className="grid grid-cols-2 gap-x-4">
                    {profileData.oneRMEstimates.map((e) => (
                      <ProfileStatCard
                        key={e.exercise}
                        compact
                        value={`${e.estimatedKg} kg`}
                        label={e.displayName}
                        sublabel={`${e.sourceWeight} kg \u00D7 ${e.sourceAmrapReps} reps`}
                      />
                    ))}
                  </div>
                  <p className="text-2xs text-muted mt-2 text-center opacity-70">
                    Estimaci{'\u00F3'}n basada en la f{'\u00F3'}rmula de Epley
                  </p>
                </DashboardCard>
              )}

              {/* Lifetime volume card (all programs) */}
              {allPrograms.length > 1 && (
                <div ref={volumeSectionRef} data-testid="lifetime-volume">
                  <DashboardCard title="Volumen Total Global">
                    <ProfileStatCard
                      compact
                      value={lifetimeVolume !== null ? `${formatVolume(lifetimeVolume)} kg` : '...'}
                      label="Todos los Programas"
                      sublabel={`${allPrograms.length} programas`}
                    />
                  </DashboardCard>
                </div>
              )}
            </div>

            {/* ── Full-width sections ── */}

            {/* Weight Progression Charts */}
            {chartData && (
              <div className="mt-6">
                <DashboardCard title="Progresi{'\u00F3'}n de Peso">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {primaryExercises.map((ex) => {
                      const data = chartData[ex];
                      if (!data) return null;
                      const stats = calculateStats(data);
                      const hasMark = stats.total > 0;
                      return (
                        <div key={ex} className="border border-rule p-3">
                          <h3 className="text-sm font-bold text-title mb-1">{names[ex] ?? ex}</h3>
                          {hasMark && (
                            <p className="text-xs text-muted mb-3">
                              {stats.currentWeight} kg
                              {stats.gained > 0 && (
                                <span className="text-ok"> | +{stats.gained} kg</span>
                              )}{' '}
                              | {stats.rate}% {'\u00E9'}xito
                            </p>
                          )}
                          <LineChart data={data} label={names[ex] ?? ex} />
                        </div>
                      );
                    })}
                  </div>
                </DashboardCard>
              </div>
            )}
          </>
        )}

        {/* Training history */}
        {completedPrograms.length > 0 && (
          <div className="mt-6">
            <DashboardCard title="Historial">
              <div className="flex flex-col gap-2">
                {completedPrograms.map((p) => (
                  <div
                    key={p.id}
                    className="border border-rule px-4 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-title truncate">{p.name}</p>
                      <p className="text-xs text-muted mt-0.5">
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedInstanceId(p.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          Ver estad{'\u00ED'}sticas
                        </Button>
                      )}
                      <span
                        className="shrink-0 font-mono text-2xs tracking-widest uppercase px-2 py-1 text-title"
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
            </DashboardCard>
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
