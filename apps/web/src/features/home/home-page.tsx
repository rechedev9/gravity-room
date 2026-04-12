import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms, fetchInsights } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { isFrequencyPayload } from '@/lib/insight-payloads';
import type { FrequencyPayload } from '@/lib/insight-payloads';
import { GuestBanner } from '@/components/guest-banner';
import { ActiveProgramCard } from '@/features/dashboard/active-program-card';
import { StaggerContainer, StaggerItem, fadeUpFastVariants } from '@/lib/motion-primitives';
import { HomeHeader } from './home-header';
import { HomeKpiStrip } from './home-kpi-strip';
import { HomeEmptyState } from './home-empty-state';

const HOME_INSIGHT_TYPES = ['frequency', 'volume_trend'] as const;

function daysSinceLastWorkout(workoutDates: readonly string[] | undefined): number | null {
  if (!workoutDates || workoutDates.length === 0) return null;
  let latest = workoutDates[0];
  for (let i = 1; i < workoutDates.length; i++) {
    if (workoutDates[i] > latest) latest = workoutDates[i];
  }
  const diff = Date.now() - new Date(latest).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function HomePage(): React.ReactNode {
  const { user } = useAuth();
  const { isGuest } = useGuest();

  useDocumentTitle('Inicio — Gravity Room');

  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });

  const insightsQuery = useQuery({
    queryKey: queryKeys.insights.list([...HOME_INSIGHT_TYPES]),
    queryFn: () => fetchInsights([...HOME_INSIGHT_TYPES]),
    enabled: user !== null && !isGuest,
    staleTime: 10 * 60 * 1000,
  });

  const activeProgram = programsQuery.data?.find((p) => p.status === 'active') ?? null;
  const userName = user?.email?.split('@')[0] ?? null;

  const freqPayload = useMemo((): FrequencyPayload | null => {
    const item = insightsQuery.data?.find((i) => i.insightType === 'frequency');
    if (!item || !isFrequencyPayload(item.payload)) return null;
    return item.payload;
  }, [insightsQuery.data]);

  const daysSinceLast = useMemo(
    () => daysSinceLastWorkout(freqPayload?.workoutDates),
    [freqPayload]
  );

  const showKpi = !isGuest && (activeProgram !== null || insightsQuery.isLoading);

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {isGuest && <GuestBanner className="mb-6" />}

        <StaggerContainer className="flex flex-col gap-6" stagger={0.06}>
          <StaggerItem variants={fadeUpFastVariants}>
            <HomeHeader
              userName={userName}
              streakDays={freqPayload?.currentStreak ?? null}
              daysSinceLast={daysSinceLast}
            />
          </StaggerItem>

          {showKpi && (
            <StaggerItem variants={fadeUpFastVariants}>
              <HomeKpiStrip freqPayload={freqPayload} isLoading={insightsQuery.isLoading} />
            </StaggerItem>
          )}

          <StaggerItem variants={fadeUpFastVariants}>
            {isGuest ? (
              <HomeEmptyState variant="guest" />
            ) : activeProgram ? (
              <ActiveProgramCard program={activeProgram} />
            ) : programsQuery.isLoading ? (
              <div className="bg-card border border-rule p-6 animate-pulse">
                <div className="h-5 w-48 bg-rule rounded mb-3" />
                <div className="h-2 bg-progress-track rounded mb-4" />
                <div className="h-10 w-48 bg-rule rounded" />
              </div>
            ) : (
              <HomeEmptyState variant="no-program" />
            )}
          </StaggerItem>

          {!isGuest && (
            <StaggerItem variants={fadeUpFastVariants}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <Link
                  to="/app/profile"
                  className="text-xs text-muted hover:text-main transition-colors inline-flex items-center gap-1"
                >
                  Ver estadisticas en Perfil
                  <span aria-hidden="true">&rarr;</span>
                </Link>
                <Link
                  to="/app/profile"
                  className="text-xs text-muted hover:text-main transition-colors inline-flex items-center gap-1"
                >
                  Cambia el idioma en Perfil
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </StaggerItem>
          )}
        </StaggerContainer>
      </div>
    </div>
  );
}
