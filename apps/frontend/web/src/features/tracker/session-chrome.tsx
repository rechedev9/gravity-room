import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { progressFillPercent } from '@/components/progress-bar';
import { Chip } from '@/components/chip';
import { cn } from '@/lib/cn';
import {
  isCycleDayName,
  localizedConfigFieldLabel,
  localizedProgramName,
} from '@/lib/catalog-display';
import { useUnitPreference } from '@/hooks/use-unit-preference';
import { buildWeightsSummary } from './weights-summary';
import { IconButton } from './icon-button';
import { SessionMenu, type SessionMenuProps } from './session-menu';
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  UndoIcon,
} from './tracker-icons';

export interface SessionChromeProps extends SessionMenuProps {
  readonly definition: ProgramDefinition;
  readonly config: Record<string, number | string>;
  readonly dayIndex: number;
  readonly totalDays: number;
  readonly dayName: string;
  readonly isCurrentDay: boolean;
  /** The day the program is on, or -1 when every day is recorded. */
  readonly currentDayIndex: number;
  readonly workoutsPerWeek: number;
  readonly completedDayIndices: ReadonlySet<number>;
  /** Slots resolved in the selected day, and how many there are in total. */
  readonly doneSlots: number;
  readonly totalSlots: number;
  /** Whole-program progress, which drives the proactive finish action. */
  readonly completedDays: number;
  readonly navExpanded: boolean;
  readonly canUndo: boolean;
  readonly onUndo: () => void;
  readonly onSelectDay: (index: number) => void;
  readonly onPrevDay: () => void;
  readonly onNextDay: () => void;
  readonly onGoToCurrent: () => void;
  readonly onToggleNav: () => void;
  readonly onEditWeights: () => void;
  /** Opens the plans list. Omitted where there is nowhere to switch to. */
  readonly onSwitchProgram?: () => void;
}

/**
 * Header of a session, laid out like the mobile tracker: program name with its switcher and
 * undo, the week and day position, week chips, the day selector and the day progress line.
 * The web extras (starting weights, calendar, overflow menu) ride on the same rows.
 */
