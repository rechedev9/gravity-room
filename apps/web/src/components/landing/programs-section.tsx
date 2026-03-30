import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import type { CatalogEntry } from '@/lib/api-functions';
import { FadeUp, StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import {
  SectionHeader,
  SECTION_PAD,
  ProgramCardSkeleton,
  categoryLabel,
  getCategoryColor,
  estimatedWeeks,
  MAX_LANDING_PROGRAMS,
} from './shared';

interface ProgramsSectionProps {
  readonly catalogQuery: UseQueryResult<readonly CatalogEntry[]>;
}

export function ProgramsSection({ catalogQuery }: ProgramsSectionProps): React.ReactNode {
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
            label="Catálogo"
            headingId="programs-heading"
            title="Elige Tu Programa"
            subtitle="Programas de entrenamiento con progresión automática. Elige el que se adapte a tus objetivos."
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
                return (
                  <StaggerItem key={program.id}>
                    <Link
                      to={`/programs/${program.id}`}
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
                          {categoryLabel(program.category)}
                        </span>
                      </div>

                      <div className="relative">
                        <h3 className="font-display text-center text-3xl mb-1 tracking-wide text-title">
                          {program.name}
                        </h3>

                        <p className="font-mono text-center text-[11px] tracking-wider uppercase mb-4 text-muted">
                          por {program.author}
                        </p>

                        <p className="text-sm text-center leading-relaxed mb-6 line-clamp-2 text-muted">
                          {program.description}
                        </p>

                        <div className="flex flex-wrap justify-center gap-2">
                          {(() => {
                            const weeks = estimatedWeeks(
                              program.totalWorkouts,
                              program.workoutsPerWeek
                            );
                            return [
                              `${program.workoutsPerWeek} días/semana`,
                              ...(weeks > 0 ? [`${weeks} semanas`] : []),
                            ];
                          })().map((pill) => (
                            <span
                              key={pill}
                              className="font-mono text-[10px] tracking-wider uppercase px-3 py-1 border border-rule-light bg-body text-muted"
                            >
                              {pill}
                            </span>
                          ))}
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
                  Ver los {catalog.length} programas →
                </Link>
              </div>
            )}
          </>
        )}

        {catalogQuery.isError && (
          <p className="text-sm text-center text-muted">No se pudieron cargar los programas.</p>
        )}
      </div>
    </section>
  );
}
