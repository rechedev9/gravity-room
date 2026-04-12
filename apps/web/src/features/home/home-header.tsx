interface HomeHeaderProps {
  readonly userName: string | null;
  readonly streakDays: number | null;
  readonly daysSinceLast: number | null;
}

function formatDaysAgo(days: number): string {
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} dias`;
}

export function HomeHeader({
  userName,
  streakDays,
  daysSinceLast,
}: HomeHeaderProps): React.ReactNode {
  const hasStats = streakDays !== null || daysSinceLast !== null;

  return (
    <header>
      <h1 className="font-display text-xl sm:text-2xl text-title tracking-wide">
        {userName ? `Bienvenido, ${userName}` : 'Bienvenido a Gravity Room'}
      </h1>
      {hasStats && (
        <p className="font-mono text-[11px] text-muted mt-1 tracking-wide">
          {streakDays !== null && streakDays > 0 && (
            <span>
              Racha: {streakDays}
              {daysSinceLast !== null && ' · '}
            </span>
          )}
          {daysSinceLast !== null && <span>Ultima sesion: {formatDaysAgo(daysSinceLast)}</span>}
        </p>
      )}
    </header>
  );
}
