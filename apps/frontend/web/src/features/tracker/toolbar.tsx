import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DropdownMenu, DropdownItem } from '@/components/dropdown-menu';
import { ProgressBar } from '@/components/progress-bar';

export interface ToolbarProps {
  readonly completedCount: number;
  readonly totalWorkouts: number;
  readonly undoCount: number;
  readonly isFinishing: boolean;
  readonly onUndo: () => void;
  readonly onFinish: () => Promise<void>;
  readonly onReset: () => void;
  readonly onExportCsv: () => void;
  readonly canUseBackup: boolean;
  readonly onExportBackup: () => void;
  readonly onImportBackup: (file: File) => Promise<void>;
  readonly webMcpSupported?: boolean;
  readonly webMcpEnabled?: boolean;
  readonly onEnableWebMcp?: () => void;
  readonly onDisableWebMcp?: () => void;
}

export function Toolbar({
  completedCount,
  totalWorkouts,
  undoCount,
  isFinishing,
  onUndo,
  onFinish,
  onReset,
  onExportCsv,
  canUseBackup,
  onExportBackup,
  onImportBackup,
  webMcpSupported = false,
  webMcpEnabled = false,
  onEnableWebMcp,
  onDisableWebMcp,
}: ToolbarProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [webMcpConfirmOpen, setWebMcpConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const closeMenu = (): void => setMenuOpen(false);
  const handleBackupFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void onImportBackup(file);
  };

  return (
    <div className="bg-card border-b border-rule px-3 sm:px-5 py-2 sm:py-3 shadow-toolbar">
      {/* Mobile progress bar */}
      <ProgressBar
        completed={completedCount}
        total={totalWorkouts}
        ariaLabel={t('tracker.toolbar.progress_aria')}
        showPercent
        className="mb-2 sm:mb-0 sm:hidden"
      />

      <div className="flex items-center gap-4 flex-wrap">
        {/* Left - canonical undo surface (toolbar). The transient post-action toast
            offers the same action inline; there is no third competing affordance. */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={onUndo}
            disabled={undoCount === 0}
            className="disabled:opacity-60 disabled:border-rule-light"
          >
            {t('tracker.toolbar.undo_button')}
          </Button>
          {undoCount > 0 && (
            <span
              className="font-mono text-xs text-muted tabular-nums"
              aria-label={`${undoCount} ${t('tracker.toolbar.undo_actions_aria')}`}
            >
              {undoCount}x
            </span>
          )}
        </div>

        {/* Desktop progress bar */}
        <ProgressBar
          completed={completedCount}
          total={totalWorkouts}
          ariaLabel={t('tracker.toolbar.progress_aria')}
          showPercent
          className="flex-1 hidden sm:flex"
        />

        {/* Right */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Proactive finish CTA when program is complete */}
          {completedCount >= totalWorkouts && (
            <Button size="sm" onClick={() => setFinishConfirmOpen(true)} disabled={isFinishing}>
              {isFinishing
                ? t('tracker.toolbar.finishing_loading')
                : t('tracker.toolbar.finish_program')}
            </Button>
          )}

          {/* Overflow menu */}
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={t('tracker.toolbar.more_actions_aria')}
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
                {t('tracker.toolbar.export_csv')}
              </DropdownItem>
              {canUseBackup && (
                <>
                  <DropdownItem
                    onClick={() => {
                      closeMenu();
                      onExportBackup();
                    }}
                  >
                    {t('tracker.toolbar.export_backup')}
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      closeMenu();
                      backupInputRef.current?.click();
                    }}
                  >
                    {t('tracker.toolbar.import_backup')}
                  </DropdownItem>
                </>
              )}
              {webMcpSupported && (
                <DropdownItem
                  onClick={() => {
                    closeMenu();
                    if (webMcpEnabled) {
                      onDisableWebMcp?.();
                    } else {
                      setWebMcpConfirmOpen(true);
                    }
                  }}
                >
                  {webMcpEnabled
                    ? t('tracker.toolbar.webmcp_disable')
                    : t('tracker.toolbar.webmcp_enable')}
                </DropdownItem>
              )}
              <DropdownItem
                onClick={() => {
                  closeMenu();
                  setFinishConfirmOpen(true);
                }}
              >
                {t('tracker.toolbar.finish_program')}
              </DropdownItem>
              <DropdownItem
                variant="danger"
                onClick={() => {
                  closeMenu();
                  setConfirmOpen(true);
                }}
              >
                {t('tracker.toolbar.reset_all')}
              </DropdownItem>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <input
        ref={backupInputRef}
        type="file"
        accept=".json,application/json"
        aria-label={t('tracker.toolbar.import_backup_file_aria')}
        className="sr-only"
        onChange={handleBackupFile}
      />

      <ConfirmDialog
        open={finishConfirmOpen}
        title={t('tracker.toolbar.finish_program')}
        message={t('tracker.toolbar.finish_confirm_message')}
        confirmLabel={t('tracker.toolbar.finish_confirm_label')}
        loading={isFinishing}
        onConfirm={() => {
          void onFinish().finally(() => setFinishConfirmOpen(false));
        }}
        onCancel={() => setFinishConfirmOpen(false)}
      />

      <ConfirmDialog
        open={webMcpConfirmOpen}
        title={t('tracker.toolbar.webmcp_confirm_title')}
        message={t('tracker.toolbar.webmcp_confirm_message')}
        confirmLabel={t('tracker.toolbar.webmcp_confirm_label')}
        onConfirm={() => {
          onEnableWebMcp?.();
          setWebMcpConfirmOpen(false);
        }}
        onCancel={() => setWebMcpConfirmOpen(false)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={t('tracker.toolbar.reset_confirm_title')}
        message={t('tracker.toolbar.reset_confirm_message')}
        confirmLabel={t('tracker.toolbar.reset_confirm_label')}
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
