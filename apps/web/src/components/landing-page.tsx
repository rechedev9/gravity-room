import { Link } from 'react-router-dom';
import { FEATURES, STEPS, SCIENCE_CARDS } from '@/lib/landing-page-data';
import { useQuery } from '@tanstack/react-query';
import { fetchCatalogList } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { useFadeInOnScroll } from '@/hooks/use-fade-in-on-scroll';
import { useScrollSpy } from '@/hooks/use-scroll-spy';
import { useOnlineCount } from '@/hooks/use-online-count';

const DISCORD_URL = 'https://discord.gg/FXNBrgYf7U';

function DiscordIcon({ className }: { readonly className?: string }): React.ReactNode {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.102 18.08.114 18.1.13 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const SECTION_IDS = ['features', 'how-it-works', 'programs'] as const;

const NAV_LINKS = [
  { label: 'Características', href: '#features' },
  { label: 'Cómo Funciona', href: '#how-it-works' },
  { label: 'Programas', href: '#programs' },
] as const;

/* ── Gradient Divider ──────────────────────────── */

function GradientDivider(): React.ReactNode {
  return <div className="landing-gradient-divider" />;
}

/* ── Section label ─────────────────────────────── */

function SectionLabel({ children }: { readonly children: string }): React.ReactNode {
  return <div className="section-label mb-12">{children}</div>;
}

/* ── Program Catalog Helpers ──────────────────── */

const MAX_LANDING_PROGRAMS = 6;
const CATALOG_STALE_TIME = 5 * 60 * 1000;

function categoryLabel(category: string): string {
  switch (category) {
    case 'strength':
      return 'Fuerza';
    case 'hypertrophy':
      return 'Hipertrofia';
    case 'powerlifting':
      return 'Powerlifting';
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

function estimatedWeeks(totalWorkouts: number, workoutsPerWeek: number): number {
  if (workoutsPerWeek <= 0) return 0;
  return Math.ceil(totalWorkouts / workoutsPerWeek);
}

function ProgramCardSkeleton(): React.ReactNode {
  return (
    <div className="bg-card p-8 animate-pulse">
      <div className="flex justify-center mb-5">
        <div className="w-20 h-5 bg-rule rounded-sm" />
      </div>
      <div className="h-8 bg-rule rounded-sm mx-auto w-2/3 mb-2" />
      <div className="h-3 bg-rule rounded-sm mx-auto w-1/3 mb-5" />
      <div className="space-y-2 mb-6">
        <div className="h-3 bg-rule rounded-sm w-full" />
        <div className="h-3 bg-rule rounded-sm w-4/5 mx-auto" />
      </div>
      <div className="flex justify-center gap-2">
        <div className="h-5 w-16 bg-rule rounded-sm" />
        <div className="h-5 w-20 bg-rule rounded-sm" />
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────── */

export function LandingPage(): React.ReactNode {
  const observe = useFadeInOnScroll();
  const activeSection = useScrollSpy(SECTION_IDS);

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: CATALOG_STALE_TIME,
  });
  const catalog = catalogQuery.data;
  const programCount = catalog?.length ?? 0;
  const minDaysPerWeek =
    catalog && catalog.length > 0 ? Math.min(...catalog.map((p) => p.workoutsPerWeek)) : 0;
  const onlineCount = useOnlineCount();

  return (
    <div className="grain-overlay min-h-dvh bg-body overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-btn-active focus:text-btn-active-text focus:text-sm focus:font-bold"
      >
        Ir al contenido
      </a>

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav
        aria-label="Navegación principal"
        className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 bg-header/95 backdrop-blur-md border-b border-rule"
      >
        <div className="flex items-center gap-3">
          <img
            src="/logo-64.webp"
            alt="Gravity Room logo"
            width={32}
            height={32}
            className="rounded-full"
          />
          <span className="text-sm font-bold tracking-tight text-title">Gravity Room</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`font-mono text-xs font-semibold tracking-widest uppercase transition-colors duration-200 ${
                activeSection === link.href.slice(1) ? 'text-title' : 'text-muted hover:text-title'
              }`}
              style={{ fontSize: '11px' }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Únete a la comunidad en Discord"
            className="flex items-center gap-2 text-muted hover:text-[#5865F2] transition-colors duration-200"
          >
            <DiscordIcon className="w-4 h-4" />
            <span
              className="hidden md:inline font-mono font-semibold tracking-widest uppercase"
              style={{ fontSize: '11px' }}
            >
              Discord
            </span>
          </a>
          <Link
            to="/login"
            className="font-mono text-xs font-bold tracking-widest uppercase text-btn-text border border-btn-ring px-5 py-2.5 hover:bg-btn-active hover:text-btn-active-text hover:shadow-[0_0_20px_rgba(232,170,32,0.25)] transition-all duration-200"
          >
            Iniciar Sesión →
          </Link>
        </div>
      </nav>

      <main id="main-content">
        {/* ── Hero ────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative px-6 pt-24 pb-20 sm:pt-32 sm:pb-28 overflow-hidden"
        >
          {/* Background glow */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(232,170,32,0.08) 0%, transparent 65%)',
            }}
          />

          {/* Vertical accent lines */}
          <div
            className="absolute left-[8%] top-0 bottom-0 w-px pointer-events-none hidden lg:block"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, var(--color-rule) 30%, var(--color-rule) 70%, transparent 100%)',
            }}
          />
          <div
            className="absolute right-[8%] top-0 bottom-0 w-px pointer-events-none hidden lg:block"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, var(--color-rule) 30%, var(--color-rule) 70%, transparent 100%)',
            }}
          />

          <div className="landing-fade-in landing-visible max-w-4xl mx-auto text-center">
            {/* Eyebrow */}
            <div className="font-mono inline-flex items-center gap-3 mb-8 px-4 py-2 border border-rule-light bg-card">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-muted">
                100% Gratis &middot; Sincroniza entre Dispositivos
              </span>
            </div>

            {/* Main headline — Bebas Neue massive */}
            <h1
              id="hero-heading"
              className="font-display mb-6 leading-none tracking-wide text-title"
              style={{
                fontSize: 'clamp(72px, 12vw, 140px)',
                letterSpacing: '0.02em',
              }}
            >
              Entrena Mejor.
              <br />
              <span className="text-main" style={{ opacity: 0.9 }}>
                Progresa Más Rápido.
              </span>
            </h1>

            <p className="text-base sm:text-lg max-w-xl mx-auto mb-12 leading-relaxed text-muted">
              Deja de adivinar en el gimnasio. Sigue programas probados que ajustan automáticamente
              el peso, series y repeticiones — para que cada sesión te haga avanzar.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="font-mono px-10 py-4 text-sm font-bold tracking-widest uppercase border-2 border-btn-ring bg-btn-active text-btn-active-text hover:shadow-[0_0_32px_rgba(232,170,32,0.35)] transition-all duration-300 min-w-[220px]"
              >
                Comenzar →
              </Link>
              <a
                href="#how-it-works"
                className="font-mono px-10 py-4 text-sm font-bold tracking-widest uppercase border-2 border-rule text-muted hover:border-rule-light hover:text-main transition-all duration-300 min-w-[220px]"
              >
                Cómo Funciona
              </a>
            </div>

            {/* Hero illustration */}
            <div className="mt-16 relative max-w-2xl mx-auto">
              <div
                className="absolute inset-0 -m-4 rounded-lg pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(232,170,32,0.12) 0%, transparent 70%)',
                }}
              />
              <img
                src="/hero.webp"
                alt="Gravity Room — training chamber with gravity levels"
                width={1024}
                height={572}
                className="relative w-full h-auto rounded-sm border border-rule shadow-2xl"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </section>

        <GradientDivider />

        {/* ── Metrics Banner ─────────────────────────────── */}
        <section
          aria-label="Métricas del programa"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-20 bg-header"
        >
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-rule">
            {[
              {
                value: programCount > 0 ? String(programCount) : '—',
                label: 'Programas Disponibles',
                suffix: '',
              },
              { value: '100%', label: 'Gratis', suffix: '' },
              {
                value: minDaysPerWeek > 0 ? `Desde ${minDaysPerWeek}` : '—',
                label: 'Días por Semana',
                suffix: '',
              },
              {
                value: onlineCount !== null ? String(onlineCount) : '—',
                label: 'Online Ahora',
                suffix: '',
              },
            ].map((m) => (
              <div key={m.label} className="text-center px-6 sm:px-10 py-5 sm:py-0">
                <div
                  className="font-display hero-number-glow leading-none mb-2 text-title"
                  style={{
                    fontSize: 'clamp(52px, 7vw, 88px)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {m.value}
                  {m.suffix && (
                    <span className="text-3xl sm:text-4xl ml-1 text-muted">{m.suffix}</span>
                  )}
                </div>
                <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <GradientDivider />

        {/* ── Features ────────────────────────────────────── */}
        <section
          id="features"
          aria-labelledby="features-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 max-w-5xl mx-auto"
        >
          <SectionLabel>Características</SectionLabel>
          <h2
            id="features-heading"
            className="font-display text-center mb-4 leading-none text-title"
            style={{
              fontSize: 'clamp(40px, 6vw, 72px)',
              letterSpacing: '0.02em',
            }}
          >
            Todo lo que Necesitas
          </h2>
          <p
            className="text-center mb-16 max-w-md mx-auto text-muted"
            style={{
              fontSize: '15px',
              lineHeight: 1.7,
            }}
          >
            Sin relleno. Solo herramientas enfocadas que hacen que cada repetición cuente.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-rule">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="relative bg-card p-6 transition-all landing-card-glow group"
                style={{ borderTop: '2px solid transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderTopColor = 'var(--color-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderTopColor = 'transparent';
                }}
              >
                <div className="mb-5 group-hover:scale-110 transition-transform duration-300 origin-left text-accent">
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold mb-2 uppercase tracking-wider text-main">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <GradientDivider />

        {/* ── How It Works ────────────────────────────────── */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 bg-header"
        >
          <div className="max-w-4xl mx-auto">
            <SectionLabel>Cómo Funciona</SectionLabel>
            <h2
              id="how-it-works-heading"
              className="font-display text-center mb-4 leading-none text-title"
              style={{
                fontSize: 'clamp(40px, 6vw, 72px)',
                letterSpacing: '0.02em',
              }}
            >
              Tres Pasos. Eso es Todo.
            </h2>
            <p
              className="text-center mb-16 max-w-lg mx-auto text-muted"
              style={{
                fontSize: '15px',
                lineHeight: 1.7,
              }}
            >
              Sin configuración complicada. Sin hojas de cálculo. Solo elige tus pesos y entrena.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-12">
              {STEPS.map((s) => (
                <div key={s.num} className="relative">
                  {/* Giant step number */}
                  <div
                    className="font-display absolute -top-4 -left-2 select-none pointer-events-none text-accent"
                    style={{
                      fontSize: '96px',
                      lineHeight: 1,
                      opacity: 0.12,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {s.num}
                  </div>
                  <div className="relative z-10">
                    <div
                      className="font-display text-5xl font-bold mb-3 text-accent"
                      style={{
                        opacity: 0.6,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {s.num}
                    </div>
                    <h3 className="text-base font-bold mb-3 uppercase tracking-wide text-main">
                      {s.title}
                    </h3>
                    <p className="text-sm leading-relaxed mb-5 text-muted">{s.desc}</p>

                    <blockquote className="landing-quote-glow p-4">
                      <p className="text-sm italic leading-relaxed text-main">{s.quote}</p>
                      <cite className="font-mono text-[11px] not-italic block mt-2 text-muted">
                        {s.source}
                      </cite>
                    </blockquote>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <GradientDivider />

        {/* ── Why Smart Training ──────────────────────────── */}
        <section
          aria-labelledby="smart-training-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 max-w-5xl mx-auto"
        >
          <SectionLabel>La Ciencia</SectionLabel>
          <h2
            id="smart-training-heading"
            className="font-display text-center mb-4 leading-none text-title"
            style={{
              fontSize: 'clamp(40px, 6vw, 72px)',
              letterSpacing: '0.02em',
            }}
          >
            Por Qué el Entrenamiento Inteligente Gana
          </h2>
          <p
            className="text-center mb-16 max-w-lg mx-auto text-muted"
            style={{
              fontSize: '15px',
              lineHeight: 1.7,
            }}
          >
            La mayoría se estanca porque entrena aleatoriamente. Los programas estructurados con
            reglas de progresión integradas son cómo realmente te vuelves más fuerte — de forma
            consistente.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-rule">
            {SCIENCE_CARDS.map((card) => (
              <div
                key={card.title}
                className="relative bg-card p-8 text-center landing-card-glow group cursor-default"
              >
                <div className="mb-5 group-hover:scale-110 transition-transform duration-300 text-accent">
                  {card.icon}
                </div>
                <div className="text-sm font-bold mb-3 uppercase tracking-wider text-main">
                  {card.title}
                </div>
                <p className="text-sm leading-relaxed text-muted">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <GradientDivider />

        {/* ── Programs Catalog ─────────────────────────── */}
        <section
          id="programs"
          aria-labelledby="programs-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 bg-header"
        >
          <div className="max-w-4xl mx-auto">
            <SectionLabel>Catálogo</SectionLabel>
            <h2
              id="programs-heading"
              className="font-display text-center mb-4 leading-none text-title"
              style={{
                fontSize: 'clamp(40px, 6vw, 72px)',
                letterSpacing: '0.02em',
              }}
            >
              Elige Tu Programa
            </h2>
            <p
              className="text-center mb-16 max-w-lg mx-auto text-muted"
              style={{
                fontSize: '15px',
                lineHeight: 1.7,
              }}
            >
              Programas de entrenamiento con progresión automática. Elige el que se adapte a tus
              objetivos.
            </p>
            {catalogQuery.isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-rule">
                <ProgramCardSkeleton />
                <ProgramCardSkeleton />
                <ProgramCardSkeleton />
              </div>
            )}
            {catalog && catalog.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-rule">
                  {catalog.slice(0, MAX_LANDING_PROGRAMS).map((program) => (
                    <Link
                      key={program.id}
                      to={`/programs/${program.id}`}
                      className="relative bg-card p-8 landing-card-glow group cursor-pointer no-underline text-inherit"
                    >
                      {/* Category badge */}
                      <div className="flex justify-center mb-5">
                        <span
                          className="font-mono text-[10px] tracking-[0.2em] uppercase px-3 py-1 border text-accent"
                          style={{
                            borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
                          }}
                        >
                          {categoryLabel(program.category)}
                        </span>
                      </div>

                      {/* Name (Bebas Neue) */}
                      <h3 className="font-display text-center text-3xl mb-1 tracking-wide text-title">
                        {program.name}
                      </h3>

                      {/* Author */}
                      <p className="font-mono text-center text-[11px] tracking-wider uppercase mb-4 text-muted">
                        por {program.author}
                      </p>

                      {/* Description (2 lines max) */}
                      <p className="text-sm text-center leading-relaxed mb-6 line-clamp-2 text-muted">
                        {program.description}
                      </p>

                      {/* Metadata pills */}
                      <div className="flex flex-wrap justify-center gap-2">
                        {[
                          `${program.workoutsPerWeek} días/semana`,
                          ...(estimatedWeeks(program.totalWorkouts, program.workoutsPerWeek) > 0
                            ? [
                                `${estimatedWeeks(program.totalWorkouts, program.workoutsPerWeek)} semanas`,
                              ]
                            : []),
                        ].map((pill) => (
                          <span
                            key={pill}
                            className="font-mono text-[10px] tracking-wider uppercase px-3 py-1 border border-rule-light bg-body text-muted"
                          >
                            {pill}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
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

        <GradientDivider />

        {/* ── Final CTA ───────────────────────────────────── */}
        <section
          ref={observe}
          className="landing-fade-in relative px-6 py-20 sm:py-32 text-center overflow-hidden"
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center bottom, rgba(232,170,32,0.06) 0%, transparent 60%)',
            }}
          />
          <div className="relative z-10 max-w-2xl mx-auto">
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase mb-6 text-muted">
              ¿Listo para subir la gravedad?
            </p>
            <h2
              className="font-display mb-10 leading-none text-title"
              style={{
                fontSize: 'clamp(52px, 8vw, 100px)',
                letterSpacing: '0.02em',
              }}
            >
              Entra a la Gravity Room.
              <br />
              <span className="text-main" style={{ opacity: 0.8 }}>
                Comienza a Entrenar Hoy.
              </span>
            </h2>
            <Link
              to="/login"
              className="font-mono inline-block px-12 py-4 text-sm font-bold tracking-widest uppercase border-2 border-btn-ring bg-btn-active text-btn-active-text hover:shadow-[0_0_48px_rgba(232,170,32,0.4)] transition-all duration-300"
            >
              Comienza Gratis →
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="px-6 sm:px-10 py-10 bg-header border-t border-rule">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold mb-1 text-title">Gravity Room</p>
            <p className="text-xs text-muted">Para atletas que se niegan a estancarse.</p>
          </div>
          <div className="font-mono flex items-center gap-5 text-[11px] text-muted">
            <Link to="/privacy" className="hover:text-main transition-colors">
              Política de Privacidad
            </Link>
            <span aria-hidden="true">&middot;</span>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#5865F2] transition-colors"
            >
              <DiscordIcon className="w-3 h-3" />
              Discord
            </a>
            <span aria-hidden="true">&middot;</span>
            <span>Built by Gravity Room</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
