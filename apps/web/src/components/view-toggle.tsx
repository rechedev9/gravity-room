interface ViewToggleProps {
  /** Current effective view mode */
  readonly viewMode: 'card' | 'table';
  /** Callback to toggle view mode */
  readonly onToggle: () => void;
}

export function ViewToggle({ viewMode, onToggle }: ViewToggleProps): React.ReactNode {
  const targetLabel = viewMode === 'card' ? 'Cambiar a vista tabla' : 'Cambiar a vista tarjetas';
  const icon = viewMode === 'card' ? '\u2261' : '\u229E';
  const label = viewMode === 'card' ? 'Tabla' : 'Tarjetas';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={targetLabel}
      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] text-[11px] font-bold uppercase tracking-widest text-muted border border-rule bg-card cursor-pointer transition-all duration-150 hover:text-main hover:border-rule-light active:scale-95"
    >
      {icon} {label}
    </button>
  );
}
