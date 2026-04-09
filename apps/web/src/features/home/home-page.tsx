import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';
import { Link } from '@tanstack/react-router';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { GuestBanner } from '@/components/guest-banner';
import {
  HomeIcon,
  DashboardIcon,
  TrackerIcon,
  ProgramsIcon,
  AnalyticsIcon,
} from '@/components/layout/sidebar-icons';

interface QuickCardProps {
  readonly to: string;
  readonly title: string;
  readonly description: string;
  readonly Icon: React.ComponentType<{ readonly className?: string }>;
  readonly accent?: boolean;
}

function QuickCard({ to, title, description, Icon, accent }: QuickCardProps): React.ReactNode {
  return (
    <Link
      to={to}
      className="group bg-card border border-rule p-5 flex flex-col gap-3 hover:border-[var(--color-rule-light)] hover:shadow-[var(--shadow-card-hover)] transition-all cursor-pointer"
    >
      <div
        className={`w-9 h-9 flex items-center justify-center border ${
          accent
            ? 'border-accent text-accent bg-[rgba(232,170,32,0.08)]'
            : 'border-rule text-muted group-hover:text-main group-hover:border-rule-light'
        } transition-colors`}
      >
        <Icon />
      </div>
      <div>
        <p
          className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${accent ? 'text-title' : 'text-main group-hover:text-title transition-colors'}`}
        >
          {title}
        </p>
        <p className="text-xs text-muted leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

interface SectionCardProps {
  readonly title: string;
  readonly description: string;
  readonly to: string;
}

function SectionCard({ title, description, to }: SectionCardProps): React.ReactNode {
  return (
    <Link
      to={to}
      className="group bg-card border border-rule px-4 py-3 flex items-start gap-3 hover:bg-[var(--color-sidebar-active)] transition-colors cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-main uppercase tracking-wide group-hover:text-title transition-colors">
          {title}
        </p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
      </div>
      <span className="text-muted text-xs mt-0.5 shrink-0">→</span>
    </Link>
  );
}

export function HomePage(): React.ReactNode {
  const { user } = useAuth();
  const { isGuest } = useGuest();

  useEffect(() => {
    document.title = 'Inicio — Gravity Room';
    return () => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, []);

  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });

  const activeProgram = programsQuery.data?.find((p) => p.status === 'active') ?? null;
  const userName = user?.email?.split('@')[0] ?? null;

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {isGuest && <GuestBanner className="mb-6" />}
        {/* Welcome header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 flex items-center justify-center text-accent">
              <HomeIcon />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-title tracking-wide">
              {userName ? `Bienvenido, ${userName}` : 'Bienvenido a Gravity Room'}
            </h1>
          </div>
          <p className="text-sm text-muted max-w-xl leading-relaxed">
            Tu entrenador de fuerza inteligente. Lleva el registro de tu progresión, detecta mesetas
            y recibe recomendaciones de carga basadas en tus datos reales.
          </p>
        </header>

        {/* Active program mini-status */}
        {programsQuery.isLoading && (
          <div className="bg-card border border-rule p-5 mb-8 animate-pulse">
            <div className="h-3 w-32 bg-rule rounded mb-3" />
            <div className="h-2 w-full bg-rule rounded" />
          </div>
        )}

        {activeProgram && !programsQuery.isLoading && (
          <div className="bg-card border border-rule border-l-2 border-l-accent p-5 mb-8 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-accent uppercase tracking-wide mb-1">
                Programa Activo
              </p>
              <p className="text-sm font-bold text-main truncate">{activeProgram.name}</p>
            </div>
            <Link
              to="/app/tracker/$programId"
              params={{ programId: activeProgram.programId }}
              className="shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wide text-btn-active-text bg-btn-active border-2 border-btn-ring hover:opacity-90 transition-opacity whitespace-nowrap"
              aria-label={`Continuar ${activeProgram.name}`}
            >
              Continuar
            </Link>
          </div>
        )}

        {/* Quick-start cards */}
        <section className="mb-10">
          <h2 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">
            Acceso Rápido
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {activeProgram ? (
              <Link
                to="/app/tracker/$programId"
                params={{ programId: activeProgram.programId }}
                className="group bg-card border border-rule p-5 flex flex-col gap-3 hover:border-[var(--color-rule-light)] hover:shadow-[var(--shadow-card-hover)] transition-all cursor-pointer"
              >
                <div className="w-9 h-9 flex items-center justify-center border border-accent text-accent bg-[rgba(232,170,32,0.08)] transition-colors">
                  <TrackerIcon />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-0.5 text-title">
                    Continuar Entrenamiento
                  </p>
                  <p className="text-xs text-muted leading-relaxed">
                    Registra tu sesión de hoy y avanza en tu programa.
                  </p>
                </div>
              </Link>
            ) : (
              <QuickCard
                to="/app/programs"
                title="Elegir un Programa"
                description="Selecciona un programa de fuerza para comenzar."
                Icon={ProgramsIcon}
                accent
              />
            )}
            <QuickCard
              to="/app/dashboard"
              title="Ver tu Progreso"
              description="KPIs, volumen, frecuencia y recomendaciones de carga."
              Icon={DashboardIcon}
            />
            <QuickCard
              to="/app/analytics"
              title="Analíticas"
              description="Evolución del 1RM, tendencias y pronósticos por ejercicio."
              Icon={AnalyticsIcon}
            />
          </div>
        </section>

        {/* Section overview */}
        <section>
          <h2 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">
            Secciones
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <SectionCard
              to="/app/dashboard"
              title="Dashboard"
              description="Métricas clave, programa activo, alertas de meseta y recomendaciones de carga."
            />
            <SectionCard
              to="/app/tracker"
              title="Tracker"
              description="Registra sets, reps y pesos de cada sesión. Sigue el progreso del programa."
            />
            <SectionCard
              to="/app/programs"
              title="Programas"
              description="Catálogo de programas por nivel. Crea y personaliza tus propios programas."
            />
            <SectionCard
              to="/app/analytics"
              title="Analíticas"
              description="Gráficas de evolución del 1RM estimado y proyecciones de rendimiento."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
