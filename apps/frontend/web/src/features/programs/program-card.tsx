import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCategoryColor } from '@/lib/category-colors';
import {
  localizedCategoryLabel,
  localizedProgramDescription,
  localizedProgramName,
} from '@/lib/catalog-display';

/** Minimal program info needed by ProgramCard — compatible with both CatalogEntry and ProgramDefinition. */
export interface ProgramCardInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly author: string;
}

interface ProgramCardProps {
  readonly definition: ProgramCardInfo;
  readonly ordinal?: number;
  readonly disabled?: boolean;
  readonly disabledLabel?: string;
  readonly isActive?: boolean;
  readonly onSelect?: () => void;
  readonly previewTo?: string;
  readonly to?: string;
}

export function ProgramCard({
  definition,
  ordinal,
  disabled = false,
  disabledLabel,
  isActive = false,
  onSelect,
  previewTo,
  to,
}: ProgramCardProps): React.ReactNode {
  const { t } = useTranslation();
  const catColor = getCategoryColor(definition.category);
  const label = localizedCategoryLabel(t, definition.category);
  const name = localizedProgramName(t, definition.id, definition.name);
  const description = localizedProgramDescription(t, definition.id, definition.description);
  const resolvedDisabledLabel = disabledLabel ?? t('programs.card.coming_soon');
  const estimatedWeeks = Math.ceil(definition.totalWorkouts / definition.workoutsPerWeek);

  const baseCtaClasses =
    'min-h-11 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] border cursor-pointer transition-colors text-center';
  const primaryCtaClass = `${baseCtaClasses} bg-accent text-on-accent border-accent hover:bg-accent-hover`;
  const secondaryCtaClass = `${baseCtaClasses} bg-transparent text-main border-rule-light hover:border-accent hover:text-accent`;
  const ctaClasses = `mt-auto ${isActive ? primaryCtaClass : secondaryCtaClass}`;

  const showDualActions = previewTo !== undefined && onSelect !== undefined && !disabled;
  const showCta =
    showDualActions ||
    previewTo !== undefined ||
    to !== undefined ||
    onSelect !== undefined ||
    disabled;

  return (
    <div
      className={`card group relative h-full overflow-hidden border border-rule bg-card/70 transition-colors hover:border-accent/60 hover:bg-card ${disabled ? 'opacity-60' : ''}`}
    >
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-px opacity-70 transition-all group-hover:w-[3px]"
        style={{ background: catColor.badge, opacity: 0.5 }}
      />

      <div className="relative flex h-full flex-col p-5 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="font-mono text-2xs uppercase tracking-[0.22em] text-muted">
            {ordinal !== undefined ? String(ordinal).padStart(2, '0') : 'GR'}
          </span>
          <span
            className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.16em] px-2 py-[3px] border rounded-[1px]"
            style={{
              borderColor: `color-mix(in srgb, ${catColor.badge} 40%, transparent)`,
              color: catColor.badge,
            }}
          >
            {label}
          </span>
        </div>

        <h3 className="max-w-[90%] font-display text-2xl leading-[1.05] tracking-[0.02em] text-main sm:text-3xl">
          {name}
        </h3>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted">{description}</p>

        {!disabled && (
          <div className="my-6 grid grid-cols-3 border-y border-rule/70">
            <div className="py-3 pr-3">
              <span className="block font-display-data text-2xl leading-none text-title">
                {definition.workoutsPerWeek}
              </span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-muted">
                {t('programs.card.days_week')}
              </span>
            </div>
            <div className="border-x border-rule/70 px-3 py-3">
              <span className="block font-display-data text-2xl leading-none text-title">
                {estimatedWeeks}
              </span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-muted">
                {t('programs.card.weeks')}
              </span>
            </div>
            <div className="py-3 pl-3">
              <span className="block font-display-data text-2xl leading-none text-title">
                {definition.totalWorkouts}
              </span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-muted">
                {t('programs.card.sessions')}
              </span>
            </div>
          </div>
        )}

        {definition.author && (
          <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.14em] text-info">
            {t('programs.card.author', { author: definition.author })}
          </p>
        )}

        {showDualActions ? (
          <div className="mt-auto flex flex-col gap-2">
            <Link
              to={previewTo}
              className={primaryCtaClass}
              aria-label={t('catalog.card.view_program_aria', { name })}
            >
              {t('programs.card.explore')} <span aria-hidden="true">→</span>
            </Link>
            <button
              onClick={onSelect}
              className="min-h-10 font-mono text-2xs uppercase tracking-wider text-muted hover:text-main"
            >
              {isActive ? t('programs.card.continue_training') : t('programs.card.start_directly')}
            </button>
          </div>
        ) : showCta ? (
          previewTo !== undefined ? (
            <Link
              to={previewTo}
              className={`${primaryCtaClass} mt-auto`}
              aria-label={t('catalog.card.view_program_aria', { name })}
            >
              {t('programs.card.explore')} <span aria-hidden="true">→</span>
            </Link>
          ) : to !== undefined ? (
            <Link
              to={to}
              className={ctaClasses}
              aria-label={t('catalog.card.view_program_aria', { name })}
            >
              {t('programs.card.view_program')}
            </Link>
          ) : (
            <button
              onClick={onSelect}
              disabled={disabled}
              className={`${ctaClasses} disabled:opacity-30 disabled:cursor-not-allowed ${
                !isActive ? 'disabled:hover:bg-btn disabled:hover:text-btn-text' : ''
              }`}
            >
              {disabled
                ? resolvedDisabledLabel
                : isActive
                  ? t('programs.card.continue_training')
                  : t('programs.card.start_program')}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
