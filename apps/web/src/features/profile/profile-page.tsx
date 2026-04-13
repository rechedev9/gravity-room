import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useUnitPreference } from '@/hooks/use-unit-preference';
import { extractGenericChartData } from '@gzclp/shared/generic-stats';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { useProgram } from '@/hooks/use-program';
import { useInViewport } from '@/hooks/use-in-viewport';
import { useAuth } from '@/contexts/auth-context';
import type { UserInfo } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { computeProfileData, computeVolume } from '@/lib/profile-stats';
import {
  fetchPrograms,
  fetchGenericProgramDetail,
  fetchCatalogDetail,
  fetchInsights,
  updateProfile,
  type ProgramSummary,
} from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { resizeImageToDataUrl } from '@/lib/resize-image';
import { captureError } from '@/lib/sentry';
import { Button } from '@/components/button';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { ProfileBanner } from './profile-banner';
import { ProfileAccountCard } from './profile-account-card';
import { ProfileBadges } from './profile-badges';
import { ProfileStatsGrid } from './profile-stats-grid';
import { ProfileChartsSection } from './profile-charts-section';
import { ProfileHistory } from './profile-history';
import { ProfileInsightsSection } from './profile-insights-section';

const PROFILE_INSIGHT_TYPES = [
  'volume_trend',
  'frequency',
  'plateau_detection',
  'load_recommendation',
] as const;

interface ProfilePageProps {
  readonly programId?: string;
  readonly instanceId?: string;
  readonly onBack?: () => void;
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

export function ProfilePage({ programId, instanceId, onBack }: ProfilePageProps): React.ReactNode {
  const { t } = useTranslation();
  const { user, updateUser, deleteAccount } = useAuth();

  useDocumentTitle(t('profile.page.title'));
  const { toast } = useToast();
  const { unit, toggleUnit, toDisplay } = useUnitPreference();

  const { data: allPrograms = [] } = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null,
  });

  const insightsQuery = useQuery({
    queryKey: queryKeys.insights.list([...PROFILE_INSIGHT_TYPES]),
    queryFn: () => fetchInsights([...PROFILE_INSIGHT_TYPES]),
    enabled: user !== null,
    staleTime: 10 * 60 * 1000,
  });

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | undefined>(undefined);

  const completedPrograms: readonly ProgramSummary[] = allPrograms
    .filter((p) => p.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const effectiveInstanceId: string | undefined = (() => {
    if (selectedInstanceId) return selectedInstanceId;
    if (instanceId) return instanceId;
    const active = allPrograms.find((p) => p.status === 'active');
    if (active) return active.id;
    return completedPrograms[0]?.id;
  })();

  const effectiveProgramId: string = (() => {
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
    return extractGenericChartData(definition, rows);
  }, [definition, rows]);

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

  const allCatalogLoaded = catalogDetailQueries.every((q) => q.isSuccess);
  const allDetailLoaded = programDetailQueries.every((q) => q.isSuccess);
  const catalogDataRefs = catalogDetailQueries.map((q) => q.data);
  const programDataRefs = programDetailQueries.map((q) => q.data);

  // O(P×W×S) computation across all programs. TanStack Query guarantees stable
  // .data references when data hasn't changed, so spreading them as deps is safe.
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

  const handleBack = onBack ?? ((): void => void navigate({ to: '/app' }));

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1
            className="font-display text-4xl sm:text-5xl text-title leading-none"
            style={{ textShadow: '0 0 30px rgba(240, 192, 64, 0.12)' }}
          >
            {t('profile.page.heading')}
          </h1>
          {user && <p className="text-sm text-muted mt-1">{displayName}</p>}
        </div>

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
          <div className="bg-card border border-rule p-8 sm:p-12 text-center card">
            <img
              src="/empty-profile.webp"
              alt=""
              className="w-full max-w-xs mx-auto mb-6 opacity-80"
              loading="lazy"
            />
            <p
              className="font-display text-6xl sm:text-7xl text-muted leading-none mb-4"
              style={{ textShadow: '0 0 40px rgba(138, 122, 90, 0.15)' }}
            >
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

            {chartData && primaryExercises.length > 0 && (
              <ProfileChartsSection
                chartData={chartData}
                primaryExercises={primaryExercises}
                names={names}
                toDisplay={toDisplay}
                unitLabel={unit}
              />
            )}

            <ProfileInsightsSection
              insights={insightsQuery.data ?? []}
              isLoading={insightsQuery.isLoading}
            />
          </>
        )}

        <ProfileHistory
          completedPrograms={completedPrograms}
          effectiveInstanceId={effectiveInstanceId}
          onSelectInstance={setSelectedInstanceId}
        />

        {user && (
          <div className="mt-10">
            <h2 className="section-label mb-4">{t('profile.account.section_title')}</h2>
            <ProfileAccountCard
              user={user}
              displayName={displayName}
              userInitials={userInitials}
              avatarUploading={avatarUploading}
              fileInputRef={fileInputRef}
              unit={unit}
              onAvatarClick={handleAvatarClick}
              onFileChange={(e) => void handleFileChange(e)}
              onRemoveAvatar={() => void handleRemoveAvatar()}
              onDeleteRequest={() => setDeleteDialogOpen(true)}
              onUpdateName={handleUpdateName}
              onToggleUnit={toggleUnit}
            />
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
