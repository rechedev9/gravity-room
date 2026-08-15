import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DropdownMenu, DropdownItem } from '@/components/dropdown-menu';

export interface SessionMenuProps {
  /** Surface the finish-program CTA next to the `⋮` (program fully recorded). */
  readonly showFinishCta?: boolean;
  readonly isFinishing: boolean;
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

/**
 * Overflow actions for the session chrome — export, backup, finish, reset.
 * Everything that is maintenance rather than training lives behind this single
 * `⋮`, so the chrome band itself only carries session state.
 */
export function SessionMenu({
  showFinishCta = false,
  isFinishing,
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
}: SessionMenuProps): React.ReactNode {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [webMcpConfirmOpen, setWebMcpConfirmOpen] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const closeMenu = (): void => setMenuOpen(false);

  const handleBackupFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void onImportBackup(file);
  };

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      {showFinishCta && (
        <Button size="sm" onClick={() => setFinishConfirmOpen(true)} disabled={isFinishing}>
          {isFinishing
            ? t('tracker.toolbar.finishing_loading')
            : t('tracker.toolbar.finish_program')}
        </Button>
      )}
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label={t('tracker.toolbar.more_actions_aria')}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        data-testid="session-menu-trigger"
        className="min-h-[36px] min-w-[36px] px-2 text-lg leading-none text-info transition-colors hover:text-main cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        &#8942;
      </button>
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
