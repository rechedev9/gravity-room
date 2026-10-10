import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { ProgramCover } from '@/components/program-cover';
import { localizedProgramDescription, localizedProgramName } from '@/lib/catalog-display';

/** Minimal program info needed by ProgramCard — compatible with both CatalogEntry and ProgramDefinition. */
export interface ProgramCardInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly level?: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly author: string;
}

interface ProgramCardProps {
  readonly definition: ProgramCardInfo;
  readonly disabled?: boolean;
  readonly disabledLabel?: string;
  readonly isActive?: boolean;
  readonly onSelect?: () => void;
  readonly previewTo?: string;
  readonly to?: string;
}

export function ProgramCard({
  definition,
  disabled = false,
  disabledLabel,
  isActive = false,
  onSelect,
  previewTo,
  to,
}: ProgramCardProps): React.ReactNode {
  const { t } = useTranslation();
  const name = localizedProgramName(t, definition.id, definition.name);
  const description = localizedProgramDescription(t, definition.id, definition.description);
  const resolvedDisabledLabel = disabledLabel ?? t('programs.card.coming_soon');
  const actionAriaLabel = isActive
    ? t('programs.card.continue_training_aria', { name })
    : t('programs.card.start_program_aria', { name });

  const baseCtaClasses =
    'type-button px-4 py-2.5 border rounded-[var(--radius-base)] cursor-pointer transition-colors text-center';
  const primaryCtaClass = `${baseCtaClasses} bg-accent text-on-accent border-accent-hover hover:bg-accent-hover`;
  const secondaryCtaClass = `${baseCtaClasses} bg-transparent text-main border-rule-light hover:border-accent-deep hover:text-accent`;
  const ctaClasses = `mt-auto ${isActive ? primaryCtaClass : secondaryCtaClass}`;

  const showDualActions = previewTo !== undefined && onSelect !== undefined && !disabled;
  const showCta = showDualActions || to !== undefined || onSelect !== undefined || disabled;

  const levelLabel =
    definition.level === undefined ? undefined : t(`programs.card.level_${definition.level}`);
  const meta = [
    definition.workoutsPerWeek > 0
      ? t('programs.card.frequency', { count: definition.workoutsPerWeek })
      : undefined,
    levelLabel,
  ].filter((part): part is string => part !== undefined);

  return (
    <div
      className={`relative overflow-hidden bg-card rounded-card border border-rule p-4 sm:p-5 card program-card-lift flex gap-4 ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="w-24 shrink-0 self-start overflow-hidden rounded-[12px] border border-rule sm:w-28">
        <ProgramCover
          variant="thumbnail"
          programId={definition.id}
          title={definition.name}
          category={definition.category}
          level={definition.level}
          workoutsPerWeek={definition.workoutsPerWeek}
        />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col gap-2.5">
        <div>
          <h3 className="type-title text-main text-base sm:text-[17px] leading-snug">{name}</h3>
          {meta.length > 0 && <p className="mt-1 text-xs text-muted">{meta.join(' · ')}</p>}
        </div>

        <p className="text-xs text-muted leading-relaxed line-clamp-2">{description}</p>

        {!disabled && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-info">
            <span>{t('programs.card.workouts_count', { count: definition.totalWorkouts })}</span>
            {definition.author && (
              <span>{t('programs.card.author', { author: definition.author })}</span>
            )}
          </div>
        )}

        {/* CTA — one primary action per card (outline, never gold in the
            catalog; gold is reserved for the single active-program CTA in
            ActiveProgramBlock), with the detail read demoted to a plain
            text link. Mirrors the pattern adopted in step-program.tsx. */}
        {showDualActions ? (
          <div className="mt-auto flex flex-wrap items-center gap-4">
            <button
              onClick={onSelect}
              className={isActive ? primaryCtaClass : secondaryCtaClass}
              aria-label={actionAriaLabel}
            >
              {isActive ? t('programs.card.continue_training') : t('programs.card.start_program')}
            </button>
            <Link
              to={previewTo}
              className="type-button text-muted underline-offset-4 hover:text-main hover:underline"
              aria-label={t('catalog.card.view_program_aria', { name })}
            >
              {t('programs.card.preview')}
            </Link>
          </div>
        ) : showCta ? (
          to !== undefined ? (
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
              aria-label={disabled ? undefined : actionAriaLabel}
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
