import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/use-document-title';

export function PrivacyPage(): React.ReactNode {
  const { t } = useTranslation();
  useDocumentTitle(t('legal.privacy.document_title'));

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
          {t('legal.privacy.title')}
        </h1>

        <div className="space-y-8 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.privacy.data_stored.title')}
            </h2>
            <p>{t('legal.privacy.data_stored.body')}</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.privacy.cloud_sync.title')}
            </h2>
            <p>{t('legal.privacy.cloud_sync.body')}</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.privacy.google_login.title')}
            </h2>
            <p>{t('legal.privacy.google_login.body')}</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.privacy.cookies.title')}
            </h2>
            <p>
              {t('legal.privacy.cookies.body_prefix')}{' '}
              <Link
                to="/cookies"
                className="text-accent underline hover:opacity-80 transition-opacity"
              >
                {t('legal.privacy.cookies.link')}
              </Link>{' '}
              {t('legal.privacy.cookies.body_suffix')}
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.privacy.delete_data.title')}
            </h2>
            <p>
              <strong>{t('legal.privacy.delete_data.local_label')}</strong>{' '}
              {t('legal.privacy.delete_data.local_body')}
            </p>
            <p className="mt-2">
              <strong>{t('legal.privacy.delete_data.cloud_label')}</strong>{' '}
              {t('legal.privacy.delete_data.cloud_body')}
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              {t('legal.privacy.contact.title')}
            </h2>
            <p>{t('legal.privacy.contact.body')}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
