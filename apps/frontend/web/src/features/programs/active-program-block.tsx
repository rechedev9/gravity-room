import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { ProgressBar } from '@/components/progress-bar';
import { localizedProgramName } from '@/lib/catalog-display';

interface ActiveProgramBlockProps {
  /** Catalog program id — used for the localized name and the tracker link. */
  readonly programId: string;
  /** Stored (un-localized) program name — fallback when no catalog translation exists. */
  readonly name: string;
  /** Completed workouts so far. */
  readonly completed: number;
  /** Total workouts in the program (0 until the definition loads). */
  readonly total: number;
}

/**
 * Top-of-catalog block surfacing the user's currently active program with its
 * progress and a shortcut back into the tracker. Without this the catalog only
 * rendered "Other Programs" — a dangling heading — because the active program
 * is filtered out of the grid (see programs-page.tsx).
 */
export function ActiveProgramBlock({
  programId,
  name,
  completed,
  total,
}: ActiveProgramBlockProps): React.ReactNode {
  const { t } = useTranslation();
  const displayName = localizedProgramName(t, programId, name);

  return (
    <section className="mb-10">
      <h2 className="dash-section-title mb-4">{t('programs.active_heading')}</h2>
      <div className="bg-card border border-rule rounded-[var(--radius-base)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-display text-2xl sm:text-3xl text-main leading-none tracking-[0.02em]">
              {displayName}
            </h3>
            {total > 0 && (
              <p className="mt-1.5 font-mono text-xs text-muted">
                {t('programs.active_workout', { completed, total })}
              </p>
            )}
          </div>
          <Link
            to="/app/tracker"
            className="shrink-0 px-4 py-2.5 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] border rounded-[var(--radius-base)] cursor-pointer transition-colors bg-accent text-on-accent border-accent-hover hover:bg-accent-hover"
          >
            {t('programs.active_cta')}
          </Link>
        </div>
        {total > 0 && (
          <ProgressBar
            completed={completed}
            total={total}
            ariaLabel={t('programs.active_progress_aria')}
            showPercent
            className="mt-4"
          />
        )}
      </div>
    </section>
  );
}
