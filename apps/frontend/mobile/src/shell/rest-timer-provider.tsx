import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RestTimer } from '../lib/rest/rest-timer';
import { restAlerts } from '../lib/rest/rest-alerts';
import { Button } from '../ui/button';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, type } from './design';

const RestTimerContext = createContext<RestTimer | null>(null);

export function RestTimerProvider({ children }: PropsWithChildren) {
  const [timer] = useState(() => new RestTimer(restAlerts));
  const state = useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);

  useEffect(() => {
    timer.activate();
    return () => timer.dispose();
  }, [timer]);
  useEffect(() => {
    if (state.endsAt === null) return;
    const tick = () => {
      if (AppState.currentState === 'active') timer.tick();
    };
    const interval = setInterval(tick, 250);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') timer.tick();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [timer, state.endsAt]);

  return <RestTimerContext.Provider value={timer}>{children}</RestTimerContext.Provider>;
}

export function RestTimerBanner() {
  const timer = useRestTimer();
  const state = useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);
  const { t } = useTranslation();
  if (state.endsAt === null) return null;
  return (
    <View style={styles.banner}>
      <Ionicons accessible={false} name="timer-outline" size={22} color={colors.accent} />
      <View style={styles.copy}>
        <Text style={styles.label}>{t('rest.title')}</Text>
        <Text accessibilityRole="timer" style={styles.time}>
          {Math.floor(state.remainingSeconds / 60)}:
          {String(state.remainingSeconds % 60).padStart(2, '0')}
        </Text>
        {state.alertUnavailable ? (
          <Text style={styles.notice}>{t('rest.alert_unavailable')}</Text>
        ) : null}
      </View>
      <Button variant="ghost" accessibilityLabel={t('rest.skip')} onPress={timer.skip}>
        {t('rest.skip')}
      </Button>
    </View>
  );
}

export function useRestTimer(): RestTimer {
  const timer = useContext(RestTimerContext);
  if (timer === null) throw new Error('Workout requires RestTimerProvider');
  return timer;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: colors.ruleStrong,
    backgroundColor: colors.header,
  },
  copy: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  label: { ...type.body, fontSize: 14 },
  time: { ...type.title, color: colors.accent },
  notice: { ...type.body, fontSize: 12, width: '100%' },
});
