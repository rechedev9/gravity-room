import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { ProgramCover } from '@/components/program-cover';
import { buttonClassName } from '@/components/button';
import { cn } from '@/lib/cn';
import { localizedProgramDescription, localizedProgramName } from '@/lib/catalog-display';
import type { ProgramCardInfo } from './program-card';

interface FeaturedProgramCardProps {
  readonly definition: ProgramCardInfo;
  readonly previewTo: string;
  readonly onSelect: () => void;
}

/** The catalog's lead program: a wide cover with the program's copy, like the mobile Explore hero. */
export function FeaturedProgramCard({
  definition,
  previewTo,
  onSelect,
}: FeaturedProgramCardProps): React.ReactNode {
  const { t } = useTranslation();
  const name = localizedProgramName(t, definition.id, definition.name);
  const description = localizedProgramDescription(t, definition.id, definition.description);
  const level =
    definition.level === undefined ? undefined : t(`programs.card.level_${definition.level}`);
  const meta = [
    definition.workoutsPerWeek > 0
      ? t('programs.card.frequency', { count: definition.workoutsPerWeek })
      : undefined,
    level,
    t('programs.card.workouts_count', { count: definition.totalWorkouts }),
  ].filter((part): part is string => part !== undefined);

  return (
    <article
      data-testid="featured-program"
      className="overflow-hidden rounded-[18px] border border-rule-light bg-card md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="bg-surface-2 md:flex md:items-center">
        <ProgramCover
          variant="cover"
          programId={definition.id}
          title={definition.name}
          category={definition.category}
          level={definition.level}
          workoutsPerWeek={definition.workoutsPerWeek}
        />
      </div>
      <div className="flex flex-col gap-2 p-5 sm:p-6 md:justify-center">
        <p className="type-kicker text-accent tracking-[1.5px]">{t('programs.catalog.featured')}</p>
        <h2 className="type-display-sm sm:type-display text-title">{name}</h2>
        <p className="text-xs text-muted">{meta.join(' · ')}</p>
        <p className="text-sm leading-relaxed text-muted line-clamp-3">{description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
          <button
            type="button"
            onClick={onSelect}
            aria-label={t('programs.card.start_program_aria', { name })}
            className={cn(
              buttonClassName({ variant: 'default' }),
              'border-accent-deep text-accent hover:bg-surface-2'
            )}
          >
            {t('programs.card.start_program')}
          </button>
          <Link
            to={previewTo}
            aria-label={t('catalog.card.view_program_aria', { name })}
            className="type-button inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-main hover:underline"
          >
            {t('programs.card.preview')}
          </Link>
        </div>
      </div>
    </article>
  );
}
