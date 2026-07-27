import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { readLastPrimaryTab } from '../navigation/navigation-storage';
import {
  deferredActiveWorkoutLookup,
  loadInitialRouteContext,
  resolveInitialRoute,
  type InitialRouteContext,
} from '../navigation/routes';
import { useAuth } from '../providers/auth-provider';
import { Screen } from '../ui/screen';
import { colors } from '../ui/tokens';

export default function IndexRoute() {
  const { t } = useTranslation();
  const { loading, user } = useAuth();
  const [routeContext, setRouteContext] = useState<InitialRouteContext | null>(null);

  useEffect(() => {
    let active = true;

    if (loading || user === null) {
      setRouteContext(null);
      return () => {
        active = false;
      };
    }

    void loadInitialRouteContext({
      activeWorkoutLookup: deferredActiveWorkoutLookup,
      readLastPrimaryTab,
    }).then((context) => {
      if (active) {
        setRouteContext(context);
      }
    });

    return () => {
      active = false;
    };
  }, [loading, user]);

  const href = resolveInitialRoute(
    loading
      ? { status: 'loading' }
      : user === null
        ? { status: 'anonymous' }
        : routeContext === null
          ? { status: 'loading' }
          : { status: 'authenticated' },
    routeContext ?? undefined
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
