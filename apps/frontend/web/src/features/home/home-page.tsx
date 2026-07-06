import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
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
import { readActiveGuestInstance } from '@/lib/guest-storage';
import { Kicker } from '@/components/kicker';
import { Button } from '@/components/button';
import { DashboardShell } from '@/features/dashboard/dashboard-shell';
import { NextSetHero } from '@/features/dashboard/next-set-hero';
import type { ProgramInstance } from '@/features/dashboard/next-set-hero';
import { KpiStripBrutalist } from '@/features/dashboard/kpi-strip-brutalist';
import { WeekHeatmap } from '@/features/dashboard/week-heatmap';
import { PrRoadCard } from '@/features/dashboard/pr-road-card';
import { usePrRoad } from '@/features/dashboard/use-pr-road';
import { MentorPill } from '@/features/dashboard/mentor-pill';
import { RecentSessionsList } from '@/features/dashboard/recent-sessions-list';
import { useDashboardData } from '@/features/dashboard/use-dashboard-data';
import { HomeEmptyState } from './home-empty-state';
import { HomeGuestResume } from './home-guest-resume';
import { HomeMentorWidget } from './home-mentor-widget';
import { ZoneHint } from './zone-hint';

const HOME_INSIGHT_TYPES = ['frequency', 'volume_trend'] as const;

function getMentorTips(t: TFunction): readonly string[] {
  const tips = t('home.mentor_tips', { returnObjects: true });
  if (!Array.isArray(tips)) return [];
  return tips.filter((tip): tip is string => typeof tip === 'string');
}

function DashboardSkeleton(): React.ReactNode {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 py-6 animate-pulse">
      <div className="bg-card border border-rule rounded-[var(--radius-base)] p-8 h-48" />
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-rule rounded-[var(--radius-base)] h-24" />
        <div className="bg-card border border-rule rounded-[var(--radius-base)] h-24" />
        <div className="bg-card border border-rule rounded-[var(--radius-base)] h-24" />
      </div>
      <div className="bg-card border border-rule rounded-[var(--radius-base)] h-20" />
    </div>
  );
}