export function SessionChrome({
  definition,
  config,
  dayIndex,
  totalDays,
  dayName,
  isCurrentDay,
  currentDayIndex,
  workoutsPerWeek,
  completedDayIndices,
  doneSlots,
  totalSlots,
  completedDays,
  navExpanded,
  canUndo,
  onUndo,
  onSelectDay,
  onPrevDay,
  onNextDay,
  onGoToCurrent,
  onToggleNav,
  onEditWeights,
  onSwitchProgram,
  ...menuProps
}: SessionChromeProps): ReactNode {
  const { t } = useTranslation();
  const localize = (key: string, fallback: string): string =>
    localizedConfigFieldLabel(t, key, fallback);
  const overflow = (n: number): string => t('tracker.setup_form.overflow_indicator', { n });
  const { toDisplay } = useUnitPreference();
  const weightKeys = new Set(
    definition.configFields.filter((f) => f.type === 'weight').map((f) => f.key)
  );
  const displayConfig: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(config)) {
    displayConfig[key] =
      weightKeys.has(key) && typeof value === 'number' ? toDisplay(value) : value;
  }
  const { summary, full } = buildWeightsSummary(
    displayConfig,
    definition.configFields,
    overflow,
    localize
  );
  const { summary: mobileSummary } = buildWeightsSummary(
    displayConfig,
    definition.configFields,
    overflow,
    localize,
    1
  );
  const percent = progressFillPercent(doneSlots, totalSlots);
  // A name like "Día 3" only repeats the counter next to it.
  const showDayName = dayName !== '' && !isCycleDayName(dayName);
  const programComplete = completedDays >= totalDays && totalDays > 0;
  const programName = localizedProgramName(t, definition.id, definition.name);

  const perWeek = Math.max(1, workoutsPerWeek);
  const weekCount = Math.max(1, Math.ceil(totalDays / perWeek));
  const weekIndex = Math.floor(dayIndex / perWeek);
  const weekStart = weekIndex * perWeek;
  const weekDays = Array.from(
    { length: Math.max(0, Math.min(perWeek, totalDays - weekStart)) },
    (_, i) => weekStart + i
  );
  const showGoToCurrent = !isCurrentDay && currentDayIndex >= 0;
  const changeDayLabel = navExpanded
    ? t('tracker.day_status.close')
    : t('tracker.day_status.change_day');

  // Keep the selected week chip on screen: a long plan has dozens of weeks.
  const weekRailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = weekRailRef.current;
    const chip = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !chip) return;
    rail.scrollLeft = chip.offsetLeft - (rail.clientWidth - chip.offsetWidth) / 2;
  }, [weekIndex]);

  return (
    <header
      data-testid="session-chrome"
      className="mx-auto flex w-full max-w-[1300px] flex-col gap-3 px-5 pt-5 pb-4 sm:px-6 sm:pt-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="type-kicker text-label">{t('tracker.session_chrome.label')}</p>
          <h1 className="mt-1 min-w-0">
            {onSwitchProgram ? (
              <button
                type="button"
                onClick={onSwitchProgram}
                data-testid="session-chrome-switch-program"
                aria-label={t('tracker.session_chrome.switch_program_aria', { name: programName })}
                className="group -ml-1 inline-flex max-w-full items-center gap-1.5 rounded-control px-1 text-left text-title cursor-pointer transition-colors duration-[var(--duration-press)] hover:text-accent"
              >
                <span className="type-display-sm sm:type-display truncate">{programName}</span>
                <ChevronDownIcon className="shrink-0 text-muted transition-colors group-hover:text-accent" />
              </button>
            ) : (
              <span className="type-display-sm sm:type-display block truncate text-title">
                {programName}
              </span>
            )}
          </h1>
        </div>
        <div className="-mr-2 flex shrink-0 items-center">
          <IconButton
            label={t('tracker.session_chrome.undo_aria')}
            data-testid="session-chrome-undo"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <UndoIcon size={22} />
          </IconButton>
          <IconButton
            label={t('tracker.session_chrome.edit_weights_aria')}
            data-testid="session-chrome-edit-weights"
            onClick={onEditWeights}
          >
            <PencilIcon />
          </IconButton>
          <SessionMenu {...menuProps} showFinishCta={programComplete} />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <p className="type-meta flex shrink-0 items-baseline gap-2 text-main">
          <span>{t('tracker.session_chrome.week_label', { n: weekIndex + 1 })}</span>
          <span>
            {t('tracker.day_status.day_label')} {dayIndex + 1}
          </span>
          <span className="font-normal text-label">/ {totalDays}</span>
        </p>
        <p className="flex min-w-0 items-baseline gap-2 text-sm text-label">
          {showDayName && <span className="hidden truncate text-muted sm:inline">{dayName}</span>}
          {showDayName && <span className="hidden sm:inline">·</span>}
          <span
            data-testid="session-chrome-weights"
            className="min-w-0 truncate font-mono text-[11px]"
            title={full}
          >
            <span className="sm:hidden">{mobileSummary || '-'}</span>
            <span className="hidden sm:inline">{summary || '-'}</span>
          </span>
        </p>
      </div>
      {showDayName && <p className="-mt-2 truncate text-sm text-muted sm:hidden">{dayName}</p>}

      <div className="flex items-center gap-2">
        <div
          ref={weekRailRef}
          role="group"
          aria-label={t('tracker.session_chrome.weeks_aria')}
          className="week-rail -ml-1 flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5 pr-9 pl-1"
        >
          {Array.from({ length: weekCount }, (_, week) => (
            <Chip
              key={week}
              selected={week === weekIndex}
              onClick={() => onSelectDay(week * perWeek)}
              className="shrink-0"
            >
              {t('tracker.session_chrome.week_chip', { n: week + 1 })}
            </Chip>
          ))}
        </div>
        {showGoToCurrent && (
          <button
            type="button"
            onClick={onGoToCurrent}
            data-testid="session-chrome-go-current"
            className="type-button min-h-11 shrink-0 rounded-control px-2 text-accent cursor-pointer hover:text-accent-hover"
          >
            {t('tracker.day_navigator.go_to_current')}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleNav}
          aria-expanded={navExpanded}
          aria-label={changeDayLabel}
          data-testid="session-chrome-change-day"
          className={cn(
            'type-button inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-control px-2.5 cursor-pointer',
            'transition-[background-color,color] duration-[var(--duration-press)]',
            navExpanded ? 'bg-surface-2 text-main' : 'text-muted hover:bg-card hover:text-main'
          )}
        >
          <CalendarIcon />
          <span className="hidden md:inline" aria-hidden="true">
            {changeDayLabel}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex items-center gap-1 rounded-card bg-card p-1.5 lg:w-[30rem] lg:shrink-0">
          <IconButton
            label={t('tracker.day_navigator.prev_aria')}
            disabled={dayIndex <= 0}
            onClick={onPrevDay}
          >
            <ChevronLeftIcon />
          </IconButton>
          <div
            role="group"
            aria-label={t('tracker.session_chrome.days_aria')}
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
          >
            {weekDays.map((index) => {
              const selected = index === dayIndex;
              const done = completedDayIndices.has(index);
              const label = t('tracker.day_status.day_name', { n: index + 1 });
              return (
                <button
                  key={index}
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  aria-label={
                    done ? t('tracker.session_chrome.day_done_aria', { day: label }) : label
                  }
                  data-day-index={index}
                  onClick={() => onSelectDay(index)}
                  className={cn(
                    'type-button flex min-h-11 min-w-16 flex-1 items-center justify-center gap-1.5 rounded-control px-2 whitespace-nowrap cursor-pointer',
                    'transition-[background-color,color,transform] duration-[var(--duration-press)] ease-[var(--ease-press)] active:translate-y-px',
                    selected ? 'bg-accent text-on-accent' : 'text-label hover:text-main'
                  )}
                >
                  <span aria-hidden="true">{label}</span>
                  {done && <CheckCircleIcon className={selected ? 'text-on-accent' : 'text-ok'} />}
                </button>
              );
            })}
          </div>
          <IconButton
            label={t('tracker.day_navigator.next_aria')}
            disabled={dayIndex >= totalDays - 1}
            onClick={onNextDay}
          >
            <ChevronRightIcon />
          </IconButton>
        </div>

        <div
          className="flex min-w-0 flex-1 items-center gap-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSlots}
          aria-valuenow={doneSlots}
          aria-label={t('tracker.session_chrome.day_progress_aria')}
        >
          <span className="shrink-0 text-sm text-label tabular-nums">
            {t('tracker.session_chrome.exercises_progress', {
              done: doneSlots,
              total: totalSlots,
            })}
          </span>
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-progress-track">
            <div
              data-fill
              className="h-[3px] rounded-full bg-ok transition-[width] duration-[var(--duration-base)] ease-[var(--ease-out-expo)]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {isCurrentDay && <span className="sr-only">{t('tracker.day_status.today_prefix')}</span>}
    </header>
  );
}
