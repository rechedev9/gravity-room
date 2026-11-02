import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Kbd } from '@/components/ui/kbd';
import { useGuest } from '@/contexts/guest-context';
import { useActiveProgramProgress } from '@/hooks/use-active-program-progress';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchExercises } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import { DESKTOP_NAV_ITEMS } from './desktop-nav';
import {
  buildPaletteSections,
  flattenSections,
  paletteSectionHeadingKey,
  type PaletteEntry,
  type PaletteNavEntry,
} from './palette-results';

const SEARCH_DEBOUNCE_MS = 200;
const MIN_EXERCISE_QUERY = 2;

interface CommandPaletteProps {
  readonly onClose: () => void;
}

function optionId(entry: PaletteEntry): string {
  return `palette-option-${entry.id}`;
}

/**
 * ⌘K palette: jump to a section, to a program day ("34", "día 34") or search the
 * exercise catalog. Focus stays in the input; the arrow keys move an active
 * option tracked with aria-activedescendant, Enter follows it and Escape closes.
 * Mounted only while open, so its queries never run in the background.
 */
export function CommandPalette({ onClose }: CommandPaletteProps): React.ReactNode {
  const { t } = useTranslation();
  const { isGuest } = useGuest();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const listId = useId();
  const descriptionId = useId();
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const { programProgress, workoutsPerWeek } = useActiveProgramProgress(!isGuest);

  const exercisesQuery = useQuery({
    queryKey: queryKeys.catalog.exercises({ q: debouncedQuery, limit: 6 }),
    queryFn: () => fetchExercises({ q: debouncedQuery, limit: 6 }),
    enabled: debouncedQuery.length >= MIN_EXERCISE_QUERY,
    staleTime: 60_000,
  });

  const navEntries = useMemo((): readonly PaletteNavEntry[] => {
    return DESKTOP_NAV_ITEMS.filter((item) => !(item.guestHidden && isGuest)).map((item) => ({
      id: item.id,
      label: t(item.labelKey),
      to: item.to,
    }));
  }, [isGuest, t]);

  const sections = useMemo(
    () =>
      buildPaletteSections({
        query,
        nav: navEntries,
        program:
          programProgress === null
            ? null
            : {
                currentDay: programProgress.day,
                totalDays: programProgress.totalDays,
                workoutsPerWeek,
              },
        exercises: exercisesQuery.data?.data ?? [],
      }),
    [query, navEntries, programProgress, workoutsPerWeek, exercisesQuery.data]
  );

  const entries = useMemo(() => flattenSections(sections), [sections]);
  const activeEntry = entries[activeIndex];

  // Reset the active option whenever the result set changes under the cursor.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the active option visible inside the scrollable list.
  useEffect(() => {
    if (activeEntry === undefined) return;
    document.getElementById(optionId(activeEntry))?.scrollIntoView({ block: 'nearest' });
  }, [activeEntry]);

  // Focus the input on open and hand focus back to the trigger on close.
  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return (): void => {
      const previous = previouslyFocusedRef.current;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const move = useCallback(
    (delta: number): void => {
      if (entries.length === 0) return;
      setActiveIndex((index) => (index + delta + entries.length) % entries.length);
    },
    [entries.length]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, entries.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeEntry !== undefined) {
        document.getElementById(optionId(activeEntry))?.click();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      // The palette is a single-input surface: keep the focus where it is.
      event.preventDefault();
    }
  };

  const empty = entries.length === 0 && query.trim() !== '';
  const activeDescendant = activeEntry === undefined ? undefined : optionId(activeEntry);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[oklch(0_0_0/0.55)] px-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('desktop_shell.palette.label')}
        className="w-full max-w-[640px] overflow-hidden rounded-card border border-rule bg-card shadow-elevated"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-rule px-4">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4 shrink-0 text-label"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeDescendant}
            aria-autocomplete="list"
            aria-describedby={descriptionId}
            aria-label={t('desktop_shell.palette.label')}
            placeholder={t('desktop_shell.palette.placeholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-14 w-full bg-transparent text-base text-main placeholder:text-label outline-none focus:outline-none focus-visible:outline-0"
          />
          <Kbd className="shrink-0">esc</Kbd>
        </div>

        <div
          className="max-h-[60vh] overflow-y-auto p-2"
          id={listId}
          role="listbox"
          aria-label={t('desktop_shell.palette.label')}
        >
          {empty && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {t('desktop_shell.palette.empty', { query: query.trim() })}
            </p>
          )}
          {sections.map((section) => (
            <div key={section.id} role="group" aria-label={t(paletteSectionHeadingKey(section.id))}>
              <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-label">
                {t(paletteSectionHeadingKey(section.id))}
              </p>
              {section.entries.map((entry) => {
                const index = entries.indexOf(entry);
                const active = index === activeIndex;
                return (
                  <PaletteOption
                    key={entry.id}
                    entry={entry}
                    id={optionId(entry)}
                    active={active}
                    onHover={() => setActiveIndex(index)}
                    onSelect={onClose}
                  />
                );
              })}
            </div>
          ))}
          {entries.length === 0 && !empty && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {t('desktop_shell.palette.idle')}
            </p>
          )}
        </div>

        <div
          id={descriptionId}
          className="flex flex-wrap items-center gap-4 border-t border-rule px-4 py-2.5 text-xs text-label"
        >
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            {t('desktop_shell.palette.hint_move')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            {t('desktop_shell.palette.hint_open')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>esc</Kbd>
            {t('desktop_shell.palette.hint_close')}
          </span>
        </div>
      </div>
    </div>
  );
}

interface PaletteOptionProps {
  readonly entry: PaletteEntry;
  readonly id: string;
  readonly active: boolean;
  readonly onHover: () => void;
  readonly onSelect: () => void;
}

function PaletteOption({
  entry,
  id,
  active,
  onHover,
  onSelect,
}: PaletteOptionProps): React.ReactNode {
  const { t } = useTranslation();
  const className = cn(
    'flex min-h-10 w-full items-center justify-between gap-3 rounded-control px-3 py-2 text-left text-sm transition-colors',
    active ? 'bg-[var(--color-surface-2)] text-main' : 'text-muted'
  );

  let label: React.ReactNode;
  let hint: string;

  if (entry.kind === 'nav') {
    label = entry.label;
    hint = '';
  } else if (entry.kind === 'day') {
    label = entry.jump
      ? t('desktop_shell.palette.jump_day', { day: entry.day })
      : t('desktop_shell.palette.day_label', { day: entry.day, week: entry.week });
    hint = t('desktop_shell.palette.hints.day');
  } else {
    label = entry.name;
    hint = t('desktop_shell.palette.hints.exercise');
  }

  const content = (
    <>
      <span className="min-w-0 truncate">{label}</span>
      {hint !== '' && <span className="shrink-0 font-mono text-[11px] text-label">{hint}</span>}
    </>
  );

  const shared = {
    id,
    role: 'option' as const,
    'aria-selected': active,
    onMouseEnter: onHover,
    onClick: onSelect,
    className,
    tabIndex: -1,
  };

  if (entry.kind === 'day') {
    return (
      <Link to="/app/tracker" search={{ day: entry.day }} {...shared}>
        {content}
      </Link>
    );
  }
  if (entry.kind === 'exercise') {
    return (
      <Link to="/app/exercises" search={{ q: entry.name }} {...shared}>
        {content}
      </Link>
    );
  }
  return (
    <Link to={entry.to} {...shared}>
      {content}
    </Link>
  );
}
