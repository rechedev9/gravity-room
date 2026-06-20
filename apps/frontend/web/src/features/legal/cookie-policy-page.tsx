import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useHead } from '@/hooks/use-head';

export function CookiePolicyPage(): React.ReactNode {
  const { t } = useTranslation();
  // Self-referencing canonical so this page stops inheriting the landing's
  // canonical/OG from index.html.
  useHead({
    title: t('legal.cookie_policy.document_title'),
    description: t('legal.cookie_policy.meta_description'),
    canonical: 'https://gravityroom.app/cookies',
  });

  return (
    <div className="min-h-dvh bg-body">
      <header className="bg-header border-b border-rule px-6 sm:px-10 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm font-bold text-title hover:opacity-80 transition-opacity">
            {t('legal.back')}
          </Link>
          <span className="text-sm font-bold text-title">Gravity Room</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-title mb-8">
          {t('legal.cookie_policy.title')}
        </h1>

        <div className="space-y-8 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.cookie_policy.what_are_cookies.title')}
            </h2>
            <p>{t('legal.cookie_policy.what_are_cookies.body')}</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.cookie_policy.which_cookies.title')}
            </h2>
            <p className="mb-4">
              {t('legal.cookie_policy.which_cookies.body')}{' '}
              <strong className="text-main">
                {t('legal.cookie_policy.which_cookies.no_tracking')}
              </strong>
            </p>

            <div className="overflow-x-auto rounded-lg border border-rule">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-th text-label">
                    <th className="px-4 py-3 font-semibold">
                      {t('legal.cookie_policy.table.name')}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t('legal.cookie_policy.table.type')}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t('legal.cookie_policy.table.purpose')}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t('legal.cookie_policy.table.duration')}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t('legal.cookie_policy.table.owner')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-rule">
                    <td className="px-4 py-3 font-mono text-main">refresh_token</td>
                    <td className="px-4 py-3">{t('legal.cookie_policy.table.technical_type')}</td>
                    <td className="px-4 py-3">
                      {t('legal.cookie_policy.table.refresh_token_purpose')}
                    </td>
                    <td className="px-4 py-3">
                      {t('legal.cookie_policy.table.refresh_token_duration')}
                    </td>
                    <td className="px-4 py-3">
                      {t('legal.cookie_policy.table.refresh_token_owner')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.cookie_policy.third_party.title')}
            </h2>
            <p>
              {t('legal.cookie_policy.third_party.body_prefix')}{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:opacity-80 transition-opacity"
              >
                {t('legal.cookie_policy.third_party.privacy_policy_link')}
              </a>
              . {t('legal.cookie_policy.third_party.no_access')}
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.cookie_policy.local_storage.title')}
            </h2>
            <p>{t('legal.cookie_policy.local_storage.body')}</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.cookie_policy.analytics.title')}
            </h2>
            <p>
              {t('legal.cookie_policy.analytics.body_prefix')}{' '}
              <a
                href="https://plausible.io/privacy-focused-web-analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:opacity-80 transition-opacity"
              >
                Plausible Analytics
              </a>
              , {t('legal.cookie_policy.analytics.body')}
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.cookie_policy.legal_basis.title')}
            </h2>
            <p>
              {t('legal.cookie_policy.legal_basis.body_prefix')}{' '}
              <span className="font-mono text-main">refresh_token</span>{' '}
              {t('legal.cookie_policy.legal_basis.body')}
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.cookie_policy.disable_cookies.title')}
            </h2>
            <p>
              {t('legal.cookie_policy.disable_cookies.body_prefix')}{' '}
              <span className="font-mono text-main">refresh_token</span>,{' '}
              {t('legal.cookie_policy.disable_cookies.body_suffix')}
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.cookie_policy.contact.title')}
            </h2>
            <p>{t('legal.cookie_policy.contact.body')}</p>
          </section>

          <section>
            <p className="text-xs text-muted italic">{t('legal.cookie_policy.last_updated')}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
