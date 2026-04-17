import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedProgramDescription, localizedProgramName } from '@/lib/catalog-display';
import { useProgramHead } from '@/hooks/use-head';
import { trackEvent } from '@/lib/analytics';
import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useProgramPreview } from '@/hooks/use-program-preview';
import { useAuth } from '@/contexts/auth-context';
import { fetchPrograms } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { buildProgramSummary } from '@/lib/program-summary';
import { getViewPreference, saveViewPreference } from '@/lib/view-preference';
import type { ViewMode } from '@/lib/view-preference';
import { ProgramOverview } from '@/features/program-view/program-overview';
import { DayNavigator } from '@/features/program-view/day-navigator';
import { DayView } from '@/features/program-view/day-view';
import { DetailedDayView } from '@/features/program-view/detailed-day-view';
import { ToastContainer } from '@/components/toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENT_DAY_INDEX = 0;
const STALE_TIME_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PreviewSkeleton(): ReactNode {
  return (
    <div className="animate-pulse space-y-4 px-4 sm:px-6 py-6 max-w-2xl mx-auto">
      <div className="h-8 bg-rule rounded-sm w-1/3" />
      <div className="h-5 bg-rule rounded-sm w-2/3" />
      <div className="space-y-3 mt-6">
        <div className="h-24 bg-rule rounded-sm" />
        <div className="h-24 bg-rule rounded-sm" />
        <div className="h-24 bg-rule rounded-sm" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function PreviewError({ onRetry }: { readonly onRetry: () => void }): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="text-center py-16 px-4">
      <p className="text-muted mb-2 text-sm">{t('catalog.program_preview.error_not_found')}</p>
      <p className="text-muted mb-6 text-xs">{t('catalog.program_preview.error_details')}</p>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2 bg-accent text-white font-bold cursor-pointer text-sm"
        >
          {t('common.retry')}
        </button>
        <Link to="/" className="text-xs text-muted hover:text-main transition-colors">
          {t('catalog.program_preview.back_label')}
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth-aware CTA components
// ---------------------------------------------------------------------------

function PreviewCtaUnauthenticated(): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="bg-card border border-rule p-5 sm:p-6 mt-6 text-center">
      <p className="text-xs text-muted mb-3">{t('catalog.program_preview.cta_signup_prompt')}</p>
      <Link
        to="/login"
        className="inline-block px-6 py-2.5 text-xs font-bold border-2 border-btn-ring bg-btn text-btn-text hover:bg-btn-active hover:text-btn-active-text transition-all"
      >
        {t('auth.create_account')}
      </Link>
    </div>
  );
}

function PreviewCtaStartProgram({ programId }: { readonly programId: string }): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="bg-card border border-rule p-5 sm:p-6 mt-6 text-center">
      <Link
        to="/app/tracker/$programId"
        params={{ programId }}
        className="inline-block px-6 py-2.5 text-xs font-bold border-2 border-btn-ring bg-btn-active text-btn-active-text hover:opacity-90 transition-all"
      >
        {t('programs.card.start_program')}
      </Link>
    </div>
  );
}

