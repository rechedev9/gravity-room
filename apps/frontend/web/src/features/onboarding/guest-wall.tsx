import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface GuestWallProps {
  readonly onCreateAccount: () => void;
  readonly onContinueAsGuest: () => void;
}

const ROWS = [
  { key: 'train', guest: true },
  { key: 'progression', guest: true },
  { key: 'stats', guest: false },
  { key: 'export', guest: false },
  { key: 'sync', guest: false },
] as const;

/**
 * The guest limits are stated up front, as a table, instead of being
 * discovered one ephemeral toast at a time after a session has been invested.
 */
export function GuestWall({ onCreateAccount, onContinueAsGuest }: GuestWallProps): ReactNode {
  const { t } = useTranslation();

  return (
    <div data-testid="start-guest-wall" className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <h2 className="font-display mb-3 text-[40px] leading-[0.9] tracking-[0.03em] text-title sm:text-[52px]">
          {t('onboarding.guest.title')}
        </h2>
        <p className="mb-7 max-w-[560px] text-[15px] leading-relaxed text-muted">
          {t('onboarding.guest.body')}
        </p>

        <div className="mb-5 flex flex-wrap gap-3">
          <button
            type="button"
            data-testid="start-guest-create-account"
            onClick={onCreateAccount}
            style={{ boxShadow: 'var(--shadow-pressed-steel)' }}
            className="bg-accent px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-on-accent transition-colors hover:bg-accent-hover cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {t('onboarding.guest.create_account')}
          </button>
          <button
            type="button"
            data-testid="start-guest-continue"
            onClick={onContinueAsGuest}
            className="border-[1.5px] border-rule-light px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted transition-colors hover:border-accent-deep hover:text-main cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {t('onboarding.guest.continue')}
          </button>
        </div>

        <p className="max-w-[560px] text-[12.5px] leading-relaxed text-info">
          {t('onboarding.guest.no_nagging')}
        </p>
      </div>

      <table className="w-full border-collapse self-start text-left">
        <caption className="sr-only">{t('onboarding.guest.table_caption')}</caption>
        <thead>
          <tr>
            <th className="border-b border-rule py-2 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
              {t('onboarding.guest.column_feature')}
            </th>
            <th className="border-b border-rule py-2 text-center font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
              {t('onboarding.guest.column_guest')}
            </th>
            <th className="border-b border-rule py-2 text-center font-mono text-2xs font-bold uppercase tracking-[0.08em] text-accent">
              {t('onboarding.guest.column_account')}
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key}>
              <td className="border-b border-rule py-2.5 text-[12.5px] text-muted">
                {t(`onboarding.guest.row_${row.key}`)}
              </td>
              <td
                className={`border-b border-rule py-2.5 text-center font-mono text-sm ${
                  row.guest ? 'text-ok' : 'text-info'
                }`}
              >
                {row.guest ? '✓' : '—'}
              </td>
              <td className="border-b border-rule py-2.5 text-center font-mono text-sm text-ok">
                {'✓'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
