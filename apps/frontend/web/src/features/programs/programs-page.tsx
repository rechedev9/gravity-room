import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms, fetchCatalogList } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useTracker } from '@/contexts/tracker-context';
import { Link, useNavigate } from '@tanstack/react-router';
import { ProgramCard } from './program-card';
import { Button } from '@/components/button';
import { PROGRAM_LEVELS } from '@gzclp/domain/catalog';
import type { ProgramLevel } from '@gzclp/domain/catalog';
import { StaggerContainer, StaggerItem, fadeUpFastVariants } from '@/lib/motion-primitives';
import { ZoneHint } from '@/features/home/zone-hint';
import { localizedProgramName } from '@/lib/catalog-display';

const LEVEL_LABEL_KEYS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'programs.card.level_beginner',
  intermediate: 'programs.card.level_intermediate',
  advanced: 'programs.card.level_advanced',
};

const LEVEL_DESCRIPTION_KEYS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'programs.level_description.beginner',
  intermediate: 'programs.level_description.intermediate',
  advanced: 'programs.level_description.advanced',
};

const CATEGORY_FILTERS = ['all', 'strength', 'hypertrophy', 'powerlifting'] as const;
type CategoryFilter = (typeof CATEGORY_FILTERS)[number];
type LevelFilter = ProgramLevel | 'all';
const LEVEL_FILTERS: readonly LevelFilter[] = ['all', ...PROGRAM_LEVELS];