function PreviewCtaActiveWarning(): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="bg-card border border-amber-500/30 p-5 sm:p-6 mt-6 text-center" role="alert">
      <p className="text-xs text-amber-400">{t('catalog.program_preview.cta_active_warning')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header CTA (adapts to auth state)
// ---------------------------------------------------------------------------

interface HeaderCtaProps {
  readonly user: { readonly id: string } | null;
  readonly hasActiveProgram: boolean;
  readonly programsQueryFailed: boolean;
  readonly programId: string;
}

function HeaderCta({
  user,
  hasActiveProgram,
  programsQueryFailed,
  programId,
}: HeaderCtaProps): ReactNode {
  const { t } = useTranslation();
  const linkClasses =
    'font-mono text-xs font-bold tracking-widest uppercase text-btn-text border border-btn-ring px-4 py-2 hover:bg-btn-active hover:text-btn-active-text transition-all duration-200';

  if (user === null || programsQueryFailed) {
    return (
      <Link to="/login" className={linkClasses}>
        {t('auth.create_account')}
      </Link>
    );
  }

  if (hasActiveProgram) {
    return (
      <Link to="/app" className={linkClasses}>
        {t('catalog.program_preview.cta_view_dashboard')}
      </Link>
    );
  }

  return (
    <Link to="/app/tracker/$programId" params={{ programId }} className={linkClasses}>
      {t('programs.card.start_program')}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProgramPreviewPage(): ReactNode {
  const { t } = useTranslation();
  const { programId } = useParams({ from: '/programs/$programId' });

  const { definition, rows, isLoading, isError } = useProgramPreview(programId);
  const { user, loading: authLoading } = useAuth();

  // Conditionally fetch programs to check for active program (only when authenticated)
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    staleTime: STALE_TIME_MS,
    enabled: user !== null,
  });

  const hasActiveProgram = programsQuery.data?.some((p) => p.status === 'active') ?? false;
  const programsQueryFailed = programsQuery.isError;

  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => getViewPreference());

  const headName = definition ? localizedProgramName(t, definition.id, definition.name) : undefined;
  const headDescription = definition
    ? localizedProgramDescription(t, definition.id, definition.description)
    : undefined;
  useProgramHead(programId, headName, headDescription);

  const previewTracked = useRef(false);
  useEffect(() => {
    if (definition !== undefined && !previewTracked.current) {
      previewTracked.current = true;
      trackEvent('program_preview_view', { program_id: programId });
    }
  }, [definition, programId]);

  // Build program summary when definition is available
  const summary = definition !== undefined ? buildProgramSummary(definition) : null;

  // ---------------------------------------------------------------------------
  // Interaction stubs — preview is read-only, interactions prompt signup/login
  // ---------------------------------------------------------------------------

  const noopHandler = (): void => {
    // No-op: preview mode interactions do nothing
  };

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const handlePrevDay = (): void => {
    setSelectedDayIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextDay = (): void => {
    setSelectedDayIndex((prev) => Math.min(rows.length - 1, prev + 1));
  };

  const handleGoToCurrent = (): void => {
    setSelectedDayIndex(CURRENT_DAY_INDEX);
  };

  // ---------------------------------------------------------------------------
  // View toggle
  // ---------------------------------------------------------------------------

  const handleToggleView = (): void => {
    const next: ViewMode = viewMode === 'detailed' ? 'compact' : 'detailed';
    setViewMode(next);
    saveViewPreference(next);
  };

  // ---------------------------------------------------------------------------
  // Retry handler for error state
  // ---------------------------------------------------------------------------

  const handleRetry = (): void => {
    window.location.reload();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="grain-overlay min-h-dvh bg-body">
        <PreviewSkeleton />
      </div>
    );
  }

  if (isError || !definition || rows.length === 0) {
    return (
      <div className="grain-overlay min-h-dvh bg-body">
        <PreviewError onRetry={handleRetry} />
      </div>
    );
  }

  const selectedWorkout = rows[selectedDayIndex];
  const totalWorkouts = definition.totalWorkouts;
  const isDayComplete = false;
  const name = localizedProgramName(t, definition.id, definition.name);
  const description = localizedProgramDescription(t, definition.id, definition.description);

  return (
    <div className="grain-overlay min-h-dvh bg-body">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-header/95 backdrop-blur-md border-b border-rule">
        <Link
          to="/"
          className="text-xs font-bold text-muted hover:text-main transition-colors"
          aria-label={t('catalog.program_preview.back_aria')}
        >
          {t('catalog.program_preview.back_label')}
        </Link>
        <span className="font-display text-sm tracking-wide text-title truncate mx-4">{name}</span>
        {!authLoading && (
          <HeaderCta
            user={user}
            hasActiveProgram={hasActiveProgram}
            programsQueryFailed={programsQueryFailed}
            programId={programId}
          />
        )}
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="sr-only">{name}</h1>

        {/* Program info — expanded by default */}
        <details open className="group bg-card border border-rule mb-4 sm:mb-8 overflow-hidden">
          <summary className="px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-xs tracking-wide">
            {t('catalog.program_preview.about', { name })}
            <span className="transition-transform duration-200 group-open:rotate-90">&#9656;</span>
          </summary>
          <div className="px-5 pb-5 border-t border-rule-light">
            <p className="mt-3 text-sm leading-7 text-info">{description}</p>
            {definition.author && (
              <p className="mt-2 text-xs text-muted">
                {t('catalog.program_preview.by_author', { author: definition.author })}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted">
              <span>{t('catalog.meta.total_workouts', { count: totalWorkouts })}</span>
              <span>{t('catalog.meta.per_week', { count: definition.workoutsPerWeek })}</span>
              <span>{t('catalog.meta.day_rotation', { count: definition.days.length })}</span>
            </div>
          </div>
        </details>

        {/* Program overview — auto-generated explanatory section */}
        {summary !== null && <ProgramOverview summary={summary} programName={name} />}

        {/* Day navigator */}
        <DayNavigator
          selectedDayIndex={selectedDayIndex}
          totalDays={totalWorkouts}
          currentDayIndex={CURRENT_DAY_INDEX}
          dayName={selectedWorkout?.dayName ?? ''}
          isDayComplete={isDayComplete}
          onPrev={handlePrevDay}
          onNext={handleNextDay}
          onGoToCurrent={handleGoToCurrent}
        />

        {/* View mode toggle */}
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={handleToggleView}
            aria-label={
              viewMode === 'detailed' ? 'Cambiar a vista compacta' : 'Cambiar a vista detallada'
            }
            className="text-2xs font-bold text-muted hover:text-main tracking-wide uppercase cursor-pointer transition-colors"
          >
            {viewMode === 'detailed' ? 'Vista compacta' : 'Vista detallada'}
          </button>
        </div>

        {/* Workout view */}
        {selectedWorkout &&
          (viewMode === 'detailed' ? (
            <DetailedDayView
              workout={selectedWorkout}
              isCurrent={true}
              onMark={noopHandler}
              onUndo={noopHandler}
              onSetAmrapReps={noopHandler}
              onSetRpe={noopHandler}
              onSetTap={noopHandler}
            />
          ) : (
            <DayView
              workout={selectedWorkout}
              isCurrent={true}
              onMark={noopHandler}
              onUndo={noopHandler}
              onSetAmrapReps={noopHandler}
              onSetRpe={noopHandler}
              onSetTap={noopHandler}
            />
          ))}

        {/* Auth-aware CTA section */}
        {!authLoading &&
          (user === null || programsQueryFailed ? (
            <PreviewCtaUnauthenticated />
          ) : hasActiveProgram ? (
            <PreviewCtaActiveWarning />
          ) : (
            <PreviewCtaStartProgram programId={programId} />
          ))}
      </div>

      <ToastContainer />
    </div>
  );
}
