import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AUTH_ROUTES } from '../../navigation/routes';
import { MessageState } from '../../ui/message-state';

export default function VerifyEmailRoute() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <MessageState
      actionAccessibilityLabel={t('verify_email.back_accessibility')}
      actionLabel={t('verify_email.back')}
      body={t('verify_email.body')}
      onAction={() => router.replace(AUTH_ROUTES.login)}
      title={t('verify_email.title')}
    />
  );
}
