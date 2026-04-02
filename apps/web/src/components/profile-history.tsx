import type { ProgramSummary } from '@/lib/api-functions';
import { DashboardCard } from './dashboard-card';
import { Button } from './button';

const completedBadgeStyle = {
  background: 'rgba(200,168,78,0.08)',
  border: '1px solid rgba(200,168,78,0.2)',
} as const;

interface ProfileHistoryProps {
  readonly completedPrograms: readonly ProgramSummary[];
  readonly effectiveInstanceId: string | undefined;
  readonly onSelectInstance: (id: string | undefined) => void;
}

export function ProfileHistory({
  completedPrograms,
  effectiveInstanceId,
  onSelectInstance,
}: ProfileHistoryProps): React.ReactNode {
  if (completedPrograms.length === 0) return null;

  return (
    <div className="mt-6">
      <DashboardCard title="Historial">
        <div className="flex flex-col gap-2">
          {completedPrograms.map((p) => (
            <div
              key={p.id}
              className="border border-rule px-4 py-3 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-title truncate">{p.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  Completado el{' '}
                  {new Date(p.updatedAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.id !== effectiveInstanceId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onSelectInstance(p.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Ver estadísticas
                  </Button>
                )}
                <span
                  className="shrink-0 font-mono text-2xs tracking-widest uppercase px-2 py-1 text-title"
                  style={completedBadgeStyle}
                >
                  Completado
                </span>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
