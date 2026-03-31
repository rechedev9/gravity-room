import type { InsightItem } from '@/lib/api-functions';

interface FrequencyPayload {
  sessionsPerWeek: number;
  currentStreak: number;
  consistencyPct: number;
  totalSessions: number;
}

function isFrequencyPayload(v: unknown): v is FrequencyPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'sessionsPerWeek' in v &&
    typeof v.sessionsPerWeek === 'number' &&
    'currentStreak' in v &&
    typeof v.currentStreak === 'number' &&
    'consistencyPct' in v &&
    typeof v.consistencyPct === 'number'
  );
}

interface FrequencyCardProps {
  readonly insight: InsightItem;
}

export function FrequencyCard({ insight }: FrequencyCardProps): React.ReactNode {
  const payload = insight.payload;
  if (!isFrequencyPayload(payload)) return null;

  return (
    <div className="bg-card border border-rule card p-5">
      <h3 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-4">
        Frecuencia
      </h3>
      <div className="grid grid-cols-3 divide-x divide-rule">
        <div className="pr-4 text-center">
          <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
            Sesiones/sem
          </p>
          <p className="font-display-data text-2xl text-main">{payload.sessionsPerWeek}</p>
        </div>
        <div className="px-4 text-center">
          <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">Racha</p>
          <p className="font-display-data text-2xl text-title">{payload.currentStreak}</p>
        </div>
        <div className="pl-4 text-center">
          <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
            Consistencia
          </p>
          <p className="font-display-data text-2xl text-main">{payload.consistencyPct}%</p>
        </div>
      </div>
      <p className="font-mono text-[9px] text-muted text-right mt-3">
        {payload.totalSessions} sesiones totales
      </p>
    </div>
  );
}
