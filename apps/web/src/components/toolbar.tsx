import { useState, useCallback, type ReactNode } from 'react';
import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';
import { DropdownMenu, DropdownItem } from './dropdown-menu';

interface ToolbarProps {
  readonly completedCount: number;
  readonly totalWorkouts: number;
  readonly undoCount: number;
  readonly onUndo: () => void;
  readonly onJumpToCurrent: () => void;
  readonly onReset: () => void;
}

function ProgressBar({
  completed,
  total,
  className,
}: {
  readonly completed: number;
  readonly total: number;
  readonly className?: string;
}): ReactNode {
  const pct = Math.round((completed / total) * 100);
  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <div
        className="flex-1 h-2 bg-[var(--bg-progress)] overflow-hidden"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Progreso de entrenamiento"
      >
        <div
          className="h-full bg-[var(--fill-progress)] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs font-bold text-[var(--text-muted)] whitespace-nowrap tabular-nums">
        {completed}/{total} ({pct}%)
      </span>
    </div>
  );
}

export function Toolbar({
  completedCount,
  totalWorkouts,
  undoCount,
  onUndo,
  onJumpToCurrent,
  onReset,
}: ToolbarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback((): void => setMenuOpen(false), []);

  return (
    <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)] px-3 sm:px-5 py-2 sm:py-3 shadow-[0_2px_8px_var(--shadow-toolbar)]">
      {/* Mobile progress bar */}
      <ProgressBar
        completed={completedCount}
        total={totalWorkouts}
        className="mb-2 sm:mb-0 sm:hidden"
      />

      <div className="flex items-center gap-4 flex-wrap">
        {/* Left */}
        <div className="flex items-center gap-3 shrink-0">
          <Button size="sm" onClick={onUndo} disabled={undoCount === 0}>
            Deshacer
          </Button>
          {undoCount > 0 && (
            <span
              className="font-mono text-xs text-[var(--text-muted)] tabular-nums"
              aria-label={`${undoCount} acciones deshacibles`}
            >
              {undoCount}x
            </span>
          )}
        </div>

        {/* Desktop progress bar */}
        <ProgressBar
          completed={completedCount}
          total={totalWorkouts}
          className="flex-1 hidden sm:flex"
        />

        {/* Right */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button size="sm" variant="ghost" onClick={onJumpToCurrent}>
            Ir al actual
          </Button>

          {/* Overflow menu */}
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Más acciones"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              &#8942;
            </Button>
            <DropdownMenu open={menuOpen} onClose={closeMenu} align="right">
              <DropdownItem
                variant="danger"
                onClick={() => {
                  closeMenu();
                  setConfirmOpen(true);
                }}
              >
                Reiniciar Todo
              </DropdownItem>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Reiniciar Todo el Progreso"
        message="¿Estás seguro de que quieres reiniciar TODO el progreso? Esto no se puede deshacer."
        confirmLabel="Reiniciar Todo"
        variant="danger"
        onConfirm={() => {
          onReset();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
