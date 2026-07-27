import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { resolveInitialRoute } from '../navigation/routes';
import { useAuth } from '../providers/auth-provider';
import { Screen } from '../ui/screen';
import { colors } from '../ui/tokens';

export default function IndexRoute() {
  const { t } = useTranslation();
  const { loading, user } = useAuth();
  const href = resolveInitialRoute(
    loading
      ? { status: 'loading' }
      : user === null
        ? { status: 'anonymous' }
        : { status: 'authenticated' }
  );

  if (href === null) {
    return (
      <Screen centered>
        <ActivityIndicator
          accessibilityLabel={t('startup.session_loading')}
          color={colors.textPrimary}
        />
      </Screen>
    );
  }

  return <Redirect href={href} />;
}
