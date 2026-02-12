'use client';

import { useRef, useState, useCallback } from 'react';
import { ConfirmDialog } from './confirm-dialog';
import { DropdownMenu, DropdownItem, DropdownDivider } from './dropdown-menu';

interface ToolbarProps {
  readonly completedCount: number;
  readonly totalWorkouts: number;
  readonly undoCount: number;
  readonly onUndo: () => void;
  readonly onExport: () => void;
  readonly onImport: (json: string) => boolean;
  readonly onJumpToCurrent: () => void;
  readonly onReset: () => void;
}

export function Toolbar({
  completedCount,
  totalWorkouts,
  undoCount,
  onUndo,
  onExport,
  onImport,
  onJumpToCurrent,
  onReset,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingImportRef = useRef<string | null>(null);
  const [confirmState, setConfirmState] = useState<'reset' | 'import' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback((): void => setMenuOpen(false), []);
  const pct = Math.round((completedCount / totalWorkouts) * 100);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_IMPORT_SIZE = 1_048_576; // 1 MB
    if (file.size > MAX_IMPORT_SIZE) {
      alert('Import file is too large (max 1 MB).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') return;
      pendingImportRef.current = text;
      setConfirmState('import');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirm = (): void => {
    if (confirmState === 'reset') {
      onReset();
    } else if (confirmState === 'import' && pendingImportRef.current) {
      const success = onImport(pendingImportRef.current);
      pendingImportRef.current = null;
      alert(success ? 'Data imported successfully!' : 'Failed to import: invalid file.');
    }
    setConfirmState(null);
  };

  const handleCancel = (): void => {
    pendingImportRef.current = null;
    setConfirmState(null);
  };

  const btnClass =
    'px-2 py-2 sm:px-3.5 sm:py-2.5 min-h-[44px] border-2 border-[var(--btn-border)] text-[10px] sm:text-xs font-bold cursor-pointer bg-[var(--btn-bg)] text-[var(--btn-text)] whitespace-nowrap transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-[var(--btn-bg)] disabled:hover:text-[var(--btn-text)]';

  return (
    <div className="sticky top-0 z-50 bg-[var(--bg-card)] border-b border-[var(--border-color)] px-3 sm:px-5 py-2 sm:py-3 shadow-[0_2px_8px_var(--shadow-toolbar)]">
      {/* Progress bar - always full width */}
      <div className="flex items-center gap-3 mb-2 sm:mb-0 sm:hidden">
        <div className="flex-1 h-2 bg-[var(--bg-progress)] overflow-hidden">
          <div
            className="h-full bg-[var(--fill-progress)] transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-[var(--text-muted)] whitespace-nowrap">
          {completedCount}/{totalWorkouts} ({pct}%)
        </span>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {/* Left */}
        <div className="flex items-center gap-3 shrink-0">
          <button className={btnClass} onClick={onUndo} disabled={undoCount === 0}>
            Undo
          </button>
          {undoCount > 0 && (
            <span className="text-[11px] text-[var(--text-muted)]">{undoCount} undo</span>
          )}
        </div>

        {/* Progress - desktop */}
        <div className="flex-1 hidden sm:flex items-center gap-3">
          <div className="flex-1 h-2 bg-[var(--bg-progress)] overflow-hidden">
            <div
              className="h-full bg-[var(--fill-progress)] transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-[var(--text-muted)] whitespace-nowrap">
            {completedCount} / {totalWorkouts} ({pct}%)
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button className={btnClass} onClick={onJumpToCurrent}>
            Go to current
          </button>

          {/* Overflow menu */}
          <div className="relative">
            <button
              className={btnClass}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="More actions"
            >
              &#8942;
            </button>
            <DropdownMenu open={menuOpen} onClose={closeMenu} align="right">
              <DropdownItem
                onClick={() => {
                  closeMenu();
                  onExport();
                }}
              >
                Export
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  closeMenu();
                  fileRef.current?.click();
                }}
              >
                Import
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem
                variant="danger"
                onClick={() => {
                  closeMenu();
                  setConfirmState('reset');
                }}
              >
                Reset All
              </DropdownItem>
            </DropdownMenu>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmState === 'reset'}
        title="Reset All Progress"
        message="Are you sure you want to reset ALL progress? This cannot be undone."
        confirmLabel="Reset All"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      <ConfirmDialog
        open={confirmState === 'import'}
        title="Import Data"
        message="This will replace all current data with the imported backup. Continue?"
        confirmLabel="Import"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
