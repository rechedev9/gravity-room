import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  fetchExercises,
  fetchMuscleGroups,
  type ExerciseEntry,
  type ExerciseFilter,
} from '@/lib/api-functions';
import {
  attributeSlug,
  computePageInfo,
  guideSlugForExercise,
  uniqueSecondaryMuscles,
  CATALOG_PAGE_SIZE,
  EQUIPMENT_VALUES,
  LEVEL_VALUES,
  CATEGORY_VALUES,
} from './exercise-catalog-view-model';

/** In-app path base for the exercise wiki rendered inside the app shell. */
const APP_WIKI_BASE = '/app/exercises';
const SEARCH_DEBOUNCE_MS = 300;
const STALE_TIME_MS = 5 * 60 * 1000;

interface ExerciseCatalogBrowserProps {
  readonly lang: ArticleLang;
}

interface FilterState {
  readonly muscleGroupId: string;
  readonly equipment: string;
  readonly level: string;
  readonly category: string;
}

const EMPTY_FILTERS: FilterState = { muscleGroupId: '', equipment: '', level: '', category: '' };

/**
 * Searchable, filterable, paginated browser over the full seeded exercise
 * catalog. Backed by `GET /api/exercises`, which is optional-auth: guests (no
 * token) receive the full preset catalog, so this works in guest mode without a
 * gate. Rendered only inside the app shell — the public wiki stays static.
 */
