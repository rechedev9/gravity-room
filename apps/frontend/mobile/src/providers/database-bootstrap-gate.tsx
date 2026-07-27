import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { bootstrapDatabase } from '../lib/db/client';
import { MessageState } from '../ui/message-state';
import { Screen } from '../ui/screen';
import { colors } from '../ui/tokens';

export type DatabaseBootstrapState =
  | { readonly status: 'booting' }
  | { readonly status: 'ready' }
  | {
      readonly status: 'failed';
    };

const DatabaseBootstrapContext = createContext<DatabaseBootstrapState | null>(null);

export function DatabaseBootstrapGate({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DatabaseBootstrapState>({ status: 'booting' });
  const contextValue = useMemo<DatabaseBootstrapState>(() => state, [state]);

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
    <DatabaseBootstrapContext.Provider value={contextValue}>
      <View style={styles.root}>
        <View
          accessibilityElementsHidden={state.status !== 'ready'}
          importantForAccessibility={state.status === 'ready' ? 'auto' : 'no-hide-descendants'}
          style={styles.root}
          testID="database-bootstrap-content"
        >
          {children}
        </View>
        {state.status === 'booting' ? (
          <View
            accessibilityViewIsModal
            importantForAccessibility="yes"
            style={styles.overlay}
            testID="database-bootstrap-loading"
          >
            <Screen centered>
              <ActivityIndicator
                accessibilityLabel={t('startup.database_loading')}
                color={colors.textPrimary}
              />
            </Screen>
          </View>
        ) : null}
        {state.status === 'failed' ? (
          <View
            accessibilityViewIsModal
            importantForAccessibility="yes"
            style={styles.overlay}
            testID="database-bootstrap-error"
          >
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
    </DatabaseBootstrapContext.Provider>
  );
}

export function useDatabaseBootstrapState(): DatabaseBootstrapState {
  const state = useContext(DatabaseBootstrapContext);
  if (state === null) {
    throw new Error('useDatabaseBootstrapState must be used inside DatabaseBootstrapGate');
  }
  return state;
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
