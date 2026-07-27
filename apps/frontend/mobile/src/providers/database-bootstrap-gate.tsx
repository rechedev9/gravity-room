import { type PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { bootstrapDatabase } from '../lib/db/client';
import { MessageState } from '../ui/message-state';
import { Screen } from '../ui/screen';
import { colors } from '../ui/tokens';

type BootstrapState =
  | { readonly status: 'booting' }
  | { readonly status: 'ready' }
  | {
      readonly status: 'failed';
    };

export function DatabaseBootstrapGate({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BootstrapState>({ status: 'booting' });

  useEffect(() => {
    let active = true;
    setState({ status: 'booting' });

    void bootstrapDatabase()
      .then(() => {
        if (active) {
          setState({ status: 'ready' });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'failed' });
        }
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <View style={styles.root}>
      {children}
      {state.status === 'booting' ? (
        <View style={styles.overlay} testID="database-bootstrap-loading">
          <Screen centered>
            <ActivityIndicator
              accessibilityLabel={t('startup.database_loading')}
              color={colors.textPrimary}
            />
          </Screen>
        </View>
      ) : null}
      {state.status === 'failed' ? (
        <View style={styles.overlay}>
          <MessageState
            actionAccessibilityLabel={t('startup.database_retry_accessibility')}
            actionLabel={t('common.retry')}
            body={t('startup.database_error_body')}
            onAction={() => setAttempt((current) => current + 1)}
            title={t('startup.database_error_title')}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.canvas,
  },
});
