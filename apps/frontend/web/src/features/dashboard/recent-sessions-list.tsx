interface SessionRow {
  readonly dateLabel: string;
  readonly dayIndex: number;
  readonly summary: string;
}

interface RecentSessionsListProps {
  readonly sessions: readonly SessionRow[];
}

export function RecentSessionsList({ sessions }: RecentSessionsListProps): React.ReactNode {
  if (sessions.length === 0) {
    return (
      <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-6 text-center">
        <p className="chalk-stamp text-label">ACTIVIDAD RECIENTE</p>
        <p className="text-main font-display text-2xl mt-3">AÚN NO HAY ENTRENAMIENTOS</p>
        <p className="text-muted text-sm mt-1">Día uno te espera.</p>
      </section>
    );
  }

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">ACTIVIDAD RECIENTE</p>
      <ul className="divide-y divide-rule">
        {sessions.map((s, i) => (
          <li key={i} className="py-2.5 text-sm flex items-center gap-3">
            <span className="font-mono text-muted text-xs w-24 shrink-0">{s.dateLabel}</span>
            <span className="font-mono text-label text-xs w-12 shrink-0">D{s.dayIndex}</span>
            <span className="text-main truncate">{s.summary}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
