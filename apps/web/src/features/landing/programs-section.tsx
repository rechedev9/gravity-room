import { Link } from '@tanstack/react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CatalogEntry } from '@/lib/api-functions';
import { FadeUp, StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import {
  localizedCategoryLabel,
  localizedProgramDescription,
  localizedProgramName,
} from '@/lib/catalog-display';
import {
  SectionHeader,
  SECTION_PAD,
  ProgramCardSkeleton,
  getCategoryColor,
  estimatedWeeks,
  MAX_LANDING_PROGRAMS,
} from './shared';
import type { ProgramsContent } from './content';

interface ProgramsSectionProps {
  readonly catalogQuery: UseQueryResult<readonly CatalogEntry[]>;
  readonly content: ProgramsContent;
}

export function ProgramsSection({ catalogQuery, content }: ProgramsSectionProps): React.ReactNode {
  const { t } = useTranslation();
  const catalog = catalogQuery.data;

  return (
    <section
      id="programs"
      aria-labelledby="programs-heading"
      className={`${SECTION_PAD} bg-header`}
    >
      <div className="max-w-4xl mx-auto">
        <FadeUp>
          <SectionHeader
            label={content.sectionLabel}
            headingId="programs-heading"
            title={content.title}
            subtitle={content.subtitle}
          />
        </FadeUp>

        {catalogQuery.isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-rule">
            <ProgramCardSkeleton />
            <ProgramCardSkeleton />
            <ProgramCardSkeleton />
          </div>
        )}

        {catalog && catalog.length > 0 && (
          <>
            <StaggerContainer
              stagger={0.06}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-rule"
            >
              {catalog.slice(0, MAX_LANDING_PROGRAMS).map((program) => {
                const catColor = getCategoryColor(program.category);
                const weeks = estimatedWeeks(program.totalWorkouts, program.workoutsPerWeek);
                const levelCount =
                  program.level === 'beginner' ? 1 : program.level === 'intermediate' ? 2 : 3;
                const levelLabel =
                  program.level === 'beginner'
                    ? content.levelLabels.beginner
                    : program.level === 'intermediate'
                      ? content.levelLabels.intermediate
                      : content.levelLabels.advanced;
                return (
                  <StaggerItem key={program.id}>
                    <Link
                      to="/programs/$programId"
                      params={{ programId: program.id }}
                      className="relative block bg-card p-8 landing-card-glow program-card-lift group cursor-pointer no-underline text-inherit h-full"
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
                        style={{
                          background: `linear-gradient(180deg, ${catColor.gradient}, transparent)`,
                        }}
                      />

                      <div className="relative flex justify-center mb-5">
                        <span
                          className="font-mono text-[10px] tracking-[0.2em] uppercase px-3 py-1 border"
                          style={{
                            borderColor: `color-mix(in srgb, ${catColor.badge} 40%, transparent)`,
                            color: catColor.badge,
                          }}
                        >
                          {localizedCategoryLabel(t, program.category)}
                        </span>
                      </div>

                      <div className="relative">
                        <h3 className="font-display text-center text-3xl mb-1 tracking-wide text-title">
                          {localizedProgramName(t, program.id, program.name)}
                        </h3>

                        <p className="font-mono text-center text-[11px] tracking-wider uppercase mb-4 text-muted">
                          {content.by} {program.author}
                        </p>

                        <p className="text-sm text-center leading-relaxed mb-6 line-clamp-2 text-muted">
                          {localizedProgramDescription(t, program.id, program.description)}
                        </p>

                        <div className="flex flex-wrap justify-center gap-2">
                          <span className="font-mono text-[10px] tracking-wider uppercase px-3 py-1 border border-rule-light bg-body text-muted">
                            {program.workoutsPerWeek} {content.daysPerWeek}
                          </span>
                          {weeks > 0 && (
                            <span className="font-mono text-[10px] tracking-wider uppercase px-3 py-1 border border-rule-light bg-body text-muted">
                              {weeks} {content.weeks}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-rule">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor: catColor.badge,
                                opacity: i <= levelCount ? 0.8 : 0.2,
                              }}
                            />
                          ))}
                          <span
                            className="font-mono text-[9px] tracking-wider uppercase ml-1"
                            style={{ color: catColor.badge, opacity: 0.65 }}
                          >
                            {levelLabel}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
            {catalog.length > MAX_LANDING_PROGRAMS && (
              <div className="text-center mt-8">
                <Link
                  to="/login"
                  className="font-mono text-sm tracking-wider uppercase text-muted hover:text-accent transition-colors"
                >
                  {content.moreProgramsFn(catalog.length)}
                </Link>
              </div>
            )}
          </>
        )}

        {catalogQuery.isError && (
          <p className="text-sm text-center text-muted">{content.errorText}</p>
        )}
      </div>
    </section>
  );
}
