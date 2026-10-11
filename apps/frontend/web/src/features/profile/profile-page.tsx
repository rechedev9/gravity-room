import { useState, useRef, useMemo, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useUnitPreference } from '@/hooks/use-unit-preference';
import { extractGenericChartData } from '@gzclp/domain/generic-stats';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { useProgram } from '@/hooks/use-program';
import { useInViewport } from '@/hooks/use-in-viewport';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useSignOut } from '@/hooks/use-sign-out';
import type { UserInfo } from '@gzclp/domain/schemas/user';
import { useToast } from '@/contexts/toast-context';
import { computeProfileData, computeVolume, lastResultWorkoutIndex } from '@/lib/profile-stats';
import {
  fetchPrograms,
  fetchGenericProgramDetail,
  fetchCatalogDetail,
  updateProfile,
  type ProgramSummary,
} from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { resizeImageToDataUrl } from '@/lib/resize-image';
import { captureError } from '@/lib/sentry';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { Button } from '@/components/button';
import { GuestBanner } from '@/components/guest-banner';
import { Kicker } from '@/components/kicker';
import { ScreenHeader } from '@/components/screen-header';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { ProfileBanner } from './profile-banner';
import { ProfileDangerZone, ProfileIdentityCard, ProfilePreferences } from './profile-account-card';
import { ProfileShortcuts } from './profile-shortcuts';
import { ProfileBadges } from './profile-badges';
import { ProfileStatsGrid } from './profile-stats-grid';
import { ProfileHistory } from './profile-history';
import { ZoneHint } from '@/features/home/zone-hint';

// Recharts lands in its own 387 kB chunk; keep it off the profile-route preload
// by loading the chart section on demand once the user has something to chart.
const ProfileChartsSection = lazyWithRetry(() =>
  import('./profile-charts-section').then((m) => ({ default: m.ProfileChartsSection }))
);

function ChartsFallback(): React.ReactNode {
  return (
    <div className="mt-6 bg-card rounded-card border border-rule p-5 animate-pulse">
      <div className="h-4 w-40 bg-rule rounded mb-4" />
      <div className="h-48 bg-rule rounded" />
    </div>
  );
}

function computeInitials(user: UserInfo): string {
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return (first + last).toUpperCase() || (user.email[0] ?? 'U').toUpperCase();
  }
  return (user.email[0] ?? 'U').toUpperCase();
}

