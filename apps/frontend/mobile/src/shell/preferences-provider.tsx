import { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { restoreLanguagePreference } from '../lib/i18n/language-preference';
import { restoreRestAlertsPreference } from '../lib/rest/rest-alerts-preference';
import { colors } from './design';

/** Holds the first frame until device preferences are applied, so no screen flashes the wrong language. */
export function PreferencesProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([restoreLanguagePreference(), restoreRestAlertsPreference()]).then(
      () => {
        if (active) setReady(true);
      }
    );
    return () => {
      active = false;
    };
  }, []);
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.canvas,
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return children;
}