export function ProgramsPage(): React.ReactNode {
  const { t } = useTranslation();
  const { user } = useAuth();

  useDocumentTitle(t('programs.page_title'));
  const { isGuest } = useGuest();
  const navigate = useNavigate();
  const { setTracker } = useTracker();
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: 5 * 60 * 1000,
  });

  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });

  const activeProgram = programsQuery.data?.find((p) => p.status === 'active') ?? null;
  const activeCatalogEntry = catalogQuery.data?.find(
    (entry) => entry.id === activeProgram?.programId
  );

  const catalogGrouped = useMemo(() => {
    if (!catalogQuery.data) return null;
    const filtered = catalogQuery.data.filter(
      (entry) =>
        entry.id !== activeProgram?.programId &&
        (levelFilter === 'all' || entry.level === levelFilter) &&
        (categoryFilter === 'all' || entry.category === categoryFilter)
    );
    if (filtered.length === 0) return null;
    const grouped = new Map<ProgramLevel, typeof filtered>();
    for (const entry of filtered) {
      const list = grouped.get(entry.level) ?? [];
      list.push(entry);
      grouped.set(entry.level, list);
    }
    return grouped;
  }, [catalogQuery.data, activeProgram?.programId, categoryFilter, levelFilter]);

  const availableCount = catalogQuery.data?.length ?? 0;
  const minimumFrequency = catalogQuery.data?.reduce(
    (minimum, entry) => Math.min(minimum, entry.workoutsPerWeek),
    Number.POSITIVE_INFINITY
  );
  const visibleCount = catalogGrouped
    ? Array.from(catalogGrouped.values()).reduce((count, entries) => count + entries.length, 0)
    : 0;

  const handleStartProgram = (programId: string): void => {
    setTracker(programId, undefined);
    void navigate({ to: '/app/tracker/$programId', params: { programId } });
  };

  return (
    <div className="min-h-dvh bg-body">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
        <header className="grid gap-8 border-b border-rule pb-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.28em] text-accent">
              {t('programs.catalog_eyebrow')}
            </p>
            <h1 className="mt-3 max-w-4xl font-display text-5xl uppercase leading-[0.92] tracking-wide text-title sm:text-6xl lg:text-7xl">
              {t('programs.catalog_heading')}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              {t('programs.catalog_intro')}
            </p>
          </div>
          <dl className="grid grid-cols-3 border border-rule bg-card/45">
            <div className="min-w-28 px-4 py-4 sm:min-w-36 sm:px-5">
              <dd className="font-display-data text-3xl text-title">{availableCount}</dd>
              <dt className="font-mono text-[9px] uppercase tracking-wider text-muted">
                {t('programs.stats.programs')}
              </dt>
            </div>
            <div className="min-w-28 border-x border-rule px-4 py-4 sm:min-w-36 sm:px-5">
              <dd className="font-display-data text-3xl text-title">3</dd>
              <dt className="font-mono text-[9px] uppercase tracking-wider text-muted">
                {t('programs.stats.goals')}
              </dt>
            </div>
            <div className="min-w-28 px-4 py-4 sm:min-w-36 sm:px-5">
              <dd className="font-display-data text-3xl text-title">
                {Number.isFinite(minimumFrequency) ? minimumFrequency : '—'}
              </dd>
              <dt className="font-mono text-[9px] uppercase tracking-wider text-muted">
                {t('programs.stats.days_from')}
              </dt>
            </div>
          </dl>
        </header>

        <ZoneHint zone="programs" className="mt-5" />

        {activeCatalogEntry !== undefined && (
          <section className="mt-6 flex flex-col gap-4 border border-accent/50 bg-accent/[0.035] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid size-10 shrink-0 place-items-center border border-accent font-mono text-2xs font-bold text-accent">
                ▶
              </span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-accent">
                  {t('programs.current_program')}
                </p>
                <p className="mt-1 font-display text-2xl uppercase text-title">
                  {localizedProgramName(t, activeCatalogEntry.id, activeCatalogEntry.name)}
                </p>
              </div>
            </div>
            <Link
              to="/app"
              className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-main hover:text-accent"
            >
              {t('programs.go_to_training')} <span aria-hidden="true">→</span>
            </Link>
          </section>
        )}

        <section className="mt-8 border-y border-rule py-5" aria-label={t('programs.filters_aria')}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {LEVEL_FILTERS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLevelFilter(level)}
                  aria-pressed={levelFilter === level}
                  className={`min-h-10 border px-4 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
                    levelFilter === level
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-rule bg-card/40 text-muted hover:border-rule-light hover:text-main'
                  }`}
                >
                  {level === 'all' ? t('programs.filters.all_levels') : t(LEVEL_LABEL_KEYS[level])}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORY_FILTERS.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  aria-pressed={categoryFilter === category}
                  className={`min-h-9 border-b px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                    categoryFilter === category
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted hover:text-main'
                  }`}
                >
                  {t(`programs.filters.category_${category}`)}
                </button>
              ))}
              <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-muted">
                {t('programs.filters.results', { count: visibleCount })}
              </span>
            </div>
          </div>
        </section>

        {/* Catalog */}
        <section className="mb-10 mt-10">
          {catalogQuery.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-card border border-rule p-5 animate-pulse">
                  <div className="h-4 w-32 bg-rule rounded mb-2" />
                  <div className="h-3 w-48 bg-rule rounded mb-4" />
                  <div className="h-10 w-36 bg-rule rounded" />
                </div>
              ))}
            </div>
          )}

          {catalogQuery.isError && (
            <div className="bg-card border border-rule p-6 text-center">
              <p className="text-sm text-muted mb-3">{t('programs.catalog_load_error')}</p>
              <Button onClick={() => void catalogQuery.refetch()}>{t('programs.retry')}</Button>
            </div>
          )}

          {catalogGrouped && (
            <div className="space-y-14">
              {PROGRAM_LEVELS.map((level) => {
                const entries = catalogGrouped.get(level);
                if (!entries?.length) return null;
                return (
                  <div key={level}>
                    <div className="mb-5 grid gap-2 border-b border-rule pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] sm:items-end">
                      <div className="flex items-baseline gap-4">
                        <span className="font-display-data text-4xl text-accent">
                          0{PROGRAM_LEVELS.indexOf(level) + 1}
                        </span>
                        <h2 className="font-display text-3xl uppercase tracking-wide text-title sm:text-4xl">
                          {t(LEVEL_LABEL_KEYS[level])}
                        </h2>
                      </div>
                      <p className="text-xs leading-5 text-muted sm:text-right">
                        {t(LEVEL_DESCRIPTION_KEYS[level])}
                      </p>
                    </div>
                    <StaggerContainer
                      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                      stagger={0.05}
                    >
                      {entries.map((entry, index) => (
                        <StaggerItem
                          key={entry.id}
                          variants={fadeUpFastVariants}
                          className={
                            entries.length % 2 === 1 && index === entries.length - 1
                              ? 'lg:col-span-2'
                              : undefined
                          }
                        >
                          <ProgramCard
                            definition={entry}
                            ordinal={index + 1}
                            isActive={false}
                            previewTo={`/programs/${entry.id}`}
                            onSelect={() => handleStartProgram(entry.id)}
                          />
                        </StaggerItem>
                      ))}
                    </StaggerContainer>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