export function ProfilePage(): React.ReactNode {
  const { t } = useTranslation();
  const { user, updateUser, deleteAccount } = useAuth();
  const { isGuest, exitGuestModeKeepingData } = useGuest();
  const { signOut, pending: signingOut, failed: signOutFailed } = useSignOut();

  useDocumentTitle(t('profile.page.title'));
  const { toast } = useToast();
  const { unit, toggleUnit, toDisplay } = useUnitPreference();

  const { data: allPrograms = [] } = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | undefined>(undefined);

  const completedPrograms: readonly ProgramSummary[] = allPrograms
    .filter((p) => p.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const effectiveInstanceId: string | undefined = useMemo(() => {
    if (selectedInstanceId) return selectedInstanceId;
    const active = allPrograms.find((p) => p.status === 'active');
    if (active) return active.id;
    return completedPrograms[0]?.id;
  }, [selectedInstanceId, allPrograms, completedPrograms]);

  const effectiveProgramId: string = useMemo(() => {
    if (selectedInstanceId) {
      const selected = allPrograms.find((p) => p.id === selectedInstanceId);
      if (selected) return selected.programId;
    }
    const active = allPrograms.find((p) => p.status === 'active');
    if (active) return active.programId;
    return completedPrograms[0]?.programId ?? 'gzclp';
  }, [selectedInstanceId, allPrograms, completedPrograms]);

  const { definition, config, rows, resultTimestamps } = useProgram(
    effectiveProgramId,
    effectiveInstanceId
  );
  const navigate = useNavigate();
  const [volumeSectionRef, isVolumeVisible] = useInViewport();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    return extractGenericChartData(definition, rows, resultTimestamps, 't1');
  }, [definition, rows, resultTimestamps]);

  const uniqueProgramIds = [...new Set(allPrograms.map((p) => p.programId))];

  // Lifetime volume is below the fold — gate the N+1 fan-out until the section
  // is near the viewport so profile mount stays cheap.
  const volumeQueriesEnabled = user !== null && isVolumeVisible;

  const catalogDetailQueries = useQueries({
    queries: uniqueProgramIds.map((progId) => ({
      queryKey: queryKeys.catalog.detail(progId),
      queryFn: () => fetchCatalogDetail(progId),
      staleTime: 5 * 60 * 1000,
      enabled: volumeQueriesEnabled,
    })),
  });

  const programDetailQueries = useQueries({
    queries: allPrograms.map((p) => ({
      queryKey: queryKeys.programs.detail(p.id),
      queryFn: () => fetchGenericProgramDetail(p.id),
      staleTime: 5 * 60 * 1000,
      enabled: volumeQueriesEnabled,
    })),
  });

  const allCatalogLoaded = catalogDetailQueries.every((q) => q.isSuccess);
  const allDetailLoaded = programDetailQueries.every((q) => q.isSuccess);
  const catalogDataRefs = catalogDetailQueries.map((q) => q.data);
  const programDataRefs = programDetailQueries.map((q) => q.data);

  // Stable dep signature derived from each query's dataUpdatedAt timestamp.
  // Lets us avoid spreading data arrays into the deps list (variable size).
  const querySignature =
    catalogDetailQueries.map((q) => q.dataUpdatedAt).join('|') +
    '#' +
    programDetailQueries.map((q) => q.dataUpdatedAt).join('|');

  // O(P×W×S) computation across all programs. The querySignature changes only
  // when any underlying query's data actually mutates.
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
      // Skip pristine instances and only materialize rows up to the last log —
      // empty future weeks contribute 0 volume and dominate CPU on long cycles.
      const lastIdx = lastResultWorkoutIndex(detail.results);
      if (lastIdx < 0) continue;
      const programRows = computeGenericProgram(def, detail.config, detail.results, {
        maxRows: lastIdx + 1,
      });
      const vol = computeVolume(programRows);
      total += vol.totalVolume;
    }
    return total;
  }, [allCatalogLoaded, allDetailLoaded, allPrograms.length, querySignature]);

  const handleAvatarClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      await updateProfile({ avatarUrl: dataUrl });
      updateUser({ avatarUrl: dataUrl });
    } catch (err: unknown) {
      captureError(err);
      toast({ message: t('profile.avatar.upload_error') });
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
      captureError(err);
      toast({ message: t('profile.avatar.remove_error') });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleUpdateName = async (name: string): Promise<void> => {
    try {
      await updateProfile({ name });
      updateUser({ name });
      toast({ message: t('profile.name.updated') });
    } catch (err: unknown) {
      captureError(err);
      toast({ message: t('profile.name.update_error') });
    }
  };

  const handleDeleteAccount = async (): Promise<void> => {
    setDeleteLoading(true);
    try {
      await deleteAccount();
      void navigate({ to: '/' });
    } catch (err: unknown) {
      captureError(err);
      toast({ message: t('profile.account_errors.delete_error') });
      setDeleteLoading(false);
    }
  };

  const displayName = user?.name ?? user?.email ?? 'Local Lifter';
  const userInitials = user ? computeInitials(user) : 'U';

  const activeProgram = allPrograms.find((p) => p.id === effectiveInstanceId);
  const activeProgramName = activeProgram?.name ?? definition?.name;
  const isActive = activeProgram?.status === 'active';

  const handleBack = (): void => void navigate({ to: '/app' });

  const handleCreateAccount = (): void => {
    // Keep the guest data - it is migrated to the account after sign-in.
    exitGuestModeKeepingData();
    void navigate({ to: '/login' });
  };

  const hasProgress = user !== null && !isGuest;

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ScreenHeader
          className="mb-6"
          eyebrow={t('profile.page.eyebrow')}
          title={t('profile.page.heading')}
        />

        <ZoneHint zone="profile" className="mb-6" />

        {isGuest && <GuestBanner className="mb-4" />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-x-6">
          {user && !isGuest && (
            <div className="lg:col-start-1 lg:row-start-1">
              <ProfileIdentityCard
                user={user}
                displayName={displayName}
                userInitials={userInitials}
                avatarUploading={avatarUploading}
                fileInputRef={fileInputRef}
                onAvatarClick={handleAvatarClick}
                onFileChange={(e) => void handleFileChange(e)}
                onRemoveAvatar={() => void handleRemoveAvatar()}
                onUpdateName={handleUpdateName}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 lg:col-start-2 lg:row-span-3 lg:row-start-1">
            <Kicker>{t('profile.more.preferences')}</Kicker>
            <ProfilePreferences unit={unit} onToggleUnit={toggleUnit} />
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            <Kicker>{t('profile.more.shortcuts')}</Kicker>
            <ProfileShortcuts isGuest={isGuest} />
          </div>

          <div className="flex flex-col gap-2 lg:col-start-1 lg:row-start-2">
            {signOutFailed && (
              <p role="alert" className="text-sm text-error">
                {t('auth.errors.sign_out_failed')}
              </p>
            )}
            {isGuest ? (
              <Button variant="primary" size="lg" onClick={handleCreateAccount}>
                {t('auth.create_account')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="lg"
                className="border-rule"
                disabled={signingOut}
                onClick={() => void signOut()}
              >
                {t('avatar_dropdown.sign_out')}
              </Button>
            )}
          </div>
        </div>

        {hasProgress && (
          <section className="mt-10">
            <Kicker className="mb-4">{t('profile.more.progress')}</Kicker>

            {profileData && activeProgramName && (
              <ProfileBanner
                profileData={profileData}
                activeProgramName={activeProgramName}
                isActive={isActive}
                activeProgram={activeProgram}
                allPrograms={allPrograms}
                effectiveInstanceId={effectiveInstanceId}
                onSelectInstance={setSelectedInstanceId}
              />
            )}

            {!profileData && (
              <div className="bg-card rounded-card border border-rule p-8 sm:p-12 text-center card">
                <img
                  src="/empty-profile.webp"
                  alt=""
                  className="w-full max-w-xs mx-auto mb-6 opacity-80"
                  loading="lazy"
                />
                <p className="type-display-sm sm:type-display text-muted mb-4">
                  {t('profile.empty.heading')}
                </p>
                <p className="text-sm text-muted">{t('profile.empty.description')}</p>
                <div className="mt-5 flex justify-center">
                  <Button variant="primary" onClick={handleBack}>
                    {t('profile.empty.cta')}
                  </Button>
                </div>
              </div>
            )}

            {profileData && (
              <>
                <ProfileBadges
                  profileData={profileData}
                  allPrograms={allPrograms}
                  lifetimeVolume={lifetimeVolume}
                />

                <div className="mt-4">
                  <ProfileStatsGrid
                    profileData={profileData}
                    names={names}
                    allPrograms={allPrograms}
                    lifetimeVolume={lifetimeVolume}
                    volumeSectionRef={volumeSectionRef}
                    toDisplay={toDisplay}
                    unitLabel={unit}
                  />
                </div>

                {chartData &&
                  profileData.completion.workoutsCompleted > 0 &&
                  primaryExercises.length > 0 && (
                    <Suspense fallback={<ChartsFallback />}>
                      <ProfileChartsSection
                        chartData={chartData}
                        primaryExercises={primaryExercises}
                        names={names}
                        toDisplay={toDisplay}
                        unitLabel={unit}
                      />
                    </Suspense>
                  )}
              </>
            )}

            <ProfileHistory
              completedPrograms={completedPrograms}
              effectiveInstanceId={effectiveInstanceId}
              onSelectInstance={setSelectedInstanceId}
            />
          </section>
        )}

        {hasProgress && (
          <div className="mt-8 border-t border-rule pt-2">
            <ProfileDangerZone onDeleteRequest={() => setDeleteDialogOpen(true)} />
          </div>
        )}
      </div>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleteLoading}
      />
    </div>
  );
}