export function ExerciseCatalogBrowser({ lang }: ExerciseCatalogBrowserProps): ReactNode {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);

  // Reset to the first page whenever the query criteria change.
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, filters.muscleGroupId, filters.equipment, filters.level, filters.category]);

  const filter: ExerciseFilter = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      muscleGroupId: filters.muscleGroupId ? [filters.muscleGroupId] : undefined,
      equipment: filters.equipment ? [filters.equipment] : undefined,
      level: filters.level ? [filters.level] : undefined,
      category: filters.category ? [filters.category] : undefined,
      limit: CATALOG_PAGE_SIZE,
      offset,
    }),
    [debouncedSearch, filters, offset]
  );

  const muscleGroupsQuery = useQuery({
    queryKey: queryKeys.catalog.muscleGroups(),
    queryFn: fetchMuscleGroups,
    staleTime: STALE_TIME_MS,
  });

  const exercisesQuery = useQuery({
    queryKey: queryKeys.catalog.exercises({ ...filter }),
    queryFn: () => fetchExercises(filter),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });

  const result = exercisesQuery.data;
  const pageInfo = computePageInfo(result?.total ?? 0, offset, CATALOG_PAGE_SIZE);
  const hasActiveFilters =
    debouncedSearch !== '' ||
    filters.muscleGroupId !== '' ||
    filters.equipment !== '' ||
    filters.level !== '' ||
    filters.category !== '';

  const muscleGroupLabel = (id: string): string =>
    t(`exerciseCatalog.attributes.muscleGroup.${attributeSlug(id)}`, {
      defaultValue: muscleGroupsQuery.data?.find((mg) => mg.id === id)?.name ?? id,
    });

  function setFilter<K extends keyof FilterState>(key: K, value: string): void {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearAll(): void {
    setSearchInput('');
    setFilters(EMPTY_FILTERS);
  }

  const muscleGroupOptions = muscleGroupsQuery.data ?? [];

  return (
    <section aria-labelledby="exercise-catalog-heading" className="space-y-5">
      <header className="space-y-1">
        <h2 id="exercise-catalog-heading" className="font-display text-3xl text-title">
          {t('exerciseCatalog.heading')}
        </h2>
        <p className="text-sm text-muted">{t('exerciseCatalog.subtitle')}</p>
      </header>

      {/* Search + filters */}
      <div className="space-y-3">
        <div>
          <label htmlFor="exercise-search" className="sr-only">
            {t('exerciseCatalog.searchLabel')}
          </label>
          <input
            id="exercise-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('exerciseCatalog.searchPlaceholder')}
            className="w-full h-11 px-4 border-2 border-rule bg-card text-main text-sm focus:outline-none focus:border-accent transition-colors"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <CatalogSelect
            id="filter-muscle-group"
            label={t('exerciseCatalog.filters.muscleGroup')}
            allLabel={t('exerciseCatalog.filters.all')}
            value={filters.muscleGroupId}
            onChange={(v) => setFilter('muscleGroupId', v)}
            options={muscleGroupOptions.map((mg) => ({
              value: mg.id,
              label: muscleGroupLabel(mg.id),
            }))}
          />
          <CatalogSelect
            id="filter-equipment"
            label={t('exerciseCatalog.filters.equipment')}
            allLabel={t('exerciseCatalog.filters.all')}
            value={filters.equipment}
            onChange={(v) => setFilter('equipment', v)}
            options={EQUIPMENT_VALUES.map((v) => ({
              value: v,
              label: t(`exerciseCatalog.attributes.equipment.${attributeSlug(v)}`, {
                defaultValue: v,
              }),
            }))}
          />
          <CatalogSelect
            id="filter-level"
            label={t('exerciseCatalog.filters.level')}
            allLabel={t('exerciseCatalog.filters.all')}
            value={filters.level}
            onChange={(v) => setFilter('level', v)}
            options={LEVEL_VALUES.map((v) => ({
              value: v,
              label: t(`exerciseCatalog.attributes.level.${attributeSlug(v)}`, { defaultValue: v }),
            }))}
          />
          <CatalogSelect
            id="filter-category"
            label={t('exerciseCatalog.filters.category')}
            allLabel={t('exerciseCatalog.filters.all')}
            value={filters.category}
            onChange={(v) => setFilter('category', v)}
            options={CATEGORY_VALUES.map((v) => ({
              value: v,
              label: t(`exerciseCatalog.attributes.category.${attributeSlug(v)}`, {
                defaultValue: v,
              }),
            }))}
          />
        </div>
      </div>

      {/* Count + clear */}
      <div className="flex items-center justify-between gap-3 min-h-[1.25rem]">
        <p className="font-mono text-[11px] tracking-wider uppercase text-muted" aria-live="polite">
          {exercisesQuery.isError
            ? ''
            : pageInfo.total === 0
              ? ''
              : t('exerciseCatalog.showing', {
                  from: pageInfo.from,
                  to: pageInfo.to,
                  total: pageInfo.total,
                })}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="font-mono text-[11px] tracking-wider uppercase text-muted hover:text-accent transition-colors shrink-0"
          >
            {t('exerciseCatalog.filters.clear')}
          </button>
        )}
      </div>

      {/* Results */}
      {exercisesQuery.isError ? (
        <div className="border border-rule bg-card px-4 py-8 text-center space-y-3">
          <p className="text-sm text-muted">{t('exerciseCatalog.error.title')}</p>
          <button
            type="button"
            onClick={() => void exercisesQuery.refetch()}
            className="font-mono text-[11px] tracking-wider uppercase text-accent hover:underline"
          >
            {t('exerciseCatalog.error.retry')}
          </button>
        </div>
      ) : exercisesQuery.isLoading ? (
        <ul className="space-y-2" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="h-[4.5rem] border border-rule bg-card animate-pulse" />
          ))}
        </ul>
      ) : pageInfo.total === 0 ? (
        <div className="border border-rule bg-card px-4 py-10 text-center space-y-1">
          <p className="text-main font-display text-xl">{t('exerciseCatalog.empty.title')}</p>
          <p className="text-sm text-muted">{t('exerciseCatalog.empty.hint')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {(result?.data ?? []).map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              lang={lang}
              expanded={expandedId === exercise.id}
              onToggle={() => setExpandedId((prev) => (prev === exercise.id ? null : exercise.id))}
              muscleGroupLabel={muscleGroupLabel}
            />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {!exercisesQuery.isError && pageInfo.pageCount > 1 && (
        <nav
          className="flex items-center justify-between gap-3 pt-1"
          aria-label={t('exerciseCatalog.pagination.label')}
        >
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - CATALOG_PAGE_SIZE))}
            disabled={!pageInfo.hasPrev}
            className="font-mono text-[11px] tracking-wider uppercase px-4 py-2 border border-rule bg-card text-main enabled:hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('exerciseCatalog.pagination.prev')}
          </button>
          <span className="font-mono text-[11px] tracking-wider uppercase text-muted">
            {t('exerciseCatalog.pagination.page', {
              page: pageInfo.page,
              pageCount: pageInfo.pageCount,
            })}
          </span>
          <button
            type="button"
            onClick={() => setOffset((o) => o + CATALOG_PAGE_SIZE)}
            disabled={!pageInfo.hasNext}
            className="font-mono text-[11px] tracking-wider uppercase px-4 py-2 border border-rule bg-card text-main enabled:hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('exerciseCatalog.pagination.next')}
          </button>
        </nav>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CatalogSelectProps {
  readonly id: string;
  readonly label: string;
  readonly allLabel: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

function CatalogSelect({
  id,
  label,
  allLabel,
  value,
  onChange,
  options,
}: CatalogSelectProps): ReactNode {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[10px] tracking-[0.14em] uppercase text-label mb-1"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-2 border-2 border-rule bg-card text-main text-sm cursor-pointer focus:outline-none focus:border-accent transition-colors"
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ExerciseRowProps {
  readonly exercise: ExerciseEntry;
  readonly lang: ArticleLang;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly muscleGroupLabel: (id: string) => string;
}

function AttributeBadge({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 border border-rule-light bg-body text-muted">
      {children}
    </span>
  );
}

function ExerciseRow({
  exercise,
  lang,
  expanded,
  onToggle,
  muscleGroupLabel,
}: ExerciseRowProps): ReactNode {
  const { t } = useTranslation();
  const guideSlug = guideSlugForExercise(exercise, lang);
  const secondary = uniqueSecondaryMuscles(exercise);
  const panelId = `exercise-panel-${exercise.id}`;

  const attr = (group: string, value: string | null): string | null =>
    value
      ? t(`exerciseCatalog.attributes.${group}.${attributeSlug(value)}`, { defaultValue: value })
      : null;

  return (
    <li className="border border-rule bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-body/60 transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg text-main truncate">{exercise.name}</span>
          <span className="flex flex-wrap gap-1.5 mt-1.5">
            <AttributeBadge>{muscleGroupLabel(exercise.muscleGroupId)}</AttributeBadge>
            {exercise.equipment && (
              <AttributeBadge>{attr('equipment', exercise.equipment)}</AttributeBadge>
            )}
            {exercise.level && <AttributeBadge>{attr('level', exercise.level)}</AttributeBadge>}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          &#9662;
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="px-4 pb-4 pt-1 border-t border-rule space-y-3">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            <AttributeCell
              label={t('exerciseCatalog.detail.category')}
              value={attr('category', exercise.category)}
            />
            <AttributeCell
              label={t('exerciseCatalog.detail.force')}
              value={attr('force', exercise.force)}
            />
            <AttributeCell
              label={t('exerciseCatalog.detail.mechanic')}
              value={attr('mechanic', exercise.mechanic)}
            />
          </dl>

          {secondary.length > 0 && (
            <div className="space-y-1">
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-label">
                {t('exerciseCatalog.detail.secondaryMuscles')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {secondary.map((m) => (
                  <AttributeBadge key={m}>{muscleGroupLabel(m)}</AttributeBadge>
                ))}
              </div>
            </div>
          )}

          {guideSlug && (
            <Link
              to={`${APP_WIKI_BASE}/$slug`}
              params={{ slug: guideSlug }}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider uppercase text-accent hover:underline"
            >
              {t('exerciseCatalog.readGuide')}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

function AttributeCell({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}): ReactNode {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-[0.14em] uppercase text-label">{label}</dt>
      <dd className="text-sm text-main mt-0.5">{value ?? '—'}</dd>
    </div>
  );
}
