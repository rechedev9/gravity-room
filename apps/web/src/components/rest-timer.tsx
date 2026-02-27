interface RestTimerProps {
  readonly remaining: number;
  readonly onDismiss: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RestTimer({ remaining, onDismiss }: RestTimerProps): React.ReactNode {
  if (remaining <= 0) return null;

  return (
    <div
      data-testid="rest-timer-pill"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[200] pb-[env(safe-area-inset-bottom)] animate-[slideUp_0.2s_ease-out]"
    >
      <div className="flex items-center gap-3 bg-card border border-rule px-5 py-3 mb-4 shadow-lg">
        <span className="font-display-data text-2xl tabular-nums text-accent">
          {formatTime(remaining)}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Cerrar temporizador"
          className="text-muted hover:text-main text-lg leading-none cursor-pointer transition-colors px-1"
        >
          {'\u00d7'}
        </button>
      </div>
    </div>
  );
}
