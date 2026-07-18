import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  localizedProgramDescription,
  localizedProgramName,
  localizedProgramSeoTitle,
  localizedProgramSeoDescription,
  localizedProgramFaq,
} from '@/lib/catalog-display';
import { useProgramHead } from '@/hooks/use-head';
import { ProgramJsonLd } from '@/features/program-preview/program-json-ld';
import { ProgramFaq } from '@/features/program-preview/program-faq';
import { trackEvent } from '@/lib/analytics';
import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useProgramPreview } from '@/hooks/use-program-preview';
import { useAuth } from '@/contexts/auth-context';
import { fetchPrograms } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { buildProgramSummary } from '@/lib/program-summary';
import { ToastContainer } from '@/components/toast';
import { ZoneHint } from '@/features/home/zone-hint';
import {
  buildCycleGroups,
  ProgramCycle,
  ProgramEssentials,
  ProgramPreviewHero,
  SessionExample,
} from '@/features/program-preview/program-preview-showcase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
          className="px-5 py-2 bg-accent text-on-accent font-bold cursor-pointer text-sm"
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

interface HeroPrimaryActionProps {
  readonly user: { readonly id: string } | null;
  readonly hasActiveProgram: boolean;
  readonly programsQueryFailed: boolean;
  readonly programId: string;
}

