import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { Link } from 'react-router-dom';
import { KpiSummary } from './kpi-summary';
import { ActiveProgramCard } from './active-program-card';

export function DashboardPage(): React.ReactNode {
  const { user } = useAuth();
  const { isGuest } = useGuest();

  useEffect(() => {
    document.title = 'Dashboard — Gravity Room';
    return () => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, []);

  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });

  const programs = programsQuery.data ?? [];
  const activeProgram = programs.find((p) => p.status === 'active') ?? null;

  const hasPrograms = !isGuest && programs.length > 0;

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <header className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-title tracking-wide">
              Dashboard
            </h1>
            <p className="text-xs text-muted mt-0.5">Rendimiento y progreso de entrenamiento</p>
          </div>
        </header>

        {/* KPI row */}
        {hasPrograms && <KpiSummary programs={programs} />}

        {programsQuery.isLoading && !isGuest && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-card border border-rule p-4 sm:p-5 animate-pulse">
                <div className="h-2.5 w-20 bg-rule rounded mb-3" />
                <div className="h-7 w-16 bg-rule rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Active program */}
        {activeProgram ? (
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div>
              <h2 className="dash-section-title mb-3">Programa Activo</h2>
              <ActiveProgramCard
                program={activeProgram}
                onOrphanDeleted={() => void programsQuery.refetch()}
              />
            </div>
          </div>
        ) : (
          !isGuest &&
          !programsQuery.isLoading && (
            <div className="bg-card border border-rule p-8 text-center mb-6">
              <img
                src="/empty-dashboard.webp"
                alt=""
                className="w-full max-w-sm mx-auto mb-5 opacity-80"
                loading="lazy"
              />
              <p className="text-sm text-muted mb-4">
                Elige un programa para ver tus métricas aquí.
              </p>
              <Link
                to="/app/programs"
                className="inline-block px-4 py-2 text-xs font-bold uppercase tracking-wide text-btn-active-text bg-btn-active border-2 border-btn-ring hover:opacity-90 transition-opacity"
              >
                Ver Programas
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );
}
