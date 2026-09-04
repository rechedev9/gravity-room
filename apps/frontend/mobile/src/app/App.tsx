import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

// Side-effect import: initializes i18next (device-locale detection + catalogs)
// before any screen calls useTranslation.
import '../lib/i18n';
import { LoginScreen } from '../features/auth/login-screen';
import { ProfileScreen } from '../features/profile/profile-screen';
import { ProgramsScreen } from '../features/programs/programs-screen';
import { TrainScreen } from '../features/train/train-screen';
import { useAuth } from './auth-provider';
import { colors, fonts } from './design';
import { AppProviders } from './providers';

type MobileTab = 'train' | 'programs' | 'profile';

function AppShell() {
  const { t } = useTranslation();
  const { loading, signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState<MobileTab>('train');
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (user) {
    return (
      <View style={styles.authenticatedShell}>
        <View style={styles.screenSlot}>
          {activeTab === 'train' ? (
            <TrainScreen
              programInstanceId={activeProgramId}
              onResolvedProgram={setActiveProgramId}
              onOpenPrograms={() => setActiveTab('programs')}
            />
          ) : activeTab === 'programs' ? (
            <ProgramsScreen
              onOpenProgram={(programInstanceId) => {
                setActiveProgramId(programInstanceId);
                setActiveTab('train');
              }}
            />
          ) : (
            <ProfileScreen user={user} onSignOut={signOut} />
          )}
        </View>
        <View style={styles.bottomNav}>
          <Pressable
            accessibilityLabel={t('nav.open_train')}
            accessibilityRole="button"
            onPress={() => setActiveTab('train')}
            style={styles.navItem}
          >
            <Text style={[styles.navText, activeTab === 'train' ? styles.navTextActive : null]}>
              {t('nav.train')}
            </Text>
            {activeTab === 'train' ? <View style={styles.navMark} /> : null}
          </Pressable>
          <Pressable
            accessibilityLabel={t('nav.open_programs')}
            accessibilityRole="button"
            onPress={() => setActiveTab('programs')}
            style={styles.navItem}
          >
            <Text style={[styles.navText, activeTab === 'programs' ? styles.navTextActive : null]}>
              {t('nav.programs')}
            </Text>
            {activeTab === 'programs' ? <View style={styles.navMark} /> : null}
          </Pressable>
          <Pressable
            accessibilityLabel={t('nav.open_profile')}
            accessibilityRole="button"
            onPress={() => setActiveTab('profile')}
            style={styles.navItem}
          >
            <Text style={[styles.navText, activeTab === 'profile' ? styles.navTextActive : null]}>
              {t('nav.profile')}
            </Text>
            {activeTab === 'profile' ? <View style={styles.navMark} /> : null}
          </Pressable>
        </View>
      </View>
    );
  }

  return <LoginScreen />;
}

export function App() {
  return (
    <AppProviders>
      <View style={styles.root}>
        <AppShell />
      </View>
    </AppProviders>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  authenticatedShell: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  screenSlot: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    backgroundColor: colors.header,
    paddingHorizontal: 8,
    paddingBottom: 10,
    paddingTop: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 4,
  },
  navText: {
    fontFamily: fonts.monoBold,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  navTextActive: {
    color: colors.accent,
  },
  navMark: {
    width: 16,
    height: 2,
    backgroundColor: colors.accent,
  },
});
