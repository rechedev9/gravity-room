import { KpiCard } from './kpi-card';

interface KpiStripProps {
  readonly streakDays: number;
  readonly totalSessions: number;
  readonly weekPr?: { readonly lift: string; readonly weight: number } | null;
}

export function KpiStripBrutalist({
  streakDays,
  totalSessions,
  weekPr,
}: KpiStripProps): React.ReactNode {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <KpiCard
        label="RACHA"
        value={streakDays}
        sub={streakDays === 1 ? 'día' : 'días'}
        variant={streakDays >= 10 ? 'flame' : 'default'}
      />
      <KpiCard label="SESIONES" value={totalSessions} sub="completadas" />
      <KpiCard
        label="PR ESTA SEM"
        value={weekPr ? `${weekPr.weight}kg` : '—'}
        sub={weekPr ? weekPr.lift : 'sin PR esta semana'}
        accent={!!weekPr}
      />
    </div>
  );
}