export function HomePage(): React.ReactNode {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isGuest } = useGuest();

  useDocumentTitle(t('home.page_title'));

  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
    // Returning to the dashboard after logging a session must reflect the new
    // streak/sessions, so refetch on every mount rather than serving stale cache.
    refetchOnMount: 'always',
  });

  const insightsQuery = useQuery({
    queryKey: queryKeys.insights.list([...HOME_INSIGHT_TYPES]),
    queryFn: () => fetchInsights([...HOME_INSIGHT_TYPES]),
    enabled: user !== null && !isGuest,
    staleTime: 10 * 60 * 1000,
    // Insights drive the KPI strip; refetch on mount so the dashboard isn't
    // stuck on the pre-session zero-state after the user logs a workout.
    refetchOnMount: 'always',
  });

  const activeProgram = programsQuery.data?.find((p) => p.status === 'active') ?? null;
  const mentorTips = getMentorTips(t);

  // Real training data for the active program (hero next-set, recent sessions,
  // PR road). Queries are disabled when there is no active program.
  const dashboard = useDashboardData(activeProgram);

  const freqPayload = useMemo((): FrequencyPayload | null => {
    const item = insightsQuery.data?.find((i) => i.insightType === 'frequency');
    if (!item || !isFrequencyPayload(item.payload)) return null;
    return item.payload;
  }, [insightsQuery.data]);

  // Workout dates from frequency insight → feed heatmap
  const workoutDates = freqPayload?.workoutDates ?? [];
  const heatmapWorkouts = useMemo(
    () => workoutDates.map((d) => ({ completedAt: d })),
    [workoutDates]
  );

  // KPI values from frequency insight
  const streakDays = freqPayload?.currentStreak ?? 0;
  const totalSessions = freqPayload?.totalSessions ?? 0;
  // Pristine = active program but no sessions logged yet. Show an encouraging
  // prompt instead of a strip of literal zeros (the hero already owns the gold CTA).
  const isPristine = totalSessions === 0 && streakDays === 0;

  // PR road: derived from the active program's logged sets (empty until there's
  // a lift climbing toward a new PR).
  const prRoad = usePrRoad(dashboard.liftHistory);

  // Guests persist a single in-progress program in localStorage (see
  // lib/guest-storage.ts). If one exists, offer a direct "continue" hero back
  // into the tracker instead of the generic guest empty state. Memoized:
  // localStorage + JSON.parse must not run on every render.
  const guestInstance = useMemo(() => (isGuest ? readActiveGuestInstance() : null), [isGuest]);

  if (isGuest) {
    return (
      <div className="min-h-dvh bg-body">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <GuestBanner className="mb-6" />
          {guestInstance ? (
            <HomeGuestResume programId={guestInstance.programId} programName={guestInstance.name} />
          ) : (
            <HomeEmptyState variant="guest" />
          )}
        </div>
      </div>
    );
  }

  if (programsQuery.isLoading || insightsQuery.isLoading || dashboard.isLoading) {
    return (
      <div className="min-h-dvh bg-body">
        <DashboardSkeleton />
      </div>
    );
  }

  // A failed fetch must never masquerade as an empty/day-one dashboard: for a
  // user with real history that is indistinguishable from data loss. Matches
  // the error-with-retry convention of programs-page.tsx.
  if (programsQuery.isError || dashboard.isError) {
    return (
      <div className="min-h-dvh bg-body">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="bg-card border border-rule p-6 text-center">
            <p className="text-sm text-muted mb-3">{t('home.load_error')}</p>
            <Button
              onClick={() => {
                void programsQuery.refetch();
                dashboard.refetch();
              }}
            >
              {t('programs.retry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeProgram) {
    return (
      <div className="min-h-dvh bg-body">
        <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <HomeEmptyState variant="no-program" />
        </div>
      </div>
    );
  }

  // Adapt ProgramSummary → ProgramInstance shape for NextSetHero. The hero
  // extras (nextSet / nextWorkout / lastSet / results) come from the active
  // program's logged sets; when none exist they are absent and the hero renders
  // its day-one state.
  const programInstance: ProgramInstance = {
    id: activeProgram.id,
    programId: activeProgram.programId,
    name: activeProgram.name,
    status: activeProgram.status,
    ...dashboard.hero,
  };

  return (
    <div className="min-h-dvh bg-body">
      <DashboardShell
        mentor={
          <>
            <HomeMentorWidget />
            <ZoneHint zone="home" />
          </>
        }
        hero={<NextSetHero programInstance={programInstance} />}
        kpi={
          isPristine ? (
            <section className="bg-card border border-rule rounded-[var(--radius-base)] p-6 sm:p-8">
              <Kicker noRule className="mb-3">
                {t('home.pristine.kicker')}
              </Kicker>
              <h2 className="font-display text-3xl sm:text-4xl text-main">
                {t('home.pristine.title')}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted leading-relaxed">
                {t('home.pristine.body')}
              </p>
            </section>
          ) : (
            <KpiStripBrutalist
              streakDays={streakDays}
              totalSessions={totalSessions}
              weekPr={null}
            />
          )
        }
        heatmap={<WeekHeatmap workouts={heatmapWorkouts} />}
        split={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <PrRoadCard road={prRoad} />
            <MentorPill tips={mentorTips} />
          </div>
        }
        recent={<RecentSessionsList sessions={dashboard.recentSessions} />}
      />
      {!isGuest && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-8">
          <Kicker className="mb-3">{t('home.footer.quick_links')}</Kicker>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/app/profile"
              className="group flex items-center justify-between gap-3 bg-card border border-rule rounded-[var(--radius-base)] px-4 py-3 hover:border-rule-light transition-colors"
            >
              <span className="text-sm text-main">{t('home.footer.view_stats')}</span>
              <span
                aria-hidden="true"
                className="text-muted group-hover:text-main transition-colors"
              >
                &rarr;
              </span>
            </Link>
            <Link
              to="/app/profile"
              className="group flex items-center justify-between gap-3 bg-card border border-rule rounded-[var(--radius-base)] px-4 py-3 hover:border-rule-light transition-colors"
            >
              <span className="text-sm text-main">{t('home.footer.change_language')}</span>
              <span
                aria-hidden="true"
                className="text-muted group-hover:text-main transition-colors"
              >
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
