import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  CATALOG_LEVEL_FILTERS,
  filterCatalogEntries,
  hasCatalogFilters,
  pickFeaturedEntry,
  type CatalogLevelFilter,
} from '@gzclp/domain/catalog-filter';
import { queryKeys } from '@/lib/query-keys';
import { fetchCatalogList } from '@/lib/api-functions';
import { localizedProgramDescription, localizedProgramName } from '@/lib/catalog-display';
import { useTracker } from '@/contexts/tracker-context';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ProgramCard } from './program-card';
import { FeaturedProgramCard } from './featured-program-card';

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

interface ProgramCatalogProps {
  /** Catalog id of the active program; it is listed in its own block, not here. */
  readonly activeProgramId: string | null;
  /** Show the kicker, title and subtitle above the search. Pages that own the heading omit it. */
  readonly showHeading?: boolean;
}

function SearchIcon(): React.ReactNode {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CatalogSkeleton(): React.ReactNode {
  return (
    <div aria-busy="true" data-testid="catalog-skeleton" className="space-y-4">
      <div className="h-56 overflow-hidden rounded-[18px] border border-rule bg-card animate-pulse motion-reduce:animate-none md:grid md:h-60 md:grid-cols-2">
        <div className="h-28 bg-surface-2 md:h-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {SKELETON_ROWS.map((n) => (
          <div
            key={n}
            className="flex gap-4 rounded-card border border-rule bg-card p-4 animate-pulse motion-reduce:animate-none"
          >
            <div className="h-[85px] w-24 shrink-0 rounded-[12px] bg-surface-2" />
            <div className="flex-1 space-y-2.5 pt-1">
              <div className="h-4 w-2/3 rounded bg-surface-2" />
              <div className="h-3 w-1/2 rounded bg-surface-2" />
              <div className="h-3 w-5/6 rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CatalogMessageProps {
  readonly tone: 'error' | 'empty';
  readonly children: React.ReactNode;
  readonly action: React.ReactNode;
}

function CatalogMessage({ tone, children, action }: CatalogMessageProps): React.ReactNode {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid={tone === 'error' ? 'catalog-error' : 'catalog-empty'}
      className="flex flex-col items-center gap-3 rounded-card border border-dashed border-rule-light bg-card px-6 py-10 text-center"
    >
      <span
        aria-hidden="true"
        className={
          tone === 'error'
            ? 'flex size-11 items-center justify-center rounded-full border border-error-line text-error'
            : 'flex size-11 items-center justify-center rounded-full border border-rule-light text-label'
        }
      >
        {tone === 'error' ? (
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.5h.01" />
          </svg>
        ) : (
          <SearchIcon />
        )}
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-muted">{children}</p>
      {action}
    </div>
  );
}

/**
 * The searchable program catalog, laid out like the mobile Explore: search, level chips, a
 * featured card, then every program with its cover. Shared by /app/programs (desktop) and
 * /app/explore (phones).
 */
export function ProgramCatalog({
  activeProgramId,
  showHeading = false,
}: ProgramCatalogProps): React.ReactNode {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setTracker } = useTracker();
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<CatalogLevelFilter>('all');

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: 5 * 60 * 1000,
  });

  const entries = useMemo(
    () => (catalogQuery.data ?? []).filter((e) => e.id !== activeProgramId),
    [catalogQuery.data, activeProgramId]
  );

  const query = { search, level };
  // Search what the reader sees: the translated name and description.
  const filtered = filterCatalogEntries({
    entries,
    query,
    searchText: (entry) =>
      `${localizedProgramName(t, entry.id, entry.name)} ${localizedProgramDescription(t, entry.id, entry.description)}`,
  });
  const featured = pickFeaturedEntry(entries, query);
  const filtersActive = hasCatalogFilters(query);
  const ready = catalogQuery.data !== undefined && !catalogQuery.isError;

  const resetFilters = (): void => {
    setSearch('');
    setLevel('all');
  };

  const handleStartProgram = (programId: string): void => {
    setTracker(programId, undefined);
    void navigate({ to: '/app/tracker/$programId', params: { programId } });
  };

  return (
    <div className="space-y-4" data-testid="program-catalog">
      {showHeading && (
        <header className="mb-2 flex flex-col gap-2">
          <p className="type-kicker text-accent tracking-[2px]">{t('programs.catalog.eyebrow')}</p>
          <h2 className="type-display-sm sm:type-display text-title">
            {t('programs.catalog.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted">{t('programs.catalog.subtitle')}</p>
        </header>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex min-h-12 flex-1 items-center rounded-[12px] border border-rule bg-card pl-3.5 text-label transition-colors focus-within:border-accent lg:max-w-md">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t('programs.catalog.search')}
            placeholder={t('programs.catalog.search')}
            autoComplete="off"
            spellCheck={false}
            className="min-h-12 min-w-0 flex-1 bg-transparent px-2.5 text-base text-main placeholder:text-label [&::-webkit-search-cancel-button]:hidden"
            style={{ outline: 'none' }}
          />
          {search !== '' && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('programs.catalog.clear')}
              className="flex size-11 cursor-pointer items-center justify-center text-muted transition-colors hover:text-main focus-visible:ring-2 ring-accent focus-visible:outline-none"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
        <div
          role="group"
          aria-label={t('programs.catalog.levels')}
          className="-mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0"
        >
          {CATALOG_LEVEL_FILTERS.map((value) => (
            <Chip key={value} selected={level === value} onClick={() => setLevel(value)}>
              {value === 'all'
                ? t('programs.catalog.level_all')
                : t(`programs.card.level_${value}`)}
            </Chip>
          ))}
        </div>
      </div>

      {catalogQuery.isLoading && <CatalogSkeleton />}

      {catalogQuery.isError && (
        <CatalogMessage
          tone="error"
          action={
            <Button onClick={() => void catalogQuery.refetch()}>{t('programs.retry')}</Button>
          }
        >
          {t('programs.catalog_load_error')}
        </CatalogMessage>
      )}

      {ready && (
        <>
          {featured && (
            <FeaturedProgramCard
              definition={featured}
              previewTo={`/programs/${featured.id}`}
              onSelect={() => handleStartProgram(featured.id)}
            />
          )}

          <div className="flex items-baseline justify-between pt-2">
            <h2 className="type-title text-main">{t('programs.catalog.all_programs')}</h2>
            <span
              aria-label={t('programs.catalog.results_count', { count: filtered.length })}
              aria-live="polite"
              data-testid="catalog-count"
              className="type-meta text-muted"
            >
              {filtered.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <CatalogMessage
              tone="empty"
              action={
                filtersActive ? (
                  <Button onClick={resetFilters}>{t('programs.catalog.reset_filters')}</Button>
                ) : null
              }
            >
              {filtersActive ? t('programs.catalog.empty') : t('programs.catalog.empty_all')}
            </CatalogMessage>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((entry) => (
                <ProgramCard
                  key={entry.id}
                  definition={entry}
                  isActive={false}
                  previewTo={`/programs/${entry.id}`}
                  onSelect={() => handleStartProgram(entry.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
