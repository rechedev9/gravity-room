import { useState, type ReactNode } from 'react';
import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';
import { DropdownMenu, DropdownItem } from './dropdown-menu';

export interface ToolbarProps {
  readonly completedCount: number;
  readonly totalWorkouts: number;
  readonly undoCount: number;
  readonly onUndo: () => void;
  readonly onFinish: () => void;
  readonly onReset: () => void;
  readonly onExportCsv: () => void;
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
        className="flex-1 h-2.5 bg-progress-track overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Progreso de entrenamiento"
      >
        <div
          className="h-full bg-accent transition-[width] duration-300 ease-out progress-fill rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs font-bold text-muted whitespace-nowrap tabular-nums">
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
  onFinish,
  onReset,
  onExportCsv,
}: ToolbarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = (): void => setMenuOpen(false);

  return (
    <div
      className="bg-card border-b border-rule px-3 sm:px-5 py-2 sm:py-3 shadow-toolbar"
      style={{
        backgroundImage: 'linear-gradient(to bottom, rgba(232, 170, 32, 0.02), transparent)',
      }}
    >
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
              className="font-mono text-xs text-muted tabular-nums"
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
                onClick={() => {
                  closeMenu();
                  onExportCsv();
                }}
              >
                Exportar CSV
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  closeMenu();
                  setFinishConfirmOpen(true);
                }}
              >
                Finalizar Programa
              </DropdownItem>
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
        open={finishConfirmOpen}
        title="Finalizar Programa"
        message="Tu progreso y estadísticas se guardarán. Podrás consultarlos en cualquier momento desde el dashboard."
        confirmLabel="Finalizar"
        onConfirm={() => {
          onFinish();
          setFinishConfirmOpen(false);
        }}
        onCancel={() => setFinishConfirmOpen(false)}
      />

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