function HeroPrimaryAction({
  user,
  hasActiveProgram,
  programsQueryFailed,
  programId,
}: HeroPrimaryActionProps): ReactNode {
  const { t } = useTranslation();
  const className =
    'inline-flex min-h-12 items-center justify-center bg-accent px-7 font-mono text-xs font-bold uppercase tracking-[0.18em] text-on-accent transition-colors hover:bg-btn-active';

  if (user === null || programsQueryFailed) {
    return (
      <Link to="/login" className={className}>
        {t('auth.create_account')}
        <span aria-hidden="true" className="ml-4 text-lg">
          →
        </span>
      </Link>
    );
  }

  if (hasActiveProgram) {
    return (
      <Link to="/app" className={className}>
        {t('catalog.program_preview.cta_view_dashboard')}
        <span aria-hidden="true" className="ml-4 text-lg">
          →
        </span>
      </Link>
    );
  }

  return (
    <Link to="/app/tracker/$programId" params={{ programId }} className={className}>
      {t('programs.card.start_program')}
      <span aria-hidden="true" className="ml-4 text-lg">
        →
      </span>
    </Link>
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
  const { t, i18n } = useTranslation();
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

  // Resolve head meta from translation keys as soon as the route params are known.
  // The catalog API may still be in flight (or be intercepted by prerender) — title
  // and description must land in the prerendered HTML regardless, so we don't depend
  // on `definition` for them. localizedProgramName falls back to '' when the key is
  // missing (unknown program id); useProgramHead treats undefined/empty as "skip".
  const translatedName = localizedProgramName(t, programId, '');
  const translatedDescription = localizedProgramDescription(t, programId, '');
  const headName = translatedName !== '' ? translatedName : undefined;
  const headDescription = translatedDescription !== '' ? translatedDescription : undefined;
  const seoTitle = localizedProgramSeoTitle(t, programId);
  const seoDescription = localizedProgramSeoDescription(t, programId);
  const faqItems = localizedProgramFaq(t, programId);
  useProgramHead(programId, headName, headDescription, {
    seoTitle,
    seoDescription,
    lang: i18n.language,
  });

  const previewTracked = useRef(false);
  useEffect(() => {
    if (definition !== undefined && !previewTracked.current) {
      previewTracked.current = true;
      trackEvent('program_preview_view', { program_id: programId });
    }
  }, [definition, programId]);

  // Build program summary when definition is available
  const summary = definition !== undefined ? buildProgramSummary(definition, t) : null;

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const handlePrevDay = (): void => {
    setSelectedDayIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextDay = (): void => {
    setSelectedDayIndex((prev) => Math.min(rows.length - 1, prev + 1));
  };

  const handleSelectDay = (index: number): void => {
    if (rows.length === 0) return;
    setSelectedDayIndex(Math.min(Math.max(0, index), rows.length - 1));
  };

  const handleShowExample = (): void => {
    document.getElementById('session-example')?.scrollIntoView({ behavior: 'smooth' });
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
  const name = localizedProgramName(t, definition.id, definition.name);
  const description = localizedProgramDescription(t, definition.id, definition.description);
  const cycleGroups = buildCycleGroups(
    rows,
    definition.cycleLength,
    definition.workoutsPerWeek,
    (week) => t('catalog.program_preview.week_number', { number: week })
  );
  const cycleLabels = cycleGroups.map((group, index) => {
    const match = /\(([^)]+)\)/.exec(group.label);
    return match?.[1] ?? String(index + 1);
  });

  return (
    <div className="grain-overlay min-h-dvh bg-body">
      <ProgramJsonLd
        programId={programId}
        name={name}
        description={description}
        totalWorkouts={totalWorkouts}
        workoutsPerWeek={definition.workoutsPerWeek}
        days={definition.days}
      />
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
      <main className="mx-auto max-w-[1480px] px-4 sm:px-7 lg:px-10">
        <ZoneHint zone="preview" className="mt-5" />

        <ProgramPreviewHero
          name={name}
          description={description}
          author={definition.author}
          totalWorkouts={totalWorkouts}
          workoutsPerWeek={definition.workoutsPerWeek}
          cycleLength={definition.cycleLength}
          cycleLabels={cycleLabels}
          primaryAction={
            authLoading ? (
              <span className="min-h-12 w-52 animate-pulse bg-rule" />
            ) : (
              <HeroPrimaryAction
                user={user}
                hasActiveProgram={hasActiveProgram}
                programsQueryFailed={programsQueryFailed}
                programId={programId}
              />
            )
          }
          actionNote={
            !authLoading && hasActiveProgram
              ? t('catalog.program_preview.cta_active_warning')
              : undefined
          }
          onShowExample={handleShowExample}
        />

        <ProgramCycle
          groups={cycleGroups}
          selectedDayIndex={selectedDayIndex}
          workoutsPerWeek={definition.workoutsPerWeek}
          onSelectDay={handleSelectDay}
        />

        {selectedWorkout !== undefined && (
          <SessionExample
            workout={selectedWorkout}
            selectedDayIndex={selectedDayIndex}
            totalWorkouts={totalWorkouts}
            onPrev={handlePrevDay}
            onNext={handleNextDay}
          />
        )}

        {summary !== null && <ProgramEssentials summary={summary} />}

        {/* Per-program FAQ — visible Q&A + FAQPage JSON-LD for AI/search extraction */}
        <ProgramFaq items={faqItems} />

        {/* Editorial hub links keep program pages connected to the public
            comparison/progression cluster instead of acting as orphan previews. */}
        <aside
          className="border-b border-rule py-10 sm:py-14"
          aria-labelledby="program-learn-heading"
        >
          <h2
            id="program-learn-heading"
            className="font-display text-lg uppercase tracking-wide text-title mb-3"
          >
            {t('catalog.program_preview.learn_more')}
          </h2>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link
              to={i18n.language.startsWith('en') ? '/en/programs' : '/programas'}
              className="font-bold text-accent hover:underline"
            >
              {t('catalog.program_preview.all_programs')}
            </Link>
            {(programId === 'gzclp' || programId === 'stronglifts-5x5') && (
              <Link
                to={
                  i18n.language.startsWith('en')
                    ? '/en/programs/gzclp-vs-stronglifts'
                    : '/programas/gzclp-vs-stronglifts'
                }
                className="font-bold text-accent hover:underline"
              >
                {t('catalog.program_preview.compare_gzclp')}
              </Link>
            )}
            <Link
              to={
                i18n.language.startsWith('en')
                  ? '/en/programs/automatic-progression'
                  : '/programas/progresion-automatica'
              }
              className="font-bold text-accent hover:underline"
            >
              {t('catalog.program_preview.progression_guide')}
            </Link>
          </div>
        </aside>
      </main>

      <ToastContainer />
    </div>
  );
}
